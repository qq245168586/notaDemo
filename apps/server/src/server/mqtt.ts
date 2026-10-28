import mqtt, { type MqttClient } from 'mqtt';
import { appConfig } from '@/config/ai';
import type { RecordingTask } from '@/domain/types';

let client: MqttClient | undefined;

function getClient() {
  client ??= mqtt.connect(appConfig.mqttUrl, {
    clientId: `nota-worker-${process.pid}`,
    reconnectPeriod: 1_000,
  });
  return client;
}

export async function publishTaskStatus(task: RecordingTask) {
  const payload = JSON.stringify({
    taskId: task.id,
    stage: task.status,
    updatedAt: task.updatedAt,
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MQTT通知超时')), 1500);
    getClient().publish(`nota/tasks/${task.id}/status`, payload, { qos: 1, retain: true }, (error) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function safePublishTaskStatus(task: RecordingTask) {
  try {
    await publishTaskStatus(task);
  } catch (error) {
    console.warn('MQTT通知失败，任务结果仍保存在数据库中。', error);
  }
}
