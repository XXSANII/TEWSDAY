import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { db } from '../db';
import { ApiError, guard } from '../common/errors';
import { userRateLimit } from './user-rate-limit';
import { setRequestSession } from '../common/request-context';

export interface Actor {
  userId: string;
  sessionId: string;
  roles: string[];
}

declare global {
  namespace Express {
    interface Request {
      actor: Actor;
      requestId: string;
    }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Bearer access token required');
  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    });
    if (
      typeof decoded === 'string' ||
      typeof decoded.sub !== 'string' ||
      typeof decoded.sid !== 'string'
    )
      throw new Error('Invalid token claims');
    payload = decoded;
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired access token');
  }
  const session = await db.user_sessions.findFirst({
    where: {
      id: payload.sid,
      user_id: payload.sub,
      is_active: true,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
  });
  const user =
    session && (await db.users.findFirst({ where: { id: session.user_id, is_active: true } }));
  guard(user && session, 401, 'SESSION_REVOKED', 'Session has expired or been revoked');
  req.actor = { userId: user!.id, sessionId: session!.id, roles: user!.roles };
  setRequestSession(session!.id);
  userRateLimit(req, _res, next);
};

export const roles =
  (...allowed: string[]): RequestHandler =>
  (req, _res, next) => {
    guard(
      req.actor.roles.some((role) => allowed.includes(role)),
      403,
      'ROLE_FORBIDDEN',
      'Insufficient role',
    );
    next();
  };
