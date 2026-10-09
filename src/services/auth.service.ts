import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import { comparePassword, hashPassword } from '../utils/password';
import * as sessions from '../repositories/session.repository';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { config } from '../config';
import { db, transaction, Transaction } from '../db';
import { newId } from '../common/ids';
import { guard, ApiError } from '../common/errors';
import { first } from '../common/sql';
import { setRequestSession } from '../common/request-context';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const sign = (userId: string, sessionId: string) =>
  jwt.sign({ sid: sessionId }, config.JWT_SECRET, {
    subject: userId,
    expiresIn: '15m',
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
    algorithm: 'HS256',
  });

async function createSession(tx: Transaction, userId: string, userAgent?: string) {
  const refreshToken = randomBytes(48).toString('base64url');
  const id = newId('uss');
  setRequestSession(id);
  await tx.user_sessions.create({
    data: {
      id,
      user_id: userId,
      refresh_token_hash: hash(refreshToken),
      user_agent: userAgent?.slice(0, 1000),
      expires_at: new Date(Date.now() + 7 * 86400000),
      last_active_at: new Date(),
      created_by: userId,
      updated_by: userId,
    },
  });
  return { access_token: sign(userId, id), refreshToken, expires_in: 900 };
}

export async function register(email: string, password: string, userAgent?: string) {
  const normalized = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const userId = newId('usr');
  return transaction(userId, async (tx) => {
    // V2 does not declare email uniqueness; serialize the application guard for registrations.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${normalized}))::text`;
    const exists = await tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM users WHERE lower(email) = ${normalized}`;
    guard(!exists.length, 409, 'EMAIL_EXISTS', 'Email is already registered');
    await tx.users.create({
      data: { id: userId, email: normalized, created_by: userId, updated_by: userId },
    });
    await tx.user_auth_providers.create({
      data: {
        id: newId('uap'),
        user_id: userId,
        provider: 'LOCAL',
        password_hash: passwordHash,
        created_by: userId,
        updated_by: userId,
      },
    });
    return createSession(tx, userId, userAgent);
  });
}

export async function login(email: string, password: string, userAgent?: string) {
  const rows = await db.$queryRaw<{ id: string; password_hash: string }[]>(Prisma.sql`
    SELECT u.id, p.password_hash FROM users u JOIN user_auth_providers p ON p.user_id = u.id
    WHERE lower(u.email) = ${email.trim().toLowerCase()} AND u.is_active AND p.is_active AND p.provider = 'LOCAL'
  `);
  const found = rows.length === 1 ? rows[0] : undefined;
  // Equal-cost password verification also runs for unknown email addresses.
  const fakeHash = await dummyPasswordHash;
  const valid = await comparePassword(password, found?.password_hash ?? fakeHash);
  guard(found && valid, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  return transaction(found!.id, async (tx) => {
    const user = await first<{ is_active: boolean }>(
      tx,
      Prisma.sql`SELECT is_active FROM users WHERE id = ${found!.id} FOR NO KEY UPDATE`,
    );
    guard(user.is_active, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    return createSession(tx, found!.id, userAgent);
  });
}

const dummyPasswordHash = argon2.hash(randomBytes(32).toString('hex'));

export async function refresh(token: string) {
  const current = await db.user_sessions.findUnique({ where: { refresh_token_hash: hash(token) } });
  if (!current) throw new ApiError(401, 'INVALID_REFRESH', 'Invalid or expired refresh token');
  setRequestSession(current.id);
  return transaction(current.user_id, async (tx) => {
    // Lock in the same order as user mutations: user, then session.
    const user = await first<{ is_active: boolean }>(
      tx,
      Prisma.sql`SELECT is_active FROM users WHERE id = ${current.user_id} FOR NO KEY UPDATE`,
    );
    const session = await first<{
      is_active: boolean;
      is_revoked: boolean;
      expires_at: Date;
      refresh_token_hash: string;
    }>(
      tx,
      Prisma.sql`SELECT is_active, is_revoked, expires_at, refresh_token_hash FROM user_sessions WHERE id = ${current.id} FOR UPDATE`,
    );
    guard(
      user.is_active &&
        session.is_active &&
        !session.is_revoked &&
        session.expires_at > new Date() &&
        session.refresh_token_hash === hash(token),
      401,
      'INVALID_REFRESH',
      'Invalid or expired refresh token',
    );
    const refreshToken = randomBytes(48).toString('base64url');
    await tx.user_sessions.update({
      where: { id: current.id },
      data: {
        refresh_token_hash: hash(refreshToken),
        last_active_at: new Date(),
        updated_at: new Date(),
        updated_by: current.user_id,
      },
    });
    return { access_token: sign(current.user_id, current.id), refreshToken, expires_in: 900 };
  });
}

export async function logout(userId: string, sessionId: string) {
  return transaction(userId, (tx) =>
    tx.user_sessions.update({
      where: { id: sessionId },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        updated_by: userId,
        updated_at: new Date(),
      },
    }),
  );
}

export async function getSessions(userId: string, currentSessionId: string) {
  const rows = await sessions.getUserSessions(userId);
  return rows.map((row) => ({
    id: row.id,
    device: row.device_name,
    ip_address: row.ip_address,
    last_active: row.last_active_at,
    expires_at: row.expires_at,
    is_current: row.id === currentSessionId,
  }));
}
export async function forceLogout(userId: string, sessionId: string) {
  return transaction(userId, async (tx) => {
    const revoked = await sessions.revokeUserSession(tx, userId, sessionId);
    guard(revoked, 404, 'SESSION_NOT_FOUND', 'Active session not found');
  });
}
