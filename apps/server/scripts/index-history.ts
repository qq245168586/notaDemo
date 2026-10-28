import { getStore } from '../src/server/store';
import { indexRecording } from '../src/server/retrieval';

async function main() {
  const store = getStore();
  try {
    for (const task of await store.listTasks()) {
      if (task.status !== 'COMPLETED') continue;
      await indexRecording(store, task);
      console.log(`已索引 ${task.id}`);
    }
    console.log('历史向量数量', await store.db.collection('recording_vectors').countDocuments());
  } finally { await store.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
