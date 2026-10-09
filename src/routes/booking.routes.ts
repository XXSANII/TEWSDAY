import { Router } from 'express';
import {
  createBookingHandler,
  getUserBookingsHandler,
  getBookingByIdHandler,
  uploadContractHandler,
  confirmBookingHandler,
  cancelBookingHandler,
} from '../controllers/booking.controller';
import {
  getSessionsByBookingHandler,
  createSessionHandler,
} from '../controllers/session.controller';
import {
  createBookingSchema,
  uploadContractSchema,
  cancelBookingSchema,
} from '../schemas/booking.schema';
import { createSessionSchema } from '../schemas/session.schema';
import { validateRequest } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Card 9: Bookings
router.post('/', validateRequest(createBookingSchema), createBookingHandler);
router.get('/', getUserBookingsHandler);
router.get('/:id', getBookingByIdHandler);
router.post('/:id/contract', validateRequest(uploadContractSchema), uploadContractHandler);
router.patch('/:id/confirm', confirmBookingHandler);
router.patch('/:id/cancel', validateRequest(cancelBookingSchema), cancelBookingHandler);

// Card 10: Nested Session Routes on Booking
router.get('/:id/sessions', getSessionsByBookingHandler);
router.post('/:id/sessions', validateRequest(createSessionSchema), createSessionHandler);

export default router;
