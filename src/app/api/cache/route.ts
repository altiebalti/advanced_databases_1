import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  const leaderboard = searchParams.get('leaderboard');
  const top = Number(searchParams.get('top') ?? '10');
  const client = await getRedis();
  try {
    if (leaderboard) {
      const entries = await client.zRangeWithScores(leaderboard, -top, -1);
      return NextResponse.json(entries.reverse(), { status: 200 });
    }
    if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
    const val = await client.get(key);
    return NextResponse.json({ key, value: val }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = (body?.mode ?? 'set').toString();
  const client = await getRedis();
  try {
    if (mode === 'set') {
      const key = (body?.key ?? '').toString();
      const value = (body?.value ?? '').toString();
      if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
      await client.set(key, value);
      return NextResponse.json({ ok: true }, { status: 201 });
    }
    if (mode === 'zincr') {
      const leaderboard = (body?.leaderboard ?? '').toString();
      const member = (body?.member ?? '').toString();
      const by = Number(body?.by ?? 1);
      if (!leaderboard || !member) return NextResponse.json({ error: 'leaderboard and member required' }, { status: 400 });
      const score = await client.zIncrBy(leaderboard, by, member);
      return NextResponse.json({ member, score }, { status: 201 });
    }
    return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}


