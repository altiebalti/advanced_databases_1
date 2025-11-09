import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { UnitOfWork } from '@/lib/unitOfWork';
import { LessonRepository } from '@/repositories/LessonRepository';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action !== 'complete') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const userId = Number(body?.userId);
  const lessonId = Number(body?.lessonId);
  if (Number.isNaN(userId) || Number.isNaN(lessonId)) {
    return NextResponse.json({ error: 'userId and lessonId are required numbers' }, { status: 400 });
  }

  const client = await getClient();
  const uow = new UnitOfWork(client);
  try {
    await uow.begin();
    const repo = new LessonRepository(uow);
    await repo.completeLesson(userId, lessonId);
    await uow.commit();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    await uow.rollback().catch(() => {});
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Not implemented' }, { status: 405 });
}

