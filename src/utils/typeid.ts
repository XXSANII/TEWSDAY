import { randomBytes } from 'crypto';

export type IdPrefix = 'bkg' | 'ses' | 'inv' | 'usr' | 'tut' | 'std' | 'job';

/**
 * Generates a prefixed unique ID (e.g. bkg_k8z2m9a0bc12)
 */
export function generateId(prefix: IdPrefix): string {
  const timestamp = Date.now().toString(36);
  const randomHex = randomBytes(5).toString('hex');
  return `${prefix}_${timestamp}${randomHex}`;
}
