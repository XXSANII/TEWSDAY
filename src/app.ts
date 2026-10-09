import { randomUUID } from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import swaggerUi from 'swagger-ui-express';
import { allowedOrigins, config } from './config';
import { db } from './db';
import { redis } from './redis';
import { ApiError } from './common/errors';
import { errorHandler } from './middleware/errors';
import { requestContext } from './common/request-context';
import { authRouter } from './routes/auth.routes';
import {
  tutorProfileRouter,
  studentProfileRouter,
  profileCreateRouter,
} from './modules/profiles/router';
import { tutorSearchRouter } from './modules/search/router';
import { jobRouter, applicationRouter } from './modules/marketplace/router';
import { userRouter } from './modules/users/router';
import { subjectRouter } from './modules/subjects/router';
import { openapi } from './openapi';
import bookingRoutes from './routes/booking.routes';
import sessionRoutes from './routes/session.routes';
import invoiceRoutes from './routes/invoice.routes';

function limiter(prefix: string, limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: redis
      ? new RedisStore({
          prefix,
          sendCommand: (...args: string[]) =>
            redis!.call(...(args as [string, ...string[]])) as Promise<string | number>,
        })
      : undefined,
    skip: () => config.NODE_ENV === 'test',
    handler: (_req, _res, next) =>
      next(new ApiError(429, 'RATE_LIMITED', 'Too many requests; try again later')),
  });
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    requestContext.run({ requestId: req.requestId, method: req.method, path: req.path }, next);
  });
  app.use(
    pinoHttp({
      level: config.LOG_LEVEL,
      genReqId: (req) => (req as express.Request).requestId,
      serializers: {
        req: (req) => ({ method: req.method, path: req.url?.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
        err: () => ({ message: 'Request failed' }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(
          !origin || allowedOrigins.includes(origin)
            ? null
            : new ApiError(403, 'ORIGIN_FORBIDDEN', 'Origin is not permitted'),
          true,
        ),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '128kb' }));
  app.use(cookieParser());
  app.get('/', (_req, res) => res.json({ success: true, message: 'API is running' }));
  app.get('/health', async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    if (redis) await redis.ping();
    res.json({ status: 'ok' });
  });
  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api/v1', limiter('tewsday:api:', 300, 60000));
  app.use('/api/v1/auth', limiter('tewsday:auth:', 20, 15 * 60000), authRouter);
  app.use('/api/v1/users', userRouter);
  app.use('/api/v1/subjects', subjectRouter);
  app.use('/api/v1/profiles', profileCreateRouter);
  app.use('/api/v1/students', studentProfileRouter);
  app.use('/api/v1/tutors', tutorProfileRouter, tutorSearchRouter);
  app.use('/api/v1/jobs', jobRouter);
  app.use('/api/v1/applications', applicationRouter);
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Endpoint not found')));
  app.use(errorHandler);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/sessions', sessionRoutes);
  app.use('/api/v1/invoices', invoiceRoutes);
  return app;
}

export default createApp();
