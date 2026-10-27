import { NextResponse } from 'next/server';
import { answerHistoryQuestion } from '@/server/model';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json();
  const question = String(body.question ?? '').trim();
  if (!question) return NextResponse.json({ error: 'question不能为空' }, { status: 400 });
  return NextResponse.json(await answerHistoryQuestion(getStore(), question));
}
