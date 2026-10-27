import { getStore } from '@/server/store';
import { runClaimedTask } from '@/worker/pipeline';

const store = getStore();
let busy = false;

async function tick() {
  if (busy) return;
  const task = store.claimNextTask();
  if (!task) return;

  busy = true;
  console.log(`开始处理任务 ${task.id}`);
  try {
    const result = await runClaimedTask(store, task.id);
    console.log(`任务 ${task.id} -> ${result.status}`);
  } finally {
    busy = false;
  }
}

console.log('Nota Worker 已启动');
setInterval(() => void tick(), 800);
void tick();
