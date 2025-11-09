import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { UnitOfWork } from '@/lib/unitOfWork';
import { UserRepository } from '@/repositories/UserRepository';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get('userId');
  if (!userIdParam) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const userId = Number(userIdParam);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  }

  const client = await getClient();
  const uow = new UnitOfWork(client);
  try {
    const repo = new UserRepository(uow);
    const result = await repo.getUserEnrollments(userId);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action !== 'enroll') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  }

  const userId = Number(body?.userId);
  const courseId = Number(body?.courseId);

  if (Number.isNaN(userId) || Number.isNaN(courseId)) {
    return NextResponse.json({ error: 'userId and courseId are required numbers' }, { status: 400 });
  }

  const client = await getClient();
  const uow = new UnitOfWork(client);
  try {
    await uow.begin();
    const repo = new UserRepository(uow);
    await repo.enrollUser(userId, courseId);
    await uow.commit();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    await uow.rollback().catch(() => {});
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}

