import { z } from 'zod';
import { entityId } from '../../common/ids';
import { paginationSchema } from '../../common/pagination';
import { teachingMode } from '../../common/validation';

export const tutorSearchSchema = z
  .object({
    ...paginationSchema,
    subject_id: entityId('sbj').optional(),
    grade_level: z.string().max(50).optional(),
    location_type: teachingMode.optional(),
    min_rate: z.coerce.number().min(0).optional(),
    max_rate: z.coerce.number().min(0).optional(),
    min_rating: z.coerce.number().min(1).max(5).optional(),
    verification_status: z.literal('VERIFIED').optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    radius_km: z.coerce.number().positive().max(500).optional(),
    available_date: z.iso.date().optional(),
    start_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    end_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const geo = [v.longitude, v.latitude, v.radius_km];
    if (geo.some((x) => x != null) && !geo.every((x) => x != null))
      ctx.addIssue({
        code: 'custom',
        message: 'longitude, latitude and radius_km must be provided together',
      });
    if (v.radius_km && v.location_type === 'ONLINE')
      ctx.addIssue({
        code: 'custom',
        message: 'Radius filtering applies to onsite-capable tutors',
      });
    if (v.min_rate != null && v.max_rate != null && v.min_rate > v.max_rate)
      ctx.addIssue({ code: 'custom', message: 'min_rate must not exceed max_rate' });
    const available = [v.available_date, v.start_time, v.end_time];
    if (available.some((x) => x != null) && !available.every((x) => x != null))
      ctx.addIssue({
        code: 'custom',
        message: 'Availability requires available_date, start_time and end_time together',
      });
    if (v.start_time && v.end_time && v.start_time >= v.end_time)
      ctx.addIssue({ code: 'custom', message: 'start_time must precede end_time' });
  });

export type SearchInput = z.infer<typeof tutorSearchSchema>;
