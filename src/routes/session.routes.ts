import { Router } from 'express';
import {
  getSessionByIdHandler,
  startSessionHandler,
  completeSessionHandler,
  confirmAttendanceHandler,
} from '../controllers/session.controller';
import { completeSessionSchema } from '../schemas/session.schema';
import { validateRequest } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Card 10: Session Direct Actions
router.get('/:id', getSessionByIdHandler);
router.patch('/:id/start', startSessionHandler);
router.patch('/:id/complete', validateRequest(completeSessionSchema), completeSessionHandler);
router.patch('/:id/confirm-attendance', confirmAttendanceHandler);

export default router;
