import { z } from 'zod';
import { entityId } from '../../common/ids';
import { paginationSchema } from '../../common/pagination';
import {
  locationSchema,
  money,
  positiveMoney,
  teachingMode,
  textArray,
} from '../../common/validation';

export const jobSchema = z
  .object({
    subject_id: entityId('sbj'),
    target_grade_level: z.string().trim().min(1).max(50),
    target_topics: textArray(200).default([]),
    learning_goal: z.string().trim().min(1).max(10000),
    budget_min: money,
    budget_max: positiveMoney,
    location_type: teachingMode,
    location: locationSchema.nullable().optional(),
    frequency_per_week: z.number().int().min(1).max(7),
    preferred_days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.budget_min > v.budget_max)
      ctx.addIssue({ code: 'custom', message: 'budget_min must not exceed budget_max' });
    if (v.location_type !== 'ONLINE' && !v.location)
      ctx.addIssue({ code: 'custom', message: 'Onsite-capable jobs require location' });
    if (new Set(v.preferred_days).size !== v.preferred_days.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate preferred day' });
  });
export const jobSearchSchema = z
  .object({
    ...paginationSchema,
    subject_id: entityId('sbj').optional(),
    location_type: teachingMode.optional(),
    budget_min: z.coerce.number().min(0).optional(),
    budget_max: z.coerce.number().min(0).optional(),
  })
  .strict()
  .refine(
    (v) => v.budget_min == null || v.budget_max == null || v.budget_min <= v.budget_max,
    'budget_min must not exceed budget_max',
  );
export const jobStatusSchema = z.object({ status: z.enum(['CLOSED', 'CANCELLED']) }).strict();
export const applicationSchema = z
  .object({ proposed_rate: positiveMoney, cover_message: z.string().trim().min(1).max(10000) })
  .strict();
export const acceptanceFields = {
  location_type: z.enum(['ONLINE', 'ONSITE']).optional(),
  meeting_location: z.string().trim().max(2000).optional(),
  meeting_url: z
    .url()
    .max(2000)
    .refine((url) => /^https?:\/\//.test(url), 'HTTP(S) meeting URL required')
    .optional(),
};
export const acceptanceSchema = z.object(acceptanceFields).strict();
export const applicationStatusSchema = z
  .object({ status: z.enum(['ACCEPTED', 'REJECTED', 'WITHDRAWN']), ...acceptanceFields })
  .strict();

export type JobInput = z.infer<typeof jobSchema>;
export type JobSearchInput = z.infer<typeof jobSearchSchema>;
export type AcceptanceInput = z.infer<typeof acceptanceSchema>;
