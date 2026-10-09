import { prisma } from '../db';
import { generateId } from '../utils/typeid';
import { CreateBookingInput, UpdateBookingStatusInput } from '../schemas/booking.schema';
import { bookings_status_enum, bookings_location_type_enum } from '@prisma/client';

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['COMPLETED', 'CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
  COMPLETED: [],
};

export class BookingService {
  async createBooking(studentId: string, input: CreateBookingInput) {
    const booking = await prisma.bookings.create({
      data: {
        id: generateId('bkg'),
        student_id: studentId,
        tutor_id: input.tutor_id,
        subject_id: input.subject_id,
        originating_job_id: input.job_id ?? null,
        agreed_hourly_rate: input.hourly_rate,
        location_type: input.learning_mode as bookings_location_type_enum,
        status: 'PENDING' as bookings_status_enum,
      },
    });

    return booking;
  }

  async getBookingById(bookingId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        class_sessions: true,
        invoices: true,
      },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    return booking;
  }

  async updateBookingStatus(bookingId: string, input: UpdateBookingStatusInput) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    const currentStatus = booking.status;
    const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(input.status)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to${input.status}. Allowed transitions: ${allowedNextStatuses.join(', ') || 'none'}`,
      );
    }

    const updatedBooking = await prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: input.status as bookings_status_enum,
        updated_at: new Date(),
      },
    });

    return updatedBooking;
  }
}

export const bookingService = new BookingService();
