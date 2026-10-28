import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { appConfig } from '@/config/ai';
import { quotaDate } from '@/server/date';
import { extractTimeMentions } from '@/server/time-mentions';
import type { AgentResult, QuotaSnapshot, RecordingTask, TaskStage, TranscriptReview, TimeMention } from '@/domain/types';

type TaskDocument = RecordingTask & { _id: string; deletedAt?: string };
type QuotaDocument = { _id: string; used: number; reserved: number; completedRounds?: number };
const DAILY_LIMIT = 10;
export class QuotaExceededError extends Error {}

export class TaskStore {
  readonly client: MongoClient;
  readonly db;
  private ready?: Promise<unknown>;

  constructor(uri = appConfig.mongoUri, database = appConfig.mongoDatabase) {
    this.client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, ignoreUndefined: true });
    this.db = this.client.db(database);
  }

  private get tasks() { return this.db.collection<TaskDocument>('tasks'); }
  private get quotas() { return this.db.collection<QuotaDocument>('daily_quota'); }

  async initialize() {
    this.ready ??= Promise.all([
      this.tasks.createIndex({ requestId: 1 }, { unique: true }),
      this.tasks.createIndex({ status: 1, createdAt: 1 }),
      this.tasks.createIndex({ createdAt: -1 }),
    ]).catch(error => { this.ready = undefined; throw error; });
    await this.ready;
  }

  async close() { await this.client.close(); }

  private parse(row: TaskDocument | null): RecordingTask | undefined {
    if (!row) return undefined;
    const { _id, deletedAt, ...task } = row;
    task.timeMentions ??= extractTimeMentions(task.correctedTranscript ?? task.rawTranscript ?? '', task.createdAt, appConfig.timezone);
    return task;
  }

  async getTask(id: string) { return this.parse(await this.tasks.findOne({ _id: id })); }
  async findByRequestId(requestId: string) { return this.parse(await this.tasks.findOne({ requestId })); }
  async listTasks() {
    return (await this.tasks.find({ deletedAt: { $exists: false } }).sort({ createdAt: -1 }).toArray()).map(row => this.parse(row)!);
  }
  async isDeleted(id: string) {
    return !!await this.tasks.findOne({ _id: id, deletedAt: { $exists: true } }, { projection: { _id: 1 } });
  }
  async deleteTask(id: string) {
    // Soft deletion keeps in-flight settlement and request deduplication safe.
    await this.tasks.updateOne({ _id: id, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date().toISOString() } });
    await this.db.collection('recording_vectors').deleteOne({ taskId: id });
  }

  private async ensureQuota(day: string) {
    try {
      await this.quotas.updateOne({ _id: day }, { $setOnInsert: { used: 0, reserved: 0 } }, { upsert: true });
    } catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
    await this.quotas.updateOne({ _id: day, used: { $gte: DAILY_LIMIT }, reserved: 0 },
      { $set: { used: 0 }, $inc: { completedRounds: 1 } });
  }
  async getQuota(day = quotaDate()): Promise<QuotaSnapshot> {
    await this.ensureQuota(day);
    const row = (await this.quotas.findOne({ _id: day }))!;
    return { limit: DAILY_LIMIT, used: row.used, reserved: row.reserved, remaining: Math.max(0, DAILY_LIMIT - row.used - row.reserved) };
  }

  async createTask(input: { id?: string; requestId: string; audioPath: string; transcriptHint?: string }) {
    await this.initialize();
    const day = quotaDate();
    await this.ensureQuota(day);
    const session = this.client.startSession();
    try {
      return (await session.withTransaction(async () => {
        const existing = await this.tasks.findOne({ requestId: input.requestId }, { session });
        if (existing) return this.parse(existing)!;
        const quota = await this.quotas.findOneAndUpdate(
          { _id: day, $expr: { $lt: [{ $add: ['$used', '$reserved'] }, DAILY_LIMIT] } },
          { $inc: { reserved: 1 } }, { session, returnDocument: 'after' },
        );
        if (!quota) throw new QuotaExceededError('本轮次数已全部预占，请等正在处理的任务完成后重试');
        const now = new Date().toISOString();
        const id = input.id ?? randomUUID();
        const task: TaskDocument = { ...input, id, _id: id, status: 'PENDING', quotaDate: day,
          quotaState: 'RESERVED', todos: [], reminders: [], toolCalls: [], progress: [], createdAt: now, updatedAt: now };
        await this.tasks.insertOne(task, { session });
        return this.parse(task)!;
      }))!;
    } catch (error) {
      // Two simultaneous retries may race on the unique requestId index.
      if ((error as { code?: number }).code === 11000) {
        const existing = await this.findByRequestId(input.requestId);
        if (existing) return existing;
      }
      throw error;
    } finally { await session.endSession(); }
  }

  async claimNextTask() {
    return this.parse(await this.tasks.findOneAndUpdate({ status: 'PENDING' },
      { $set: { status: 'AUDIO_PROCESSING', updatedAt: new Date().toISOString() } },
      { sort: { createdAt: 1 }, returnDocument: 'after' }));
  }
  async updatePreview(id: string, fields: Partial<RecordingTask>) {
    return this.parse(await this.tasks.findOneAndUpdate({ _id: id },
      { $set: { ...fields, updatedAt: new Date().toISOString() } }, { returnDocument: 'after' }))!;
  }
  async addProgress(id: string, stage: TaskStage, message: string) {
    await this.tasks.updateOne({ _id: id }, { $push: { progress: { id: Date.now(), stage, message, createdAt: new Date().toISOString() } } });
  }
  async updateStage(id: string, status: TaskStage, fields: Partial<RecordingTask> = {}) {
    await this.updatePreview(id, { ...fields, status });
    const labels: Record<string, string> = {
      ASR_PROCESSING: '正在识别语音，转写文字会逐步出现', TEXT_CORRECTING: '正在根据上下文校准转写',
      TRANSCRIPT_REVIEWING: '正在核对同音词、专有名词和时间，生成校验说明',
      AGENT_RUNNING: '正在整理摘要并选择工具', RESULT_VALIDATING: '正在核验结果与额度',
    };
    await this.addProgress(id, status, labels[status] ?? status);
    return (await this.getTask(id))!;
  }
  async saveAnalysis(id: string, review: TranscriptReview, timeMentions: TimeMention[]) {
    return this.updatePreview(id, { review, timeMentions });
  }

  private async settleTask(id: string, success: boolean, fields: Partial<RecordingTask>) {
    const session = this.client.startSession();
    try {
      return (await session.withTransaction(async () => {
        const task = await this.tasks.findOne({ _id: id }, { session });
        if (!task) throw new Error('任务不存在');
        if (task.quotaState !== 'RESERVED') return this.parse(task)!;
        await this.quotas.updateOne({ _id: task.quotaDate },
          { $inc: { reserved: -1, used: success ? 1 : 0 } }, { session });
        await this.quotas.updateOne({ _id: task.quotaDate, used: { $gte: DAILY_LIMIT }, reserved: 0 },
          { $set: { used: 0 }, $inc: { completedRounds: 1 } }, { session });
        const updated = await this.tasks.findOneAndUpdate({ _id: id }, { $set: { ...fields,
          status: success ? 'COMPLETED' : 'FAILED', quotaState: success ? 'CONSUMED' : 'RELEASED', updatedAt: new Date().toISOString() } },
          { session, returnDocument: 'after' });
        return this.parse(updated)!;
      }))!;
    } finally { await session.endSession(); }
  }
  async completeTask(id: string, result: AgentResult) { return this.settleTask(id, true, result); }
  async failTask(id: string, message: string) { return this.settleTask(id, false, { error: message }); }

  async searchHistory(query: string) {
    const terms = query.trim().match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!terms.length) return [];
    const escaped = terms.join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (await this.tasks.find({ status: 'COMPLETED', deletedAt: { $exists: false },
      $or: [{ correctedTranscript: { $regex: escaped, $options: 'i' } }, { summary: { $regex: escaped, $options: 'i' } }] })
      .sort({ createdAt: -1 }).limit(5).toArray()).map(row => this.parse(row)!);
  }
}

const globalForStore = globalThis as unknown as { notaMongoStore?: TaskStore };
export function getStore() { return globalForStore.notaMongoStore ??= new TaskStore(); }
