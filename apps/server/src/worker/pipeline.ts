import fs from 'node:fs/promises';
import type { RecordingTask } from '@/domain/types';
import { prepareAudioForAsr } from '@/server/audio';
import { correctTranscript, runAgent, transcribeAudio } from '@/server/model';
import { safePublishTaskStatus } from '@/server/mqtt';
import type { TaskStore } from '@/server/store';

type Publisher = (task: RecordingTask) => Promise<void>;

const pause = () => new Promise((resolve) => setTimeout(resolve, 250));

export async function runClaimedTask(
  store: TaskStore,
  taskId: string,
  publish: Publisher = safePublishTaskStatus,
) {
  let task = store.getTask(taskId);
  if (!task) throw new Error('任务不存在');

  try {
    await publish(task);
    await fs.access(task.audioPath);
    const asrAudioPaths = await prepareAudioForAsr(task.audioPath);
    await pause();

    task = store.updateStage(task.id, 'ASR_PROCESSING');
    await publish(task);
    const transcriptParts: string[] = [];
    for (const asrAudioPath of asrAudioPaths) {
      transcriptParts.push(await transcribeAudio(task, asrAudioPath));
    }
    const rawTranscript = transcriptParts.join('\n');

    task = store.updateStage(task.id, 'TEXT_CORRECTING', { rawTranscript });
    await publish(task);
    const correctedTranscript = await correctTranscript(rawTranscript);

    task = store.updateStage(task.id, 'AGENT_RUNNING', { correctedTranscript });
    await publish(task);
    const result = await runAgent(store, correctedTranscript);

    task = store.updateStage(task.id, 'RESULT_VALIDATING');
    await publish(task);
    if (!result.summary.trim()) throw new Error('摘要为空');

    task = store.completeTask(task.id, result);
    await publish(task);
    return task;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知处理错误';
    task = store.failTask(task.id, message);
    await publish(task);
    return task;
  }
}
