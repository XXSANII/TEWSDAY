import { prisma } from '../db';
import { generateId } from '../utils/typeid';
import { ApiError } from '../common/errors';
import { CreateSessionInput, CompleteSessionInput } from '../schemas/session.schema';
import { class_sessions_status_enum, class_sessions_payment_status_enum } from '@prisma/client';

export class SessionService {
  async getSessionsByBooking(bookingId: string) {
    return prisma.class_sessions.findMany({
      where: { booking_id: bookingId },
      orderBy: { scheduled_start: 'asc' },
    });
  }

  async createSession(bookingId: string, input: CreateSessionInput) {
    const start = new Date(input.scheduled_start);
    const end = new Date(input.scheduled_end);

    if (start >= end) {
      throw new ApiError(400, 'BAD_REQUEST', 'Start time must be strictly before end time');
    }

    const booking = await prisma.bookings.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new ApiError(404, 'NOT_FOUND', `Booking ${bookingId} not found`);
    }

    // Sessions cancelled by either side no longer block the tutor's calendar
    const overlappingSession = await prisma.class_sessions.findFirst({
      where: {
        tutor_id: booking.tutor_id,
        status: {
          notIn: [
            class_sessions_status_enum.CANCELLED_BY_STUDENT,
            class_sessions_status_enum.CANCELLED_BY_TUTOR,
          ],
        },
        AND: [{ scheduled_start: { lt: end } }, { scheduled_end: { gt: start } }],
      },
    });

    if (overlappingSession) {
      throw new ApiError(
        409,
        'CONFLICT',
        'Schedule conflict: Tutor already has an active session during this time frame',
      );
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    const hourlyRate = Number(booking.agreed_hourly_rate);
    const grossAmount = (durationMinutes / 60) * hourlyRate;

    return prisma.class_sessions.create({
      data: {
        id: generateId('ses'),
        booking_id: bookingId,
        student_id: booking.student_id,
        tutor_id: booking.tutor_id,
        scheduled_start: start,
        scheduled_end: end,
        hourly_rate: hourlyRate,
        duration_minutes: durationMinutes,
        gross_amount: grossAmount,
        status: class_sessions_status_enum.SCHEDULED,
        payment_status: class_sessions_payment_status_enum.PENDING_PAYMENT,
      },
    });
  }

  async getSessionById(sessionId: string) {
    const session = await prisma.class_sessions.findUnique({
      where: { id: sessionId },
      include: { bookings: true },
    });

    if (!session) {
      throw new ApiError(404, 'NOT_FOUND', `Session ${sessionId} not found`);
    }

    return session;
  }

  async startSession(sessionId: string) {
    const session = await prisma.class_sessions.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new ApiError(404, 'NOT_FOUND', `Session ${sessionId} not found`);
    }

    return prisma.class_sessions.update({
      where: { id: sessionId },
      data: {
        actual_start: new Date(),
        status: class_sessions_status_enum.IN_PROGRESS,
        updated_at: new Date(),
      },
    });
  }

  async completeSession(sessionId: string, input: CompleteSessionInput) {
    const session = await prisma.class_sessions.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new ApiError(404, 'NOT_FOUND', `Session ${sessionId} not found`);
    }

    return prisma.class_sessions.update({
      where: { id: sessionId },
      data: {
        actual_end: new Date(),
        session_feedback: input.session_feedback ?? null,
        homework_assigned: input.homework_assigned ?? null,
        status: class_sessions_status_enum.COMPLETED,
        updated_at: new Date(),
      },
    });
  }

  async confirmAttendance(sessionId: string) {
    const session = await prisma.class_sessions.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new ApiError(404, 'NOT_FOUND', `Session ${sessionId} not found`);
    }

    return prisma.class_sessions.update({
      where: { id: sessionId },
      data: {
        student_confirmed_at: new Date(),
        payment_status: class_sessions_payment_status_enum.STUDENT_PAID,
        updated_at: new Date(),
      },
    });
  }
}

export const sessionService = new SessionService();
