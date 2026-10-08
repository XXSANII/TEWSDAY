import { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { ApiError } from '../common/errors';
import { entityId } from '../common/ids';
import * as service from '../services/auth.service';

export const credentials = z
  .object({ email: z.email().max(255), password: z.string().min(10).max(128) })
  .strict();
export const registrationCredentials = credentials
  .extend({ confirm_password: z.string().max(128).optional() })
  .refine(
    (body) => body.confirm_password === undefined || body.confirm_password === body.password,
    { message: 'Password confirmation does not match', path: ['confirm_password'] },
  );
export const loginCredentials = credentials.extend({ password: z.string().min(1).max(128) });
const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 86400000,
};
function sendTokens(
  res: Response,
  tokens: Awaited<ReturnType<typeof service.login>>,
  status = 200,
) {
  res.cookie('refresh_token', tokens.refreshToken, cookieOptions);
  res.status(status).json({
    data: {
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      token_type: 'Bearer',
    },
  });
}
export async function register(req: Request, res: Response) {
  const body = registrationCredentials.parse(req.body);
  sendTokens(
    res,
    await service.register(body.email, body.password, req.headers['user-agent']),
    201,
  );
}
export async function login(req: Request, res: Response) {
  const body = loginCredentials.parse(req.body);
  sendTokens(res, await service.login(body.email, body.password, req.headers['user-agent']));
}
export async function refreshToken(req: Request, res: Response) {
  const token: unknown = req.cookies?.refresh_token;
  if (typeof token !== 'string')
    throw new ApiError(401, 'INVALID_REFRESH', 'Refresh cookie required');
  sendTokens(res, await service.refresh(token));
}
export async function logout(req: Request, res: Response) {
  await service.logout(req.actor.userId, req.actor.sessionId);
  res.clearCookie('refresh_token', cookieOptions).status(204).end();
}
export async function getSessions(req: Request, res: Response) {
  res.json({ data: await service.getSessions(req.actor.userId, req.actor.sessionId) });
}
export async function forceLogout(req: Request, res: Response) {
  const id = entityId('uss').parse(req.params.id);
  await service.forceLogout(req.actor.userId, id);
  if (id === req.actor.sessionId) res.clearCookie('refresh_token', cookieOptions);
  res.status(204).end();
}
export async function oauthLogin(_req: Request, _res: Response) {
  throw new ApiError(
    501,
    'OAUTH_NOT_IMPLEMENTED',
    'OAuth login belongs to the separate Auth integration task',
  );
}
