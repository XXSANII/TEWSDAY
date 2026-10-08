import { db, Transaction } from '../db';
export function getUserSessions(userId: string) {
  return db.user_sessions.findMany({
    where: { user_id: userId, is_active: true, is_revoked: false, expires_at: { gt: new Date() } },
    select: {
      id: true,
      device_name: true,
      ip_address: true,
      last_active_at: true,
      expires_at: true,
    },
    orderBy: [{ last_active_at: 'desc' }, { id: 'desc' }],
  });
}
export async function revokeUserSession(tx: Transaction, userId: string, sessionId: string) {
  const result = await tx.user_sessions.updateMany({
    where: {
      id: sessionId,
      user_id: userId,
      is_active: true,
      is_revoked: false,
      expires_at: { gt: new Date() },
    },
    data: { is_revoked: true, revoked_at: new Date(), updated_at: new Date(), updated_by: userId },
  });
  return result.count > 0;
}
