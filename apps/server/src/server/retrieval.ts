import { createHash } from 'node:crypto';
import { appConfig } from '@/config/ai';
import type { RecordingTask } from '@/domain/types';
import type { TaskStore } from '@/server/store';

type VectorDocument = { _id: string; taskId: string; model: string; hash: string; text: string; vector: number[] };
const signature = () => `${appConfig.ai.baseUrl}|${appConfig.embedding.model}|${appConfig.embedding.dimensions}`;

export async function embedText(text: string): Promise<number[]> {
  const response = await fetch(`${appConfig.ai.baseUrl}/embeddings`, {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${appConfig.ai.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: appConfig.embedding.model, input: [text], dimensions: appConfig.embedding.dimensions }),
  });
  if (!response.ok) throw new Error(`向量服务请求失败：HTTP ${response.status}`);
  const vector = (await response.json()).data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== appConfig.embedding.dimensions || !vector.every(Number.isFinite)) {
    throw new Error('向量服务返回维度不匹配');
  }
  return vector;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length) return 0;
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

export async function indexRecording(store: TaskStore, task: RecordingTask) {
  if (appConfig.ai.mode === 'mock' || task.status !== 'COMPLETED' || await store.isDeleted(task.id)) return;
  const collection = store.db.collection<VectorDocument>('recording_vectors');
  const text = task.correctedTranscript ?? task.rawTranscript ?? '';
  // Chunk original transcript rather than summary so names, amounts and dates remain available.
  const chunks = text.match(/[\s\S]{1,1200}/g) ?? [];
  const model = signature();
  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];
    const _id = `${task.id}:${index}`;
    const hash = createHash('sha256').update(chunk).digest('hex');
    if (await collection.findOne({ _id, hash, model })) continue;
    const vector = await embedText(chunk);
    if (await store.isDeleted(task.id)) return;
    await collection.replaceOne({ _id }, { taskId: task.id, model, hash, text: chunk, vector }, { upsert: true });
  }
  await collection.deleteMany({ taskId: task.id, _id: { $nin: chunks.map((_, index) => `${task.id}:${index}`) } });
}

export async function retrieveHistory(store: TaskStore, query: string, excludeId?: string) {
  const literal = (await store.searchHistory(query)).filter(task => task.id !== excludeId);
  if (appConfig.ai.mode === 'mock') return literal.map(task => toSource(task, task.correctedTranscript ?? '', null));
  try {
    const collection = store.db.collection<VectorDocument>('recording_vectors');
    const model = signature();
    if (!await collection.findOne({ model })) return literal.map(task => toSource(task, task.correctedTranscript ?? '', null));
    const queryVector = await embedText(query.slice(0, 1200));
    // Local MVP: exact cosine ranking in Node. MongoDB stores vectors; this is not a mongot ANN index.
    const candidates = await collection.find({ model, taskId: { $ne: excludeId ?? '' } }).toArray();
    const ranked = candidates.map(row => ({ ...row, score: cosineSimilarity(row.vector, queryVector) }))
      .filter(row => row.score >= 0.45).sort((a, b) => b.score - a.score);
    const results = literal.map(task => toSource(task, task.correctedTranscript ?? '', null));
    for (const row of ranked) {
      if (results.length >= 5) break;
      if (results.some(item => item.taskId === row.taskId) || await store.isDeleted(row.taskId)) continue;
      const task = await store.getTask(row.taskId);
      if (task?.status === 'COMPLETED') results.push(toSource(task, row.text, row.score));
    }
    return results.slice(0, 5);
  } catch {
    console.warn('向量检索暂不可用，回退关键词检索');
    return literal.map(task => toSource(task, task.correctedTranscript ?? '', null));
  }
}

function toSource(task: RecordingTask, transcript: string, similarity: number | null) {
  return { taskId: task.id, createdAt: task.createdAt, summary: task.summary, transcript, similarity };
}
