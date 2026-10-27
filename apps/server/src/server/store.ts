import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { appConfig } from '@/config/ai';
import { quotaDate } from '@/server/date';
import type {
  AgentResult,
  QuotaSnapshot,
  RecordingTask,
  TaskStage,
} from '@/domain/types';

const DAILY_LIMIT = 10;

type TaskRow = {
  id: string;
  request_id: string;
  status: TaskStage;
  audio_path: string;
  transcript_hint: string | null;
  raw_transcript: string | null;
  corrected_transcript: string | null;
  summary: string | null;
  todos_json: string;
  reminders_json: string;
  tool_calls_json: string;
  error: string | null;
  quota_date: string;
  quota_state: RecordingTask['quotaState'];
  created_at: string;
  updated_at: string;
};

export class QuotaExceededError extends Error {}

export class TaskStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        audio_path TEXT NOT NULL,
        transcript_hint TEXT,
        raw_transcript TEXT,
        corrected_transcript TEXT,
        summary TEXT,
        todos_json TEXT NOT NULL DEFAULT '[]',
        reminders_json TEXT NOT NULL DEFAULT '[]',
        tool_calls_json TEXT NOT NULL DEFAULT '[]',
        error TEXT,
        quota_date TEXT NOT NULL,
        quota_state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_quota (
        quota_date TEXT PRIMARY KEY,
        used INTEGER NOT NULL DEFAULT 0,
        reserved INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  close() {
    this.db.close();
  }

  private parse(row?: TaskRow): RecordingTask | undefined {
    if (!row) return undefined;
    return {
      id: row.id,
      requestId: row.request_id,
      status: row.status,
      audioPath: row.audio_path,
      transcriptHint: row.transcript_hint ?? undefined,
      rawTranscript: row.raw_transcript ?? undefined,
      correctedTranscript: row.corrected_transcript ?? undefined,
      summary: row.summary ?? undefined,
      todos: JSON.parse(row.todos_json),
      reminders: JSON.parse(row.reminders_json),
      toolCalls: JSON.parse(row.tool_calls_json),
      error: row.error ?? undefined,
      quotaDate: row.quota_date,
      quotaState: row.quota_state,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  getTask(id: string) {
    return this.parse(this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined);
  }

  findByRequestId(requestId: string) {
    return this.parse(
      this.db.prepare('SELECT * FROM tasks WHERE request_id = ?').get(requestId) as TaskRow | undefined,
    );
  }

  listTasks() {
    return (this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as TaskRow[]).map(
      (row) => this.parse(row)!,
    );
  }

  getQuota(day = quotaDate()): QuotaSnapshot {
    this.db
      .prepare('INSERT OR IGNORE INTO daily_quota(quota_date, used, reserved) VALUES (?, 0, 0)')
      .run(day);
    const row = this.db
      .prepare('SELECT used, reserved FROM daily_quota WHERE quota_date = ?')
      .get(day) as { used: number; reserved: number };
    return {
      limit: DAILY_LIMIT,
      used: row.used,
      reserved: row.reserved,
      remaining: Math.max(0, DAILY_LIMIT - row.used - row.reserved),
    };
  }

  createTask(input: {
    id?: string;
    requestId: string;
    audioPath: string;
    transcriptHint?: string;
  }) {
    return this.db.transaction(() => {
      const existing = this.findByRequestId(input.requestId);
      if (existing) return existing;

      const day = quotaDate();
      const quota = this.getQuota(day);
      if (quota.used + quota.reserved >= DAILY_LIMIT) {
        throw new QuotaExceededError('今日免费次数已用完');
      }

      const now = new Date().toISOString();
      const id = input.id ?? randomUUID();
      this.db
        .prepare('UPDATE daily_quota SET reserved = reserved + 1 WHERE quota_date = ?')
        .run(day);
      this.db
        .prepare(`
          INSERT INTO tasks(
            id, request_id, status, audio_path, transcript_hint,
            quota_date, quota_state, created_at, updated_at
          ) VALUES (?, ?, 'PENDING', ?, ?, ?, 'RESERVED', ?, ?)
        `)
        .run(id, input.requestId, input.audioPath, input.transcriptHint ?? null, day, now, now);
      return this.getTask(id)!;
    })();
  }

  claimNextTask() {
    return this.db.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM tasks WHERE status = 'PENDING' ORDER BY created_at LIMIT 1")
        .get() as TaskRow | undefined;
      if (!row) return undefined;
      const now = new Date().toISOString();
      this.db
        .prepare("UPDATE tasks SET status = 'AUDIO_PROCESSING', updated_at = ? WHERE id = ?")
        .run(now, row.id);
      return this.getTask(row.id);
    })();
  }

  updateStage(id: string, status: TaskStage, fields: Partial<RecordingTask> = {}) {
    this.db
      .prepare(`
        UPDATE tasks SET status = ?, raw_transcript = COALESCE(?, raw_transcript),
          corrected_transcript = COALESCE(?, corrected_transcript), updated_at = ?
        WHERE id = ?
      `)
      .run(
        status,
        fields.rawTranscript ?? null,
        fields.correctedTranscript ?? null,
        new Date().toISOString(),
        id,
      );
    return this.getTask(id)!;
  }

  completeTask(id: string, result: AgentResult) {
    return this.db.transaction(() => {
      const task = this.getTask(id);
      if (!task) throw new Error('任务不存在');
      if (task.quotaState !== 'RESERVED') return task;

      this.db
        .prepare(
          'UPDATE daily_quota SET reserved = reserved - 1, used = used + 1 WHERE quota_date = ?',
        )
        .run(task.quotaDate);
      this.db
        .prepare(`
          UPDATE tasks SET status = 'COMPLETED', summary = ?, todos_json = ?, reminders_json = ?,
            tool_calls_json = ?, quota_state = 'CONSUMED', updated_at = ? WHERE id = ?
        `)
        .run(
          result.summary,
          JSON.stringify(result.todos),
          JSON.stringify(result.reminders),
          JSON.stringify(result.toolCalls),
          new Date().toISOString(),
          id,
        );
      return this.getTask(id)!;
    })();
  }

  failTask(id: string, message: string) {
    return this.db.transaction(() => {
      const task = this.getTask(id);
      if (!task) throw new Error('任务不存在');
      if (task.quotaState === 'RESERVED') {
        this.db
          .prepare('UPDATE daily_quota SET reserved = reserved - 1 WHERE quota_date = ?')
          .run(task.quotaDate);
      }
      this.db
        .prepare(`
          UPDATE tasks SET status = 'FAILED', error = ?, quota_state = 'RELEASED', updated_at = ?
          WHERE id = ?
        `)
        .run(message, new Date().toISOString(), id);
      return this.getTask(id)!;
    })();
  }

  searchHistory(query: string) {
    const pattern = `%${query.replaceAll('%', '')}%`;
    return (
      this.db
        .prepare(`
          SELECT * FROM tasks
          WHERE status = 'COMPLETED' AND (corrected_transcript LIKE ? OR summary LIKE ?)
          ORDER BY created_at DESC LIMIT 5
        `)
        .all(pattern, pattern) as TaskRow[]
    ).map((row) => this.parse(row)!);
  }
}

const globalForStore = globalThis as unknown as { notaTaskStore?: TaskStore };

export function getStore() {
  if (!globalForStore.notaTaskStore) {
    globalForStore.notaTaskStore = new TaskStore(path.join(appConfig.dataDir, 'nota.sqlite'));
  }
  return globalForStore.notaTaskStore;
}
