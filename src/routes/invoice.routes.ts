import { Router } from 'express';
import {
  createInvoiceHandler,
  getInvoiceByIdHandler,
  verifySlipHandler,
} from '../controllers/invoice.controller';
import { createInvoiceSchema, verifySlipSchema } from '../schemas/invoice.schema';
import { validateRequest } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, validateRequest(createInvoiceSchema), createInvoiceHandler);
router.get('/:id', requireAuth, getInvoiceByIdHandler);
router.post('/:id/verify-slip', requireAuth, validateRequest(verifySlipSchema), verifySlipHandler);

export default router;
