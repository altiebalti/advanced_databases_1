import { NextRequest, NextResponse } from 'next/server';
import { getCollection, ActivityEventDoc } from '@/lib/mongo';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const courseId = searchParams.get('courseId');
  const type = searchParams.get('type') ?? undefined;
  const since = searchParams.get('since');
  const until = searchParams.get('until');

  const filter: Record<string, any> = {};
  if (userId !== null) filter.userId = Number(userId);
  if (courseId !== null) filter.courseId = Number(courseId);
  if (type) filter.type = type;
  if (since || until) {
    filter.ts = {};
    if (since) filter.ts.$gte = new Date(since);
    if (until) filter.ts.$lte = new Date(until);
  }

  if (filter.userId !== undefined && Number.isNaN(filter.userId)) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  }
  if (filter.courseId !== undefined && Number.isNaN(filter.courseId)) {
    return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });
  }

  try {
    const col = await getCollection<ActivityEventDoc>('activity_events');
    const docs = await col.find(filter).sort({ ts: -1 }).limit(500).toArray();
    return NextResponse.json(docs, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = Number(body?.userId);
  const courseId = body?.courseId === undefined ? undefined : Number(body?.courseId);
  const type = (body?.type ?? '').toString();
  const metadata = (body?.metadata ?? {}) as Record<string, unknown>;

  if (Number.isNaN(userId) || !type) {
    return NextResponse.json({ error: 'userId and type are required' }, { status: 400 });
  }
  if (courseId !== undefined && Number.isNaN(courseId)) {
    return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });
  }

  try {
    const col = await getCollection<ActivityEventDoc>('activity_events');
    const doc: ActivityEventDoc = {
      userId,
      courseId,
      type,
      metadata,
      ts: new Date(),
    };
    const res = await col.insertOne(doc);
    return NextResponse.json({ insertedId: res.insertedId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}


