import argon2 from 'argon2';
import bcrypt from 'bcrypt';
export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}
export async function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  // Keep existing bcrypt credentials usable while new credentials use Argon2id.
  if (/^\$2[aby]\$/.test(passwordHash)) return bcrypt.compare(password, passwordHash);
  if (!passwordHash.startsWith('$argon2')) return false;
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}
