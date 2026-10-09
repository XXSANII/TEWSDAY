import { z } from 'zod';

export const createInvoiceSchema = z.object({
  body: z.object({
    booking_id: z.string().min(1, 'Booking ID is required'),
    commission_rate: z.number().min(0).max(100).default(10), // Percentage e.g. 10%
  }),
});

export const verifySlipSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    slip_url: z.string().url('Must be a valid slip URL'),
    transferred_amount: z.number().positive('Transferred amount must be greater than 0'),
  }),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>['body'];
export type VerifySlipInput = z.infer<typeof verifySlipSchema>['body'];
