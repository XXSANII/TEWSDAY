import { z } from 'zod';

export const createReviewSchema = z.object({
  rating_score: z
    .number()
    .int('Rating score must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5'),
  comment: z.string().trim().max(1000, 'Comment must not exceed 1000 characters').optional(),
});

export const updateReviewSchema = z.object({
  rating_score: z
    .number()
    .int('Rating score must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating cannot exceed 5')
    .optional(),
  comment: z.string().trim().max(1000, 'Comment must not exceed 1000 characters').optional(),
});

export const getMyReviewsQuerySchema = z.object({
  type: z.enum(['written', 'received']).default('written'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const getTutorReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type GetMyReviewsQuery = z.infer<typeof getMyReviewsQuerySchema>;
export type GetTutorReviewsQuery = z.infer<typeof getTutorReviewsQuerySchema>;
