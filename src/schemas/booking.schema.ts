import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    job_id: z.string().optional(),
    tutor_id: z.string().min(1, 'Tutor ID is required'),
    subject_id: z.string().min(1, 'Subject ID is required'),
    hourly_rate: z.number().positive('Hourly rate must be greater than 0'),
    learning_mode: z.enum(['ONLINE', 'ONSITE']),
    meeting_location: z.string().optional(),
    meeting_url: z.string().url().optional(),
  }),
});

export const uploadContractSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    signed_contract_file_id: z.string().min(1, 'Signed contract file ID is required'),
  }),
});

export const cancelBookingSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>['body'];
export type UploadContractInput = z.infer<typeof uploadContractSchema>['body'];
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>['body'];
