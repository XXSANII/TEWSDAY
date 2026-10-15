import { z } from 'zod';
import { entityId } from '../../common/ids';

export const createConversationSchema = z
    .object({
        tutor_id: entityId('tut'),
        booking_id: entityId('bkg').nullable().optional(),
    })
    .strict();

export const getMessagesQuerySchema = z.object({
    cursor: entityId('msg').optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sendMessageSchema = z
    .object({
        content: z.string().trim().optional(),
        message_type: z.enum(['TEXT', 'EMOJI', 'IMAGE', 'VIDEO', 'FILE']).default('TEXT'),
        file_id: entityId('fil').nullable().optional(),
        thumbnail_file_id: entityId('fil').nullable().optional(),
    })
    .strict()
    .refine((data) => data.content || data.file_id, {
        message: 'Either content or file_id must be provided',
    });

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type GetMessagesQueryInput = z.infer<typeof getMessagesQuerySchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;