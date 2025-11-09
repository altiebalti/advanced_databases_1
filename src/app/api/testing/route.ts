import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { UnitOfWork } from '@/lib/unitOfWork';

type LogEntry = { step: string; ok: boolean; detail?: any; error?: string };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const commit = (searchParams.get('commit') ?? '').toLowerCase() === 'true';

  const client = await getClient();
  const uow = new UnitOfWork(client);
  const logs: LogEntry[] = [];
  const results: Record<string, any> = {};

  try {
    await uow.begin();

    const preCounts = await uow.query<{ table: string; count: string }>(
      `
        SELECT 'users' AS table, COUNT(*)::text AS count FROM users
        UNION ALL
        SELECT 'courses', COUNT(*)::text FROM courses
        UNION ALL
        SELECT 'enrollments', COUNT(*)::text FROM enrollments
      `
    );
    results.preCounts = preCounts.rows;
    logs.push({ step: 'pre-counts', ok: true, detail: preCounts.rows });

    const activeCourses = await uow.query('SELECT * FROM v_active_courses LIMIT 10');
    results.v_active_courses = activeCourses.rows;
    logs.push({ step: 'view:v_active_courses', ok: true, detail: { rows: activeCourses.rowCount } });

    const courseStats = await uow.query('SELECT * FROM v_course_stats LIMIT 10');
    results.v_course_stats = courseStats.rows;
    logs.push({ step: 'view:v_course_stats', ok: true, detail: { rows: courseStats.rowCount } });

    const userRow = await uow.query<{ id: number }>('SELECT id FROM users ORDER BY id LIMIT 1');
    const courseRow = await uow.query<{ id: number }>(
      'SELECT id FROM courses WHERE is_deleted = FALSE ORDER BY id LIMIT 1'
    );
    const userId = userRow.rows[0]?.id ?? null;
    const courseId = courseRow.rows[0]?.id ?? null;

    if (userId && courseId) {
      await uow.query('CALL sp_enroll_user($1,$2)', [userId, courseId]);
      logs.push({ step: 'proc:sp_enroll_user', ok: true, detail: { userId, courseId } });
    } else {
      logs.push({ step: 'proc:sp_enroll_user', ok: false, error: 'Missing userId/courseId' });
    }

    const moduleIns = await uow.query<{ id: number }>(
      'INSERT INTO modules (course_id, title, order_index) VALUES ($1,$2,$3) RETURNING id',
      [courseId ?? 1, 'Test Module', 999]
    );
    const moduleId = moduleIns.rows[0]?.id;
    const lessonIns = await uow.query<{ id: number }>(
      'INSERT INTO lessons (module_id, title, content) VALUES ($1,$2,$3) RETURNING id',
      [moduleId, 'Test Lesson', '...']
    );
    const lessonId = lessonIns.rows[0]?.id;
    logs.push({ step: 'setup:module_lesson', ok: true, detail: { moduleId, lessonId } });

    if (userId && lessonId) {
      await uow.query('CALL sp_complete_lesson($1,$2)', [userId, lessonId]);
      logs.push({ step: 'proc:sp_complete_lesson', ok: true, detail: { userId, lessonId } });
    } else {
      logs.push({ step: 'proc:sp_complete_lesson', ok: false, error: 'Missing userId/lessonId' });
    }

    const assignmentIns = await uow.query<{ id: number }>(
      'INSERT INTO assignments (lesson_id, title, max_score) VALUES ($1,$2,$3) RETURNING id',
      [lessonId, 'Test Assignment', 100]
    );
    const assignmentId = assignmentIns.rows[0]?.id;
    logs.push({ step: 'setup:assignment', ok: true, detail: { assignmentId } });

    let submissionId: number | null = null;
    if (assignmentId && userId) {
      await uow.query('CALL sp_submit_assignment($1,$2,$3)', [assignmentId, userId, 'Test content']);
      const subSel = await uow.query<{ id: number }>(
        'SELECT id FROM submissions WHERE assignment_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 1',
        [assignmentId, userId]
      );
      submissionId = subSel.rows[0]?.id ?? null;
      logs.push({ step: 'proc:sp_submit_assignment', ok: true, detail: { assignmentId, submissionId } });
    } else {
      logs.push({ step: 'proc:sp_submit_assignment', ok: false, error: 'Missing assignmentId/userId' });
    }

    if (submissionId) {
      await uow.query('CALL sp_grade_submission($1,$2)', [submissionId, 90]);
      logs.push({ step: 'proc:sp_grade_submission', ok: true, detail: { submissionId } });
    } else {
      logs.push({ step: 'proc:sp_grade_submission', ok: false, error: 'Missing submissionId' });
    }

    if (courseId && userId) {
      await uow.query('CALL sp_add_review($1,$2,$3,$4)', [courseId, userId, 5, 'Great course!']);
      logs.push({ step: 'proc:sp_add_review', ok: true, detail: { courseId, userId } });
    } else {
      logs.push({ step: 'proc:sp_add_review', ok: false, error: 'Missing courseId/userId' });
    }

    if (courseId && userId) {
      await uow.query('CALL sp_process_payment($1,$2,$3)', [userId, courseId, 49.99]);
      logs.push({ step: 'proc:sp_process_payment', ok: true, detail: { courseId, userId } });
    } else {
      logs.push({ step: 'proc:sp_process_payment', ok: false, error: 'Missing courseId/userId' });
    }

    if (userId) {
      await uow.query('CALL sp_notify($1,$2)', [userId, 'Hello from /api/testing']);
      logs.push({ step: 'proc:sp_notify', ok: true, detail: { userId } });
    } else {
      logs.push({ step: 'proc:sp_notify', ok: false, error: 'Missing userId' });
    }

    if (courseId && userId) {
      await uow.query('CALL sp_update_course($1,$2,$3,$4)', [courseId, 'Updated Title (test)', 9.99, userId]);
      logs.push({ step: 'proc:sp_update_course', ok: true, detail: { courseId } });
    } else {
      logs.push({ step: 'proc:sp_update_course', ok: false, error: 'Missing courseId/userId' });
    }

    if (courseId && userId) {
      await uow.query('CALL sp_delete_course($1,$2)', [courseId, userId]);
      logs.push({ step: 'proc:sp_delete_course', ok: true, detail: { courseId } });
    } else {
      logs.push({ step: 'proc:sp_delete_course', ok: false, error: 'Missing courseId/userId' });
    }

    const enrollmentsView = await uow.query('SELECT * FROM v_user_enrollments WHERE user_id = $1 LIMIT 10', [userId ?? -1]);
    results.v_user_enrollments = enrollmentsView.rows;
    logs.push({ step: 'view:v_user_enrollments', ok: true, detail: { rows: enrollmentsView.rowCount } });

    if (commit) {
      await uow.commit();
      logs.push({ step: 'txn:commit', ok: true });
    } else {
      await uow.rollback();
      logs.push({ step: 'txn:rollback', ok: true });
    }

    return NextResponse.json(
      {
        commit,
        logs,
        results,
      },
      { status: 200 }
    );
  } catch (err: any) {
    await uow.rollback().catch(() => {});
    logs.push({ step: 'error', ok: false, error: err?.message ?? 'Internal error' });
    return NextResponse.json({ commit: false, logs, error: err?.message ?? 'Internal error' }, { status: 500 });
  } finally {
    client.release();
  }
}


