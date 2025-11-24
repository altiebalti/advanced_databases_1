import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lessonIdParam = searchParams.get('lessonId');
  if (!lessonIdParam) return NextResponse.json({ error: 'Missing lessonId' }, { status: 400 });
  const lessonId = Number(lessonIdParam);
  if (Number.isNaN(lessonId)) return NextResponse.json({ error: 'Invalid lessonId' }, { status: 400 });

  const client = await getClient();
  try {
    const result = await client.query(
      `SELECT id, lesson_id, user_id, content, updated_at
       FROM discussions
       WHERE lesson_id = $1 AND is_deleted = FALSE
       ORDER BY updated_at DESC
       LIMIT 200`,
      [lessonId]
    );
    return NextResponse.json(result.rows, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
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

  const client = await getClient();
  try {
    const result = await client.query(
      `INSERT INTO discussions (lesson_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [lessonId, userId, content]
    );
    return NextResponse.json({ id: result.rows[0]?.id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}


