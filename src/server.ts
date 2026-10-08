import { createApp } from './app';
import { config } from './config';
import { db } from './db';
import { redis } from './redis';

async function main() {
  await db.$connect();
  if (redis) {
    // Rate-limit stores can start a lazy connection while app modules initialize.
    if (redis.status === 'wait') await redis.connect();
    await redis.ping();
  }
  const server = createApp().listen(config.PORT);
  const shutdown = () => {
    server.close(() => {
      Promise.all([db.$disconnect(), redis?.quit()])
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
main().catch(() => {
  process.stderr.write(
    'API startup failed. Check database, Redis and environment configuration.\n',
  );
  process.exit(1);
});
