import { z } from 'zod';

export const locationSchema = z
  .object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90) })
  .strict();
export const money = z
  .number()
  .min(0)
  .max(99999999.99)
  .refine(
    (n) => Number.isInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    'Use at most two decimal places',
  );
export const positiveMoney = money.refine((n) => n > 0, 'Must be positive');
export const name = z.string().trim().min(1).max(100);
export const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
export const teachingMode = z.enum(['ONLINE', 'ONSITE', 'BOTH']);
export const textArray = (max: number, count = 30) =>
  z.array(z.string().trim().min(1).max(max)).max(count);
export const nonEmpty = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');
