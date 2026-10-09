import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service';

export async function createInvoiceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await invoiceService.createInvoice(req.body);
    return res.status(201).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function getInvoiceByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await invoiceService.getInvoiceById(id);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function verifySlipHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await invoiceService.verifySlip(id, req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}
