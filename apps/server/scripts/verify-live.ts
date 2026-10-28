// 用短音频验证真实模型和 MQTT 状态链路：npx tsx scripts/verify-live.ts /tmp/test.m4a
import fs from 'node:fs/promises';
import mqtt from 'mqtt';

async function main() {
const file = process.argv[2];
if (!file) throw new Error('请提供一段测试音频的路径');
const base = 'http://127.0.0.1:3000';
const client = mqtt.connect('mqtt://127.0.0.1:1883', { clientId: `nota-live-check-${Date.now()}` });
const notifications = new Set<string>();
const observed = new Set<string>();
let taskId = '';

try {
  await new Promise<void>((resolve, reject) => {
    client.once('error', reject);
    client.once('connect', () => client.subscribe('nota/tasks/+/status', { qos: 1 }, (error) => error ? reject(error) : resolve()));
  });
  client.on('message', (_topic, payload) => {
    const event = JSON.parse(payload.toString());
    if (event.taskId === taskId) notifications.add(event.stage);
  });
  const form = new FormData();
  form.set('requestId', `stream-check-${Date.now()}`);
  form.set('audio', new Blob([await fs.readFile(file)]), 'test.m4a');
  const response = await fetch(`${base}/api/tasks`, { method: 'POST', body: form });
  const created = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(created));
  taskId = created.taskId;
  console.log(`任务 ${taskId}`);
  let last = '';
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const { task } = await (await fetch(`${base}/api/tasks/${taskId}`)).json();
    const snapshot = `${task.status} 转写=${task.rawTranscript?.length ?? 0} 校准=${task.correctedTranscript?.length ?? 0} 摘要=${task.summary?.length ?? 0}`;
    if (snapshot !== last) { console.log(snapshot); observed.add(snapshot); last = snapshot; }
    if (task.status === 'FAILED') throw new Error(task.error);
    if (task.status === 'COMPLETED') {
      console.log(`PASS: 阶段记录=${task.progress.length}, 变化快照=${observed.size}, MQTT通知=${[...notifications].join(',')}`);
      console.log(`最终额度 ${JSON.stringify(await (await fetch(`${base}/api/quota`)).json())}`);
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!last.startsWith('COMPLETED')) throw new Error('测试超时');
} finally {
  client.end(true);
}
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
