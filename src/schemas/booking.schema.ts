import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    job_id: z.string().optional(),
    tutor_id: z.string().min(1, 'Tutor ID is required'),
    subject_id: z.string().min(1, 'Subject ID is required'),
    total_hours: z.number().positive('Total hours must be greater than 0'),
    hourly_rate: z.number().positive('Hourly rate must be greater than 0'),
    learning_mode: z.enum(['ONLINE', 'ONSITE']),
    notes: z.string().max(500).optional(),
  }),
});

export const updateBookingStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED']),
    reason: z.string().optional(),
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>['body'];
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>['body'];
