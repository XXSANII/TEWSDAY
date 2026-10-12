import { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service';

export async function getUserInvoicesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.actor.userId;
    const result = await invoiceService.getUserInvoices(userId);
    return res.status(200).json({ data: result });
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

export async function payInvoiceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await invoiceService.payInvoice(id, req.body);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}

export async function verifyInvoiceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const verifierUserId = req.actor.userId;
    const result = await invoiceService.verifyInvoice(id, verifierUserId);
    return res.status(200).json({ data: result });
  } catch (error) {
    return next(error);
  }
}
