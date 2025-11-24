import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const courseId = searchParams.get('courseId');
  const type = searchParams.get('type');
  const since = searchParams.get('since');
  const until = searchParams.get('until');

  const filters: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (userId !== null) {
    filters.push(`user_id = $${i++}`);
    params.push(Number(userId));
    if (Number.isNaN(params[params.length - 1])) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  }
  if (courseId !== null) {
    filters.push(`course_id = $${i++}`);
    params.push(Number(courseId));
    if (Number.isNaN(params[params.length - 1])) return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });
  }
  if (type) {
    filters.push(`type = $${i++}`);
    params.push(type);
  }
  if (since) {
    filters.push(`ts >= $${i++}`);
    params.push(new Date(since));
  }
  if (until) {
    filters.push(`ts <= $${i++}`);
    params.push(new Date(until));
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `SELECT id, user_id, course_id, type, metadata, ts
               FROM activity_events
               ${where}
               ORDER BY ts DESC
               LIMIT 500`;

  const client = await getClient();
  try {
    const result = await client.query(sql, params);
    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = Number(body?.userId);
  const courseId = body?.courseId === undefined ? null : Number(body?.courseId);
  const type = (body?.type ?? '').toString();
  const metadata = body?.metadata ?? null;

  if (Number.isNaN(userId) || !type) {
    return NextResponse.json({ error: 'userId and type are required' }, { status: 400 });
  }
  if (courseId !== null && Number.isNaN(courseId)) {
    return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 });
  }

  const client = await getClient();
  try {
    const result = await client.query(
      `INSERT INTO activity_events (user_id, course_id, type, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, courseId, type, metadata]
    );
    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}


