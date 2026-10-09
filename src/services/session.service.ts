import { prisma } from '../db';
import { generateId } from '../utils/typeid';
import { CreateSessionInput, UpdateSessionStatusInput } from '../schemas/session.schema';
import { class_sessions_status_enum, class_sessions_payment_status_enum } from '@prisma/client';

export class SessionService {
  async createSession(input: CreateSessionInput) {
    const start = new Date(input.start_time);
    const end = new Date(input.end_time);

    if (start >= end) {
      throw new Error('Start time must be strictly before end time');
    }

    const booking = await prisma.bookings.findUnique({
      where: { id: input.booking_id },
    });

    if (!booking) {
      throw new Error(`Booking ${input.booking_id} not found`);
    }

    // Overlap check for tutor's schedule across non-cancelled sessions
    const overlappingSession = await prisma.class_sessions.findFirst({
      where: {
        tutor_id: booking.tutor_id,
        status: { notIn: ['CANCELLED' as class_sessions_status_enum] },
        AND: [{ scheduled_start: { lt: end } }, { scheduled_end: { gt: start } }],
      },
    });

    if (overlappingSession) {
      throw new Error(
        'Schedule conflict: Tutor already has an active session during this time frame',
      );
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    const hourlyRate = Number(booking.agreed_hourly_rate);
    const grossAmount = (durationMinutes / 60) * hourlyRate;

    const session = await prisma.class_sessions.create({
      data: {
        id: generateId('ses'),
        booking_id: input.booking_id,
        student_id: booking.student_id,
        tutor_id: booking.tutor_id,
        scheduled_start: start,
        scheduled_end: end,
        hourly_rate: hourlyRate,
        duration_minutes: durationMinutes,
        gross_amount: grossAmount,
        status: 'SCHEDULED' as class_sessions_status_enum,
        payment_status: 'UNPAID' as class_sessions_payment_status_enum,
      },
    });

    return session;
  }

  async getSessionsByBooking(bookingId: string) {
    return prisma.class_sessions.findMany({
      where: { booking_id: bookingId },
      orderBy: { scheduled_start: 'asc' },
    });
  }

  async updateSessionStatus(sessionId: string, input: UpdateSessionStatusInput) {
    const session = await prisma.class_sessions.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updated = await prisma.class_sessions.update({
      where: { id: sessionId },
      data: {
        status: input.status as class_sessions_status_enum,
        updated_at: new Date(),
      },
    });

    return updated;
  }
}

export const sessionService = new SessionService();
