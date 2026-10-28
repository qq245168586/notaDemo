import { getStore } from '@/server/store';
import { runClaimedTask } from '@/worker/pipeline';

const store = getStore();
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    await store.initialize();
    const task = await store.claimNextTask();
    if (!task) return;
    console.log(`开始处理任务 ${task.id}`);
    const result = await runClaimedTask(store, task.id);
    console.log(`任务 ${task.id} -> ${result.status}`);
  } catch (error) {
    console.error('Worker处理失败', error instanceof Error ? error.message : error);
  } finally { busy = false; }
}
console.log('Nota Worker 已启动（MongoDB）');
setInterval(() => void tick(), 800);
void tick();
