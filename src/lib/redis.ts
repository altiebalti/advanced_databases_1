import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (client && client.isOpen) return client;
  const url = process.env.REDIS_URL ?? 'redis://localhost:6380';
  client = createClient({ url });
  client.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis Client Error', err);
  });
  await client.connect();
  return client;
}


