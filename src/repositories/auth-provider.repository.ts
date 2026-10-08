import crypto from "crypto";
import { pool } from "../config/database";

export async function createLocalProvider(
  userId: string,
  passwordHash: string
) {
  const providerId =
    "uap_" + crypto.randomUUID();

  const result = await pool.query(
    `
    INSERT INTO user_auth_providers (
      id,
      user_id,
      provider,
      password_hash,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      'LOCAL',
      $3,
      TRUE,
      NOW(),
      NOW()
    )
    RETURNING *
    `,
    [
      providerId,
      userId,
      passwordHash,
    ]
  );

  return result.rows[0];
}

export async function findLocalProvider(
  userId: string
) {
  const result = await pool.query(
    `
    SELECT *
    FROM user_auth_providers
    WHERE user_id = $1
      AND provider = 'LOCAL'
      AND is_active = TRUE
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
}