import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { UnitOfWork } from '@/lib/unitOfWork';

type ProcHandler = (uow: UnitOfWork, body: any) => Promise<any>;

const procedures: Record<string, ProcHandler> = {
  sp_enroll_user: async (uow, body) => {
    const userId = Number(body?.userId);
    const courseId = Number(body?.courseId);
    if (Number.isNaN(userId) || Number.isNaN(courseId)) throw new Error('userId and courseId are required numbers');
    await uow.query('CALL sp_enroll_user($1,$2)', [userId, courseId]);
    return { ok: true };
  },
  sp_delete_course: async (uow, body) => {
    const courseId = Number(body?.courseId);
    const userId = Number(body?.userId);
    if (Number.isNaN(courseId) || Number.isNaN(userId)) throw new Error('courseId and userId are required numbers');
    await uow.query('CALL sp_delete_course($1,$2)', [courseId, userId]);
    return { ok: true };
  },
  sp_complete_lesson: async (uow, body) => {
    const userId = Number(body?.userId);
    const lessonId = Number(body?.lessonId);
    if (Number.isNaN(userId) || Number.isNaN(lessonId)) throw new Error('userId and lessonId are required numbers');
    await uow.query('CALL sp_complete_lesson($1,$2)', [userId, lessonId]);
    return { ok: true };
  },
  sp_submit_assignment: async (uow, body) => {
    const assignmentId = Number(body?.assignmentId);
    const userId = Number(body?.userId);
    const content = String(body?.content ?? '');
    if (Number.isNaN(assignmentId) || Number.isNaN(userId) || content.length === 0) throw new Error('assignmentId, userId and non-empty content are required');
    await uow.query('CALL sp_submit_assignment($1,$2,$3)', [assignmentId, userId, content]);
    return { ok: true };
  },
  sp_grade_submission: async (uow, body) => {
    const submissionId = Number(body?.submissionId);
    const score = Number(body?.score);
    if (Number.isNaN(submissionId) || Number.isNaN(score)) throw new Error('submissionId and score are required numbers');
    await uow.query('CALL sp_grade_submission($1,$2)', [submissionId, score]);
    return { ok: true };
  },
  sp_add_review: async (uow, body) => {
    const courseId = Number(body?.courseId);
    const userId = Number(body?.userId);
    const rating = Number(body?.rating);
    const comment = String(body?.comment ?? '');
    if (Number.isNaN(courseId) || Number.isNaN(userId) || Number.isNaN(rating)) throw new Error('courseId, userId and rating are required numbers');
    await uow.query('CALL sp_add_review($1,$2,$3,$4)', [courseId, userId, rating, comment]);
    return { ok: true };
  },

  sp_process_payment: async (uow, body) => {
    const userId = Number(body?.userId);
    const courseId = Number(body?.courseId);
    const amount = Number(body?.amount);
    if (Number.isNaN(userId) || Number.isNaN(courseId) || Number.isNaN(amount)) throw new Error('userId, courseId and amount are required numbers');
    await uow.query('CALL sp_process_payment($1,$2,$3)', [userId, courseId, amount]);
    return { ok: true };
  },
  sp_notify: async (uow, body) => {
    const userId = Number(body?.userId);
    const message = String(body?.message ?? '');
    if (Number.isNaN(userId) || message.length === 0) throw new Error('userId and non-empty message are required');
    await uow.query('CALL sp_notify($1,$2)', [userId, message]);
    return { ok: true };
  },
  sp_update_course: async (uow, body) => {
    const courseId = Number(body?.courseId);
    const title = String(body?.title ?? '');
    const price = Number(body?.price);
    const userId = Number(body?.userId);
    if (Number.isNaN(courseId) || title.length === 0 || Number.isNaN(price) || Number.isNaN(userId)) {
      throw new Error('courseId, title, price and userId are required');
    }
    await uow.query('CALL sp_update_course($1,$2,$3,$4)', [courseId, title, price, userId]);
    return { ok: true };
  },
};

export async function POST(req: NextRequest, context: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await context.params;
  const name = (rawName ?? '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(procedures, name)) {
    return NextResponse.json({ error: 'Unknown procedure name' }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const client = await getClient();
  const uow = new UnitOfWork(client);
  try {
    await uow.begin();
    const result = await procedures[name](uow, body);
    await uow.commit();
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    await uow.rollback().catch(() => {});
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 400 });
  } finally {
    client.release();
  }
}


