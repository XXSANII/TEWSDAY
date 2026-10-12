import { Router } from 'express';
import {
  getUserInvoicesHandler,
  getInvoiceByIdHandler,
  payInvoiceHandler,
  verifyInvoiceHandler,
} from '../controllers/invoice.controller';
import { payInvoiceSchema } from '../schemas/invoice.schema';
import { validateRequest } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Card 11: Invoices
router.get('/', getUserInvoicesHandler);
router.get('/:id', getInvoiceByIdHandler);
router.post('/:id/pay', validateRequest(payInvoiceSchema), payInvoiceHandler);
router.patch('/:id/verify', verifyInvoiceHandler);

export default router;
