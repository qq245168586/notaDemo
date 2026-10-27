import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuotaExceededError, TaskStore } from '@/server/store';
import { runClaimedTask } from '@/worker/pipeline';

let directory: string;
let store: TaskStore;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nota-test-'));
  store = new TaskStore(path.join(directory, 'test.sqlite'));
});

afterEach(() => {
  store.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('每日额度', () => {
  it('相同requestId幂等且第11个任务被拒绝', () => {
    const first = store.createTask({ requestId: 'same', audioPath: '/tmp/demo.m4a' });
    expect(store.createTask({ requestId: 'same', audioPath: '/tmp/other.m4a' }).id).toBe(first.id);

    for (let index = 1; index < 10; index += 1) {
      store.createTask({ requestId: `request-${index}`, audioPath: '/tmp/demo.m4a' });
    }
    expect(store.getQuota()).toMatchObject({ used: 0, reserved: 10, remaining: 0 });
    expect(() =>
      store.createTask({ requestId: 'request-11', audioPath: '/tmp/demo.m4a' }),
    ).toThrow(QuotaExceededError);
  });

  it('失败释放预占额度', () => {
    const task = store.createTask({ requestId: 'failure', audioPath: '/tmp/demo.m4a' });
    store.failTask(task.id, 'ASR失败');
    expect(store.getQuota()).toMatchObject({ used: 0, reserved: 0, remaining: 10 });
  });
});

describe('Mock流水线', () => {
  it('完成ASR、校准和至少两个Agent工具', async () => {
    const audioPath = path.join(directory, 'sample.m4a');
    fs.writeFileSync(audioPath, 'fake audio');
    store.createTask({ requestId: 'pipeline', audioPath });
    const claimed = store.claimNextTask();
    expect(claimed?.status).toBe('AUDIO_PROCESSING');

    const result = await runClaimedTask(store, claimed!.id, async () => {});
    expect(result.status).toBe('COMPLETED');
    expect(result.toolCalls.length).toBeGreaterThanOrEqual(2);
    expect(store.getQuota()).toMatchObject({ used: 1, reserved: 0, remaining: 9 });
  });
});
