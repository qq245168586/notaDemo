import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { appConfig } from '../src/config/ai';
import { TaskStore as LegacyStore } from '../src/server/legacy-sqlite-store';
import { TaskStore } from '../src/server/store';

async function main() {
  const filename = path.join(appConfig.dataDir, 'nota.sqlite');
  const reader = new Database(filename, { readonly: true, fileMustExist: true });
  const backup = `${filename}.backup-${Date.now()}`;
  await reader.backup(backup);
  const legacy = new LegacyStore(filename);
  const rows = reader.prepare('SELECT id FROM tasks ORDER BY id').all() as { id: string }[];
  const tasks = rows.map(row => ({ ...legacy.getTask(row.id)!, _id: row.id,
    ...(legacy.isDeleted(row.id) ? { deletedAt: new Date().toISOString() } : {}) }));
  const quotas = (reader.prepare('SELECT * FROM daily_quota').all() as { quota_date: string; used: number; reserved: number }[])
    .map(row => ({ _id: row.quota_date, used: row.used, reserved: row.reserved }));
  reader.close(); legacy.close();
  const store = new TaskStore();
  await store.initialize();
  const session = store.client.startSession();
  try {
    if (await store.db.collection('tasks').countDocuments() || await store.db.collection('daily_quota').countDocuments()) {
      throw new Error('目标数据库已有数据，停止迁移，避免覆盖。');
    }
    await session.withTransaction(async () => {
      if (tasks.length) await store.db.collection<(typeof tasks)[number]>('tasks').insertMany(tasks, { session });
      if (quotas.length) await store.db.collection<(typeof quotas)[number]>('daily_quota').insertMany(quotas, { session });
    });
    const actual = await store.db.collection('tasks').find().sort({ id: 1 }).toArray();
    if (!isDeepStrictEqual(JSON.parse(JSON.stringify(tasks)), actual)) throw new Error('任务逐字段核对不一致');
    const actualQuotas = await store.db.collection('daily_quota').find().toArray();
    if (!isDeepStrictEqual(quotas, actualQuotas)) throw new Error('额度核对不一致');
    for (const task of tasks) await fs.access(task.audioPath);
    const report = { migratedAt: new Date().toISOString(), database: store.db.databaseName,
      tasks: tasks.length, quotaDays: quotas.length, progress: tasks.reduce((sum, task) => sum + task.progress.length, 0),
      reviews: tasks.filter(task => task.review).length, backup, verified: '逐字段一致，音频文件全部存在' };
    await fs.writeFile(path.join(appConfig.dataDir, 'mongo-migration-report.json'), JSON.stringify(report, null, 2));
    console.log(report);
  } finally { await session.endSession(); await store.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
