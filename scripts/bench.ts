/* eslint-disable no-console */
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';

type BenchResult = {
  name: string;
  insertsMs: number;
  queryMs: number;
  count: number;
};

function hrtimeMs(start: bigint, end: bigint): number {
  return Number(end - start) / 1_000_000;
}

async function ensureUsers(pg: Pool, count: number): Promise<number[]> {
  const existing = await pg.query<{ id: number }>(
    `SELECT id FROM users ORDER BY id ASC`
  );
  const userIds: number[] = existing.rows.map(r => r.id);
  if (userIds.length < count) {
    const toCreate = count - userIds.length;
    await pg.query('BEGIN');
    try {
      for (let i = 0; i < toCreate; i++) {
        const idx = userIds.length + i + 1;
        const res = await pg.query<{ id: number }>(
          `INSERT INTO users (email, password_hash, name, role)
           VALUES ($1, 'x', $2, 'student')
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [`bench-student-${idx}@example.com`, `Bench Student ${idx}`]
        );
        if (!userIds.includes(res.rows[0].id)) {
          userIds.push(res.rows[0].id);
        }
      }
      await pg.query('COMMIT');
    } catch (e) {
      await pg.query('ROLLBACK');
      throw e;
    }
  }
  return userIds.slice(0, count);
}

async function ensureCourses(pg: Pool, count: number): Promise<number[]> {
  const teacherRes = await pg.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ('bench-teacher@example.com','x','Bench Teacher','teacher')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const teacherId = teacherRes.rows[0].id;
  let categoryId: number;
  {
    const existing = await pg.query<{ id: number }>(
      `SELECT id FROM categories WHERE name = $1`,
      ['BenchCat']
    );
    if (existing.rowCount && existing.rows[0]) {
      categoryId = existing.rows[0].id;
    } else {
      const ins = await pg.query<{ id: number }>(
        `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
        ['BenchCat']
      );
      categoryId = ins.rows[0].id;
    }
  }

  const existing = await pg.query<{ id: number }>(
    `SELECT id FROM courses WHERE is_deleted = FALSE ORDER BY id ASC`
  );
  const courseIds: number[] = existing.rows.map(r => r.id);
  if (courseIds.length < count) {
    const toCreate = count - courseIds.length;
    await pg.query('BEGIN');
    try {
      for (let i = 0; i < toCreate; i++) {
        const res = await pg.query<{ id: number }>(
          `INSERT INTO courses (title, teacher_id, category_id, price)
           VALUES ($1, $2, $3, 0)
           RETURNING id`,
          [`Bench Course ${courseIds.length + i + 1}`, teacherId, categoryId]
        );
        courseIds.push(res.rows[0].id);
      }
      await pg.query('COMMIT');
    } catch (e) {
      await pg.query('ROLLBACK');
      throw e;
    }
  }
  return courseIds.slice(0, count);
}

async function ensureSqlBaseline(pg: Pool, requiredLessons: number): Promise<number[]> {
  let courseId: number | null = null;
  {
    const res = await pg.query<{ id: number }>('SELECT id FROM courses WHERE is_deleted = FALSE LIMIT 1');
    if (res.rowCount && res.rows[0]) {
      courseId = res.rows[0].id;
    } else {
      const userRes = await pg.query<{ id: number }>(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ('bench-teacher@example.com','x','Bench Teacher','teacher')
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`
      );
      const teacherId = userRes.rows[0].id;
      const catRes = await pg.query<{ id: number }>(
        `INSERT INTO categories (name)
         VALUES ('BenchCat')
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`
      );
      const categoryId = catRes.rows[0].id;
      const courseRes = await pg.query<{ id: number }>(
        `INSERT INTO courses (title, teacher_id, category_id, price)
         VALUES ('Bench Course', $1, $2, 0)
         RETURNING id`,
        [teacherId, categoryId]
      );
      courseId = courseRes.rows[0].id;
    }
  }

  let moduleId: number | null = null;
  {
    const res = await pg.query<{ id: number }>('SELECT id FROM modules WHERE course_id = $1 LIMIT 1', [courseId]);
    if (res.rowCount && res.rows[0]) {
      moduleId = res.rows[0].id;
    } else {
      const ins = await pg.query<{ id: number }>(
        `INSERT INTO modules (course_id, title, order_index)
         VALUES ($1, 'Module 1', 1)
         RETURNING id`,
        [courseId]
      );
      moduleId = ins.rows[0].id;
    }
  }

  const existing = await pg.query<{ id: number }>(
    'SELECT id FROM lessons WHERE module_id = $1 ORDER BY id ASC',
    [moduleId]
  );
  const lessons: number[] = existing.rows.map(r => r.id);
  if (lessons.length < requiredLessons) {
    const toCreate = requiredLessons - lessons.length;
    await pg.query('BEGIN');
    try {
      for (let i = 0; i < toCreate; i++) {
        const res = await pg.query<{ id: number }>(
          `INSERT INTO lessons (module_id, title, content)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [moduleId, `Lesson ${lessons.length + i + 1}`, 'Bench content']
        );
        lessons.push(res.rows[0].id);
      }
      await pg.query('COMMIT');
    } catch (e) {
      await pg.query('ROLLBACK');
      throw e;
    }
  }
  return lessons.slice(0, requiredLessons);
}

async function benchMongoComments(mongo: MongoClient, count: number): Promise<BenchResult> {
  const db = mongo.db(process.env.MONGODB_DB ?? 'study_platform');
  const col = db.collection('comments');
  await col.deleteMany({});
  await col.createIndex({ lessonId: 1, createdAt: -1 });

  const docs = Array.from({ length: count }, (_, i) => ({
    lessonId: (i % 50) + 1,
    userId: (i % 10) + 1,
    content: `Comment #${i}`,
    createdAt: new Date(),
  }));
  const t1 = process.hrtime.bigint();
  await col.insertMany(docs, { ordered: false });
  const t2 = process.hrtime.bigint();
  const queryStart = process.hrtime.bigint();
  const read = await col.find({ lessonId: 1 }).sort({ createdAt: -1 }).limit(1000).toArray();
  const queryEnd = process.hrtime.bigint();
  return {
    name: 'Mongo Comments',
    insertsMs: hrtimeMs(t1, t2),
    queryMs: hrtimeMs(queryStart, queryEnd),
    count: read.length,
  };
}

async function benchSqlDiscussions(pg: Pool, count: number): Promise<BenchResult> {
  const userIds = await ensureUsers(pg, 10);
  const lessonIds = await ensureSqlBaseline(pg, 50);
  await pg.query('DELETE FROM discussions');
  const t1 = process.hrtime.bigint();
  await pg.query('BEGIN');
  try {
    const text = 'INSERT INTO discussions (lesson_id, user_id, content) VALUES ($1,$2,$3)';
    for (let i = 0; i < count; i++) {
      const lessonId = lessonIds[i % lessonIds.length];
      const userId = userIds[i % userIds.length];
      await pg.query(text, [lessonId, userId, `Comment #${i}`]);
    }
    await pg.query('COMMIT');
  } catch (e) {
    await pg.query('ROLLBACK');
    throw e;
  }
  const t2 = process.hrtime.bigint();
  const queryStart = process.hrtime.bigint();
  const readLessonId = lessonIds[0];
  const read = await pg.query(
    `SELECT * FROM discussions WHERE lesson_id = $1 AND is_deleted = FALSE ORDER BY updated_at DESC LIMIT 1000`,
    [readLessonId]
  );
  const queryEnd = process.hrtime.bigint();
  return {
    name: 'SQL Discussions',
    insertsMs: hrtimeMs(t1, t2),
    queryMs: hrtimeMs(queryStart, queryEnd),
    count: read.rowCount ?? 0,
  };
}

async function benchMongoEvents(mongo: MongoClient, count: number): Promise<BenchResult> {
  const db = mongo.db(process.env.MONGODB_DB ?? 'study_platform');
  const col = db.collection('activity_events');
  await col.deleteMany({});
  await col.createIndex({ userId: 1, ts: -1 });
  await col.createIndex({ courseId: 1, ts: -1 });
  await col.createIndex({ type: 1, ts: -1 });

  const now = Date.now();
  const docs = Array.from({ length: count }, (_, i) => ({
    userId: (i % 10) + 1,
    courseId: (i % 5) + 1,
    type: i % 2 === 0 ? 'click' : 'view',
    metadata: { i },
    ts: new Date(now - (i % 1000)),
  }));
  const t1 = process.hrtime.bigint();
  await col.insertMany(docs, { ordered: false });
  const t2 = process.hrtime.bigint();
  const queryStart = process.hrtime.bigint();
  const read = await col.find({ userId: 2, type: 'view' }).sort({ ts: -1 }).limit(1000).toArray();
  const queryEnd = process.hrtime.bigint();
  return {
    name: 'Mongo Events',
    insertsMs: hrtimeMs(t1, t2),
    queryMs: hrtimeMs(queryStart, queryEnd),
    count: read.length,
  };
}

async function benchSqlEvents(pg: Pool, count: number): Promise<BenchResult> {
  await pg.query('DELETE FROM activity_events');
  const userIds = await ensureUsers(pg, 10);
  const courseIds = await ensureCourses(pg, 5);
  const now = Date.now();
  const t1 = process.hrtime.bigint();
  await pg.query('BEGIN');
  try {
    const text = 'INSERT INTO activity_events (user_id, course_id, type, metadata, ts) VALUES ($1,$2,$3,$4,$5)';
    for (let i = 0; i < count; i++) {
      const userId = userIds[i % userIds.length];
      const courseId = courseIds[i % courseIds.length];
      const type = i % 2 === 0 ? 'click' : 'view';
      const ts = new Date(now - (i % 1000));
      await pg.query(text, [userId, courseId, type, { i }, ts]);
    }
    await pg.query('COMMIT');
  } catch (e) {
    await pg.query('ROLLBACK');
    throw e;
  }
  const t2 = process.hrtime.bigint();
  const queryStart = process.hrtime.bigint();
  const userIdToRead = userIds[1] ?? userIds[0];
  const read = await pg.query(
    `SELECT * FROM activity_events WHERE user_id = $1 AND type = $2 ORDER BY ts DESC LIMIT 1000`,
    [userIdToRead, 'view']
  );
  const queryEnd = process.hrtime.bigint();
  return {
    name: 'SQL Events',
    insertsMs: hrtimeMs(t1, t2),
    queryMs: hrtimeMs(queryStart, queryEnd),
    count: read.rowCount ?? 0,
  };
}

async function main() {
  const COUNT = Number(process.env.BENCH_COUNT ?? '20000');
  console.log(`Starting benchmark with COUNT=${COUNT}`);

  const pg = new Pool({
    host: process.env.PGHOST ?? process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? process.env.POSTGRES_PORT ?? 5438),
    user: process.env.PGUSER ?? process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? 'postgres',
    database: process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? 'study_platform',
    max: 20,
  });
  const mongo = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://localhost:27018');
  await mongo.connect();

  try {
    const results: BenchResult[] = [];
    results.push(await benchMongoComments(mongo, Math.floor(COUNT / 2)));
    results.push(await benchSqlDiscussions(pg, Math.floor(COUNT / 2)));
    results.push(await benchMongoEvents(mongo, COUNT));
    results.push(await benchSqlEvents(pg, COUNT));

    console.table(
      results.map((r) => ({
        name: r.name,
        insertsMs: r.insertsMs.toFixed(1),
        queryMs: r.queryMs.toFixed(1),
        count: r.count,
      }))
    );
  } finally {
    await mongo.close();
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


