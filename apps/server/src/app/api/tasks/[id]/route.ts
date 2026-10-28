import { NextResponse } from 'next/server';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const task = await getStore().getTask(id);
  if (!task || await getStore().isDeleted(id)) return NextResponse.json({ error: '任务不存在或已删除' }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await getStore().deleteTask(id);
  return new NextResponse(null, { status: 204 });
}
