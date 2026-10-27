import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appConfig } from '@/config/ai';
import { getStore, QuotaExceededError } from '@/server/store';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ tasks: getStore().listTasks() });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const audio = form.get('audio');
  const requestId = String(form.get('requestId') ?? '').trim();
  const transcriptHint = String(form.get('transcriptHint') ?? '').trim() || undefined;

  if (!requestId) {
    return NextResponse.json({ error: 'requestId不能为空' }, { status: 400 });
  }

  const store = getStore();
  const oldTask = store.findByRequestId(requestId);
  if (oldTask) {
    return NextResponse.json({
      taskId: oldTask.id,
      status: oldTask.status,
      remainingQuota: store.getQuota().remaining,
    });
  }

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: '请上传audio文件' }, { status: 400 });
  }

  const uploadsDir = path.join(appConfig.dataDir, 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  const extension = path.extname(audio.name).replace(/[^.a-zA-Z0-9]/g, '') || '.m4a';
  const audioPath = path.join(uploadsDir, `${randomUUID()}${extension}`);
  await fs.writeFile(audioPath, Buffer.from(await audio.arrayBuffer()));

  try {
    const task = store.createTask({ requestId, audioPath, transcriptHint });
    return NextResponse.json(
      {
        taskId: task.id,
        status: task.status,
        remainingQuota: store.getQuota().remaining,
      },
      { status: 202 },
    );
  } catch (error) {
    await fs.rm(audioPath, { force: true });
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
}
