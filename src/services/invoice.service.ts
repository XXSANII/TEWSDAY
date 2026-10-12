import { prisma } from '../db';
import { ApiError } from '../common/errors';
import { PayInvoiceInput } from '../schemas/invoice.schema';
import { invoices_status_enum } from '@prisma/client';

export class InvoiceService {
  async getUserInvoices(userId: string) {
    return prisma.invoices.findMany({
      where: {
        OR: [{ payer_user_id: userId }, { payee_user_id: userId }],
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getInvoiceById(invoiceId: string) {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: { bookings: true, class_sessions: true },
    });

    if (!invoice) {
      throw new ApiError(404, 'NOT_FOUND', `Invoice ${invoiceId} not found`);
    }

    return invoice;
  }

  async payInvoice(invoiceId: string, input: PayInvoiceInput) {
    const invoice = await prisma.invoices.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new ApiError(404, 'NOT_FOUND', `Invoice ${invoiceId} not found`);
    }

    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new ApiError(409, 'CONFLICT', 'Invoice is already paid or cancelled');
    }

    return prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        slip_file_id: input.slip_file_id,
        status: 'PENDING_VERIFICATION' as invoices_status_enum,
        updated_at: new Date(),
      },
    });
  }

  async verifyInvoice(invoiceId: string, verifierUserId: string) {
    const invoice = await prisma.invoices.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new ApiError(404, 'NOT_FOUND', `Invoice ${invoiceId} not found`);
    }

    return prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID' as invoices_status_enum,
        paid_at: new Date(),
        verified_by: verifierUserId,
        updated_at: new Date(),
      },
    });
  }
}

export const invoiceService = new InvoiceService();
