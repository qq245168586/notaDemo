import fs from 'node:fs/promises';
import type { RecordingTask } from '@/domain/types';
import { prepareAudioForAsr } from '@/server/audio';
import { correctTranscript, runAgent, transcribeAudio } from '@/server/model';
import { safePublishTaskStatus } from '@/server/mqtt';
import type { TaskStore } from '@/server/store';
import { retrieveHistory, indexRecording } from '@/server/retrieval';
import { analyzeTranscript } from '@/server/transcript-analysis';

type Publisher = (task: RecordingTask) => Promise<void>;

const pause = () => new Promise((resolve) => setTimeout(resolve, 250));

export async function runClaimedTask(
  store: TaskStore,
  taskId: string,
  publish: Publisher = safePublishTaskStatus,
) {
  let task = await store.getTask(taskId);
  if (!task) throw new Error('任务不存在');

  // 快照落库后再通知；每 200ms 合并一次模型增量，断线后 HTTP 可取回。
  function textPreview(field: 'rawTranscript' | 'correctedTranscript' | 'summary', prefix = '') {
    let last = 0;
    return async (text: string) => {
      if (Date.now() - last < 200) return;
      last = Date.now();
      task = await store.updatePreview(taskId, { [field]: prefix + text });
      await publish(task);
    };
  }

  try {
    await store.addProgress(task.id, 'AUDIO_PROCESSING', '录音已上传，正在准备音频');
    task = (await store.getTask(task.id))!;
    await publish(task);
    await fs.access(task.audioPath);
    const asrAudioPaths = await prepareAudioForAsr(task.audioPath);
    await pause();

    task = await store.updateStage(task.id, 'ASR_PROCESSING');
    await publish(task);
    const transcriptParts: string[] = [];
    for (const asrAudioPath of asrAudioPaths) {
      const prefix = transcriptParts.length ? transcriptParts.join('\n') + '\n' : '';
      transcriptParts.push(await transcribeAudio(task, asrAudioPath, textPreview('rawTranscript', prefix)));
      task = await store.updatePreview(task.id, { rawTranscript: transcriptParts.join('\n') });
      await publish(task);
    }
    const rawTranscript = transcriptParts.join('\n');

    task = await store.updateStage(task.id, 'TEXT_CORRECTING', { rawTranscript });
    await publish(task);
    const references = await retrieveHistory(store, rawTranscript, task.id);
    await store.addProgress(task.id, 'TEXT_CORRECTING', references.length
      ? `召回 ${references.length} 条历史原文作为术语参考（不代表本次录音事实）：${references.map(item => item.taskId).join('、')}`
      : '未找到可用历史参考，按当前录音文本校准');
    const correctedTranscript = await correctTranscript(rawTranscript, textPreview('correctedTranscript'), references);

    task = await store.updateStage(task.id, 'TRANSCRIPT_REVIEWING', { correctedTranscript });
    await publish(task);
    try {
      const { review, timeMentions } = await analyzeTranscript(task);
      task = await store.saveAnalysis(task.id, review, timeMentions);
      await store.addProgress(task.id, 'TRANSCRIPT_REVIEWING', review.summary);
      for (const finding of review.findings) {
        await store.addProgress(task.id, 'TRANSCRIPT_REVIEWING', `${finding.decision}：「${finding.original}」${finding.candidate ? `，候选「${finding.candidate}」` : ''}。${finding.evidence}`);
      }
      task = (await store.getTask(task.id))!;
      await publish(task);
    } catch {
      await store.addProgress(task.id, 'TRANSCRIPT_REVIEWING', '校验说明暂不可用，转写结果仍可查看，完成后可重试校验');
    }

    task = await store.updateStage(task.id, 'AGENT_RUNNING');
    await publish(task);
    const result = await runAgent(store, correctedTranscript, {
      onText: textPreview('summary'),
      onTool: async (calls) => {
        const current = calls[calls.length - 1];
        await store.addProgress(taskId, 'AGENT_RUNNING', `已调用工具：${current.name}`);
        task = await store.updatePreview(taskId, { toolCalls: calls });
        await publish(task);
      },
    });

    task = await store.updateStage(task.id, 'RESULT_VALIDATING');
    await publish(task);
    if (!result.summary.trim()) throw new Error('摘要为空');

    await store.addProgress(task.id, 'COMPLETED', '处理完成，结果已保存');
    task = await store.completeTask(task.id, result);
    await publish(task);
    try { await indexRecording(store, task); } catch { console.warn('历史向量索引暂未完成，可运行 history:index 重试'); }
    return task;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知处理错误';
    await store.addProgress(task.id, 'FAILED', message);
    task = await store.failTask(task.id, message);
    await publish(task);
    return task;
  }
}
