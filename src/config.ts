import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  REDIS_URL: z.url().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('tewsday-api'),
  JWT_AUDIENCE: z.string().default('tewsday-web'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug']).default('info'),
});

export const config = configSchema.parse(process.env);
export const allowedOrigins = config.CORS_ORIGINS.split(',').map((s) => s.trim());
if (allowedOrigins.includes('*')) throw new Error('CORS_ORIGINS must contain explicit origins');
if (config.NODE_ENV === 'production' && !config.REDIS_URL) {
  throw new Error('Production rate limiting requires REDIS_URL');
}
if (config.NODE_ENV === 'production' && config.JWT_SECRET.startsWith('replace-with-')) {
  throw new Error('Replace the example JWT secret before production');
}
