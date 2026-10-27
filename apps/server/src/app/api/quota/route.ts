import { NextResponse } from 'next/server';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(getStore().getQuota());
}
