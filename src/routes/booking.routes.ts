import { Router } from 'express';
import {
  createBookingHandler,
  getBookingByIdHandler,
  updateBookingStatusHandler,
} from '../controllers/booking.controller';
import { createBookingSchema, updateBookingStatusSchema } from '../schemas/booking.schema';
import { validateRequest } from '../middleware/validate'; // Adjust based on your schema validation middleware
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, validateRequest(createBookingSchema), createBookingHandler);
router.get('/:id', requireAuth, getBookingByIdHandler);
router.patch(
  '/:id/status',
  requireAuth,
  validateRequest(updateBookingStatusSchema),
  updateBookingStatusHandler,
);

export default router;
