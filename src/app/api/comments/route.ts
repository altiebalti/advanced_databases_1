import { NextRequest, NextResponse } from 'next/server';
import { getCollection, CommentDoc } from '@/lib/mongo';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lessonIdParam = searchParams.get('lessonId');
  if (!lessonIdParam) {
    return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 });
  }
  const lessonId = Number(lessonIdParam);
  if (Number.isNaN(lessonId)) {
    return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 });
  }
  try {
    const col = await getCollection<CommentDoc>('comments');
    const docs = await col
      .find({ lessonId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return NextResponse.json(docs, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lessonId = Number(body?.lessonId);
  const userId = Number(body?.userId);
  const content = (body?.content ?? '').toString();

  if (Number.isNaN(lessonId) || Number.isNaN(userId) || !content) {
    return NextResponse.json({ error: 'lessonId, userId and content are required' }, { status: 400 });
  }

  try {
    const col = await getCollection<CommentDoc>('comments');
    const doc: CommentDoc = {
      lessonId,
      userId,
      content,
      createdAt: new Date(),
    };
    const res = await col.insertOne(doc);
    return NextResponse.json({ insertedId: res.insertedId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}


