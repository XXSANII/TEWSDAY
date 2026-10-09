import { z } from 'zod';

export const createSessionSchema = z.object({
  body: z.object({
    booking_id: z.string().min(1, 'Booking ID is required'),
    start_time: z.string().datetime({ message: 'Invalid ISO start_time format' }),
    end_time: z.string().datetime({ message: 'Invalid ISO end_time format' }),
    meeting_link: z.string().url().optional(),
    location_name: z.string().optional(),
  }),
});

export const updateSessionStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  }),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>['body'];
export type UpdateSessionStatusInput = z.infer<typeof updateSessionStatusSchema>['body'];
