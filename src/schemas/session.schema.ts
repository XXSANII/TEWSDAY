import { z } from 'zod';

export const createSessionSchema = z.object({
  params: z.object({
    id: z.string().min(1), // booking_id
  }),
  body: z.object({
    scheduled_start: z.string().datetime({ message: 'Invalid ISO scheduled_start format' }),
    scheduled_end: z.string().datetime({ message: 'Invalid ISO scheduled_end format' }),
  }),
});

export const completeSessionSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    session_feedback: z.string().optional(),
    homework_assigned: z.string().optional(),
  }),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>['body'];
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>['body'];
