import { NextResponse } from 'next/server';
import { getStore } from '@/server/store';
import { analyzeTranscript } from '@/server/transcript-analysis';
import { safePublishTaskStatus } from '@/server/mqtt';

export const runtime = 'nodejs';
const pending = new Map<string, Promise<void>>();

// 旧录音按需补充本条说明，不重跑ASR、不新建任务、不重复扣免费额度。
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const store = getStore();
  const task = await store.getTask(id);
  if (!task || await store.isDeleted(id)) return NextResponse.json({ error: '任务不存在或已删除' }, { status: 404 });
  if (task.status !== 'COMPLETED') return NextResponse.json({ error: '请等待转写处理完成' }, { status: 409 });
  try {
    const options = await request.json().catch(() => ({}));
    if (!task.review || options.force === true) {
      let job = pending.get(id);
      if (!job) {
        job = (async () => {
          const { review, timeMentions } = await analyzeTranscript(task);
          const updated = await store.saveAnalysis(id, review, timeMentions);
          await safePublishTaskStatus(updated);
        })().finally(() => { pending.delete(id); });
        pending.set(id, job);
      }
      await job;
    }
    return NextResponse.json({ task: await store.getTask(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '校验暂不可用，请重试' }, { status: 502 });
  }
}
