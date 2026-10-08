import crypto from "crypto";
import { pool } from "../config/database";

export async function createSession(
  userId: string,
  refreshTokenHash: string,
  deviceName: string | null,
  ipAddress: string | null,
  userAgent: string | null,
  expiresAt: Date
) {
  const sessionId =
    "uss_" + crypto.randomUUID();

  const result = await pool.query(
    `
    INSERT INTO user_sessions (
      id,
      user_id,
      refresh_token_hash,
      device_name,
      ip_address,
      user_agent,
      expires_at,
      is_revoked,
      last_active_at,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      FALSE,
      NOW(),
      TRUE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      sessionId,
      userId,
      refreshTokenHash,
      deviceName,
      ipAddress,
      userAgent,
      expiresAt,
    ]
  );

  return result.rows[0];
}

export async function findSessionByRefreshTokenHash(
  refreshTokenHash: string
) {
  const result = await pool.query(
    `
    SELECT *
    FROM user_sessions
    WHERE refresh_token_hash = $1
      AND is_revoked = FALSE
      AND is_active = TRUE
      AND expires_at > NOW()
    LIMIT 1
    `,
    [refreshTokenHash]
  );

  return result.rows[0];
}

export async function revokeSession(
  sessionId: string
) {
  await pool.query(
    `
    UPDATE user_sessions
    SET
      is_revoked = TRUE,
      revoked_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    `,
    [sessionId]
  );
}

export async function updateRefreshToken(
  sessionId: string,
  refreshTokenHash: string,
  expiresAt: Date
) {
  await pool.query(
    `
    UPDATE user_sessions
    SET
      refresh_token_hash = $1,
      expires_at = $2,
      last_active_at = NOW(),
      updated_at = NOW()
    WHERE id = $3
    `,
    [
      refreshTokenHash,
      expiresAt,
      sessionId,
    ]
  );
}

export async function getUserSessions(
  userId: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      device_name AS device,
      ip_address,
      last_active_at AS last_active
    FROM user_sessions
    WHERE user_id = $1
      AND is_revoked = FALSE
      AND is_active = TRUE
      AND expires_at > NOW()
    ORDER BY last_active_at DESC
    `,
    [userId]
  );

  return result.rows;
}

export async function revokeUserSession(
  userId: string,
  sessionId: string
) {
  const result = await pool.query(
    `
    UPDATE user_sessions
    SET
      is_revoked = TRUE,
      revoked_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
      AND user_id = $2
      AND is_revoked = FALSE
    RETURNING id
    `,
    [
      sessionId,
      userId,
    ]
  );

  return result.rowCount !== null &&
    result.rowCount > 0;
}