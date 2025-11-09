import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { UnitOfWork } from '@/lib/unitOfWork';
import { CourseRepository } from '@/repositories/CourseRepository';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const view = (searchParams.get('view') ?? 'active').toLowerCase();

  const client = await getClient();
  const uow = new UnitOfWork(client);
  try {
    const repo = new CourseRepository(uow);
    if (view === 'stats') {
      const result = await repo.getCourseStats();
      return NextResponse.json(result.rows, { status: 200 });
    }
    const result = await repo.getActiveCourses();
    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}


