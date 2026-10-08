// Compatibility import for existing team modules; all routes share durable session checks.
export { authenticate, roles } from './auth';
export type { Request as AuthRequest } from 'express';
