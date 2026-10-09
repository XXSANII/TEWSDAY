import { z } from 'zod';

export const payInvoiceSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
  body: z.object({
    slip_file_id: z.string().min(1, 'Slip file ID is required'),
  }),
});

export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>['body'];
