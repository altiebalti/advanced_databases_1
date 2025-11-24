import { MongoClient, Db, Collection } from 'mongodb';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;

const DEFAULT_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27018';
const DEFAULT_DB = process.env.MONGODB_DB ?? 'study_platform';

export async function getMongoClient(): Promise<MongoClient> {
  if (client && (client as any).topology && (client as any).topology.isConnected && dbInstance) {
    return client;
  }
  if (!client) {
    client = new MongoClient(DEFAULT_URI, {
      maxPoolSize: 20,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
    });
  }
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db(DEFAULT_DB);
  }
  return client;
}

export async function getDb(): Promise<Db> {
  await getMongoClient();
  if (!dbInstance) throw new Error('Mongo DB is not initialized');
  return dbInstance;
}

export async function getCollection<TSchema extends object = any>(name: string): Promise<Collection<TSchema>> {
  const db = await getDb();
  return db.collection<TSchema>(name);
}

export type MongoId = string;

export interface CommentDoc {
  _id?: any;
  lessonId: number;
  userId: number;
  content: string;
  createdAt: Date;
}

export interface ActivityEventDoc {
  _id?: any;
  userId: number;
  courseId?: number;
  type: string;
  metadata?: Record<string, unknown>;
  ts: Date;
}


