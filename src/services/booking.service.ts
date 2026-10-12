import { prisma } from '../db';
import { generateId } from '../utils/typeid';
import { ApiError } from '../common/errors';
import {
  CreateBookingInput,
  UploadContractInput,
  CancelBookingInput,
} from '../schemas/booking.schema';
import { bookings_status_enum, bookings_location_type_enum } from '@prisma/client';

export class BookingService {
  async createBooking(userId: string, input: CreateBookingInput) {
    const studentProfile = await prisma.student_profiles.findUnique({
      where: { user_id: userId },
    });
    if (!studentProfile) {
      throw new ApiError(404, 'NOT_FOUND', 'Student profile not found');
    }

    const tutorProfile = await prisma.tutor_profiles.findFirst({
      where: {
        OR: [{ id: input.tutor_id }, { user_id: input.tutor_id }],
      },
    });
    if (!tutorProfile) {
      throw new ApiError(404, 'NOT_FOUND', 'Tutor profile not found');
    }

    return prisma.bookings.create({
      data: {
        id: generateId('bkg'),
        student_id: studentProfile.id,
        tutor_id: tutorProfile.id,
        subject_id: input.subject_id,
        originating_job_id: input.job_id ?? null,
        agreed_hourly_rate: input.hourly_rate,
        location_type: input.learning_mode as bookings_location_type_enum,
        meeting_location: input.meeting_location ?? null,
        meeting_url: input.meeting_url ?? null,
        status: 'PENDING_CONFIRMATION' as bookings_status_enum,
      },
    });
  }

  async getUserBookings(userId: string) {
    const studentProfile = await prisma.student_profiles.findUnique({
      where: { user_id: userId },
    });
    const tutorProfile = await prisma.tutor_profiles.findUnique({
      where: { user_id: userId },
    });

    const conditions = [];
    if (studentProfile) conditions.push({ student_id: studentProfile.id });
    if (tutorProfile) conditions.push({ tutor_id: tutorProfile.id });

    if (conditions.length === 0) return [];

    return prisma.bookings.findMany({
      where: {
        OR: conditions,
      },
      include: {
        class_sessions: true,
        invoices: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getBookingById(bookingId: string) {
    const booking = await prisma.bookings.findUnique({
      where: { id: bookingId },
      include: {
        class_sessions: true,
        invoices: true,
        student_profiles: true,
        tutor_profiles: true,
        subjects: true,
      },
    });

    if (!booking) {
      throw new ApiError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);
    }

    return booking;
  }

  async uploadContract(bookingId: string, input: UploadContractInput) {
    const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new ApiError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);
    }

    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      throw new ApiError(
        409,
        'CONFLICT',
        'Cannot upload contract for cancelled or rejected booking',
      );
    }

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        signed_contract_file_id: input.signed_contract_file_id,
        contract_uploaded_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  async confirmBooking(bookingId: string) {
    const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new ApiError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);
    }

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: 'ACTIVE' as bookings_status_enum,
        updated_at: new Date(),
      },
    });
  }

  async cancelBooking(bookingId: string, _input: CancelBookingInput) {
    const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new ApiError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);
    }

    return prisma.bookings.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED' as bookings_status_enum,
        updated_at: new Date(),
      },
    });
  }
}

export const bookingService = new BookingService();
