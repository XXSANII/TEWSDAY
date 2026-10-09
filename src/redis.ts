import Redis from 'ioredis';
import { config } from './config';

export const redis = config.REDIS_URL
  ? new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => (times < 5 ? 200 * times : null),
    })
  : null;
redis?.on('error', () => {
  /* Callers fail closed without logging credentials or connection URLs. */
});
