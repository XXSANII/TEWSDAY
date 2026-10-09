import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../common/errors';

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown;
  if (err instanceof ApiError) ({ status, code, message } = err);
  else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request';
    details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
  } else if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2002', 'P2003', 'P2034'].includes(err.code)
  ) {
    status = 409;
    code = 'DATA_CONFLICT';
    message = 'Request conflicts with the current data';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2028') {
    status = 503;
    code = 'DATABASE_BUSY';
    message = 'Database is busy; retry the request';
  } else if (err instanceof SyntaxError && 'body' in err) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON body';
  } else if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.too.large') {
    status = 413;
    code = 'BODY_TOO_LARGE';
    message = 'Request body exceeds the limit';
  }
  if (status >= 500) req.log?.error({ requestId: req.requestId, code }, 'Request failed');
  res.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    },
  });
};
