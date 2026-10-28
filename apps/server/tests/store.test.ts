import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuotaExceededError, TaskStore } from '@/server/store';
import { removeUnsupportedYears } from '@/server/model';
import { runClaimedTask } from '@/worker/pipeline';

let directory: string;
let store: TaskStore;

beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nota-test-'));
  store = new TaskStore(undefined, `nota_test_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  await store.initialize();
});

afterEach(async () => {
  await store.db.dropDatabase();
  await store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('本轮额度', () => {
  it('相同requestId幂等且第11个任务被拒绝', async () => {
    const first = await store.createTask({ requestId: 'same', audioPath: '/tmp/demo.m4a' });
    expect((await store.createTask({ requestId: 'same', audioPath: '/tmp/other.m4a' })).id).toBe(first.id);

    for (let index = 1; index < 10; index += 1) {
      await store.createTask({ requestId: `request-${index}`, audioPath: '/tmp/demo.m4a' });
    }
    expect(await store.getQuota()).toMatchObject({ used: 0, reserved: 10, remaining: 0 });
    await expect(
      store.createTask({ requestId: 'request-11', audioPath: '/tmp/demo.m4a' }),
    ).rejects.toThrow(QuotaExceededError);
  });

  it('失败释放预占额度', async () => {
    const task = await store.createTask({ requestId: 'failure', audioPath: '/tmp/demo.m4a' });
    await store.failTask(task.id, 'ASR失败');
    expect(await store.getQuota()).toMatchObject({ used: 0, reserved: 0, remaining: 10 });
  });
});

describe('Mock流水线', () => {
  it('完成ASR、校准和至少两个Agent工具', async () => {
    const audioPath = path.join(directory, 'sample.m4a');
    fs.writeFileSync(audioPath, 'fake audio');
    await store.createTask({ requestId: 'pipeline', audioPath });
    const claimed = await store.claimNextTask();
    expect(claimed?.status).toBe('AUDIO_PROCESSING');

    const result = await runClaimedTask(store, claimed!.id, async () => {});
    expect(result.status).toBe('COMPLETED');
    expect(result.toolCalls.length).toBeGreaterThanOrEqual(2);
    expect(result.progress.map((entry) => entry.stage)).toContain('ASR_PROCESSING');
    expect(result.progress.at(-1)?.stage).toBe('COMPLETED');
    expect(await store.getQuota()).toMatchObject({ used: 1, reserved: 0, remaining: 9 });
  });
});

describe('摘要事实校验', () => {
  it('移除原文没有的年份，并保留原文明确给出的年份', async () => {
    expect(removeUnsupportedYears('项目在6月30日结束', '项目在2024年6月30日结束')).toBe(
      '项目在6月30日结束',
    );
    expect(removeUnsupportedYears('项目在2025年结束', '项目在2025年结束')).toBe(
      '项目在2025年结束',
    );
  });
});


describe('MongoDB 并发与删除', () => {
  const result = { summary: '报价为100元', todos: [], reminders: [], toolCalls: [] };
  it('并发12个请求最多预占10次，相同requestId只建一次', async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, i) =>
      store.createTask({ requestId: `parallel-${i}`, audioPath: '/tmp/demo.m4a' })));
    expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(10);
    expect(await store.getQuota()).toMatchObject({ used: 0, reserved: 10 });
  });
  it('并发重试、重复完成、延迟失败都不重复扣费', async () => {
    const tasks = await Promise.all(Array.from({ length: 6 }, () => store.createTask({ requestId: 'retry', audioPath: '/tmp/demo.m4a' })));
    expect(new Set(tasks.map(task => task.id)).size).toBe(1);
    await Promise.all(tasks.map(task => store.completeTask(task.id, result)));
    await store.failTask(tasks[0].id, 'late callback');
    expect(await store.getQuota()).toMatchObject({ used: 1, reserved: 0 });
    expect((await store.getTask(tasks[0].id))?.status).toBe('COMPLETED');
  });
  it('处理中删除不复活，结算仍正常，历史检索排除已删除任务', async () => {
    const task = await store.createTask({ requestId: 'delete', audioPath: '/tmp/demo.m4a' });
    await store.deleteTask(task.id);
    await store.deleteTask(task.id);
    await store.completeTask(task.id, result);
    expect(await store.listTasks()).toEqual([]);
    expect(await store.searchHistory('报价')).toEqual([]);
    expect(await store.getQuota()).toMatchObject({ used: 1, reserved: 0 });
    expect((await store.createTask({ requestId: 'delete', audioPath: '/tmp/other.m4a' })).id).toBe(task.id);
  });
});


it('同一规则下每完成10次自动归零，第11次可继续使用', async () => {
  for (let i = 0; i < 10; i++) {
    const task = await store.createTask({ requestId: `cycle-${i}`, audioPath: '/tmp/demo.m4a' });
    await store.completeTask(task.id, { summary: '完成', todos: [], reminders: [], toolCalls: [] });
  }
  expect(await store.getQuota()).toMatchObject({ used: 0, reserved: 0, remaining: 10 });
  const next = await store.createTask({ requestId: 'cycle-11', audioPath: '/tmp/demo.m4a' });
  await store.completeTask(next.id, { summary: '下一轮', todos: [], reminders: [], toolCalls: [] });
  expect(await store.getQuota()).toMatchObject({ used: 1, reserved: 0, remaining: 9 });
});
