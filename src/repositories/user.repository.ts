import { pool } from "../config/database";
import crypto from "crypto";

export async function findUserByEmail(
  email: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      email,
      is_active
    FROM users
    WHERE email = $1
    LIMIT 1
    `,
    [email]
  );

  return result.rows[0];
}

export async function findUserById(
  userId: string
) {
  const result = await pool.query(
    `
    SELECT
      id,
      email,
      is_active
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
}

export async function createUser(
  email: string
) {
  const userId =
    "usr_" + crypto.randomUUID();

  const result = await pool.query(
    `
    INSERT INTO users (
      id,
      email,
      roles,
      current_mode,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      ARRAY['STUDENT'],
      'STUDENT',
      TRUE,
      NOW(),
      NOW()
    )
    RETURNING
      id,
      email,
      created_at
    `,
    [userId, email]
  );

  return result.rows[0];
}