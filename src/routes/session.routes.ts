import { Router } from 'express';
import {
  createSessionHandler,
  getSessionsByBookingHandler,
  updateSessionStatusHandler,
} from '../controllers/session.controller';
import { createSessionSchema, updateSessionStatusSchema } from '../schemas/session.schema';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, validateRequest(createSessionSchema), createSessionHandler);
router.get('/', requireAuth, getSessionsByBookingHandler);
router.patch(
  '/:id/status',
  requireAuth,
  validateRequest(updateSessionStatusSchema),
  updateSessionStatusHandler,
);

export default router;
