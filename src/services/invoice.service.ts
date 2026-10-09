import { prisma } from '../db';
import { generateId } from '../utils/typeid';
import { CreateInvoiceInput, VerifySlipInput } from '../schemas/invoice.schema';
import { invoices_status_enum, invoices_invoice_type_enum } from '@prisma/client';

export class InvoiceService {
  async createInvoice(input: CreateInvoiceInput) {
    const booking = await prisma.bookings.findUnique({
      where: { id: input.booking_id },
    });

    if (!booking) {
      throw new Error(`Booking ${input.booking_id} not found`);
    }

    const subtotal = Number(booking.agreed_hourly_rate);
    const commissionFee = (subtotal * input.commission_rate) / 100;
    const totalAmount = subtotal + commissionFee;

    const invoice = await prisma.invoices.create({
      data: {
        id: generateId('inv'),
        invoice_number: `INV-${Date.now()}`,
        invoice_type: 'TUITION' as invoices_invoice_type_enum,
        booking_id: input.booking_id,
        payer_user_id: booking.student_id,
        payee_user_id: booking.tutor_id,
        amount: totalAmount,
        commission_fee: commissionFee,
        status: 'UNPAID' as invoices_status_enum,
      },
    });

    return invoice;
  }

  async verifySlip(invoiceId: string, input: VerifySlipInput) {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status === 'PAID') {
      throw new Error('Invoice has already been paid');
    }

    const requiredAmount = Number(invoice.amount);
    if (input.transferred_amount < requiredAmount) {
      throw new Error(
        `Insufficient transferred amount. Required: ${requiredAmount}, Received: ${input.transferred_amount}`,
      );
    }

    const updatedInvoice = await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        slip_file_id: input.slip_url,
        status: 'PAID' as invoices_status_enum,
        paid_at: new Date(),
        updated_at: new Date(),
      },
    });

    return updatedInvoice;
  }

  async getInvoiceById(invoiceId: string) {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: { bookings: true },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    return invoice;
  }
}

export const invoiceService = new InvoiceService();
