import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../redis';
import { config } from '../config';
import { ApiError } from '../common/errors';

export const userRateLimit = rateLimit({
  windowMs: 60000,
  limit: 300,
  keyGenerator: (req) => req.actor.userId,
  store: redis
    ? new RedisStore({
        prefix: 'tewsday:user:',
        sendCommand: (...args: string[]) =>
          redis!.call(...(args as [string, ...string[]])) as Promise<string | number>,
      })
    : undefined,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  handler: (_req, _res, next) =>
    next(new ApiError(429, 'RATE_LIMITED', 'Too many requests; try again later')),
});
