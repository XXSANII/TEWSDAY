import { Router, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { authenticate } from '../../middleware/auth';
import { ApiError } from '../../common/errors';
import * as service from './service';

export const authRouter = Router();
const credentials = z
  .object({ email: z.email().max(255), password: z.string().min(10).max(128) })
  .strict();
const loginCredentials = credentials.extend({ password: z.string().min(1).max(128) });
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
  res
    .status(status)
    .json({ data: { access_token: tokens.access_token, expires_in: tokens.expires_in } });
}
authRouter.post('/register', async (req, res) => {
  const body = credentials.parse(req.body);
  sendTokens(
    res,
    await service.register(body.email, body.password, req.headers['user-agent']),
    201,
  );
});
authRouter.post('/login', async (req, res) => {
  const body = loginCredentials.parse(req.body);
  sendTokens(res, await service.login(body.email, body.password, req.headers['user-agent']));
});
const refreshHandler = async (req: import('express').Request, res: Response) => {
  const token: unknown = req.cookies?.refresh_token;
  if (typeof token !== 'string')
    throw new ApiError(401, 'INVALID_REFRESH', 'Refresh cookie required');
  sendTokens(res, await service.refresh(token));
};
authRouter.post('/refresh', refreshHandler);
authRouter.post('/refresh-token', refreshHandler);
authRouter.post('/logout', authenticate, async (req, res) => {
  await service.logout(req.actor.userId, req.actor.sessionId);
  res.clearCookie('refresh_token', cookieOptions).status(204).end();
});
