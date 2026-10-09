import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/db';
import { reset, person, Person, subjectId } from './helpers';
import {
  bookings_status_enum,
  invoices_invoice_type_enum,
  storage_files_file_category_enum,
} from '@prisma/client';

describe('Core Business Logic (Cards 9, 10, 11)', () => {
  let student: Person;
  let tutor: Person;
  let bookingId: string;
  let sessionId: string;
  let invoiceId: string;

  beforeAll(async () => {
    await reset();
    student = await person(app, 'student');
    tutor = await person(app, 'tutor');

    // Seed mock storage files to satisfy foreign key constraints
    await prisma.storage_files.createMany({
      data: [
        {
          id: 'fil_contract_123',
          bucket_name: 'contracts',
          file_key: 'contracts/fil_contract_123.pdf',
          file_name: 'contract.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 1024,
          file_category: storage_files_file_category_enum.VERIFICATION_DOC,
        },
        {
          id: 'fil_slip_999',
          bucket_name: 'slips',
          file_key: 'slips/fil_slip_999.jpg',
          file_name: 'slip.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 2048,
          file_category: storage_files_file_category_enum.PAYMENT_SLIP,
        },
      ],
    });
  });

  describe('Card 9: Bookings API', () => {
    it('POST /api/v1/bookings — creates a booking request', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .auth(student.token, { type: 'bearer' })
        .send({
          tutor_id: tutor.tutorId,
          subject_id: subjectId,
          hourly_rate: 500,
          learning_mode: 'ONLINE',
          meeting_url: 'https://meet.google.com/abc-defg-hij',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      bookingId = res.body.data.id;
    });

    it('GET /api/v1/bookings — lists user bookings', async () => {
      const res = await request(app)
        .get('/api/v1/bookings')
        .auth(student.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/bookings/:id — gets booking details', async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${bookingId}`)
        .auth(student.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(bookingId);
    });

    it('POST /api/v1/bookings/:id/contract — uploads signed contract', async () => {
      const res = await request(app)
        .post(`/api/v1/bookings/${bookingId}/contract`)
        .auth(student.token, { type: 'bearer' })
        .send({
          signed_contract_file_id: 'fil_contract_123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.signed_contract_file_id).toBe('fil_contract_123');
    });

    it('PATCH /api/v1/bookings/:id/confirm — confirms booking', async () => {
      const res = await request(app)
        .patch(`/api/v1/bookings/${bookingId}/confirm`)
        .auth(tutor.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('PATCH /api/v1/bookings/:id/cancel — cancels booking', async () => {
      const tempBooking = await prisma.bookings.create({
        data: {
          id: 'bkg_temp_cancel',
          student_id: student.studentId!,
          tutor_id: tutor.tutorId!,
          subject_id: subjectId,
          agreed_hourly_rate: 400,
          location_type: 'ONLINE',
          status: 'PENDING_CONFIRMATION' as bookings_status_enum,
        },
      });

      const res = await request(app)
        .patch(`/api/v1/bookings/${tempBooking.id}/cancel`)
        .auth(student.token, { type: 'bearer' })
        .send({ reason: 'Schedule clash' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CANCELLED');
    });
  });

  describe('Card 10: Class Sessions API', () => {
    it('POST /api/v1/bookings/:id/sessions — schedules a new session', async () => {
      const start = new Date(Date.now() + 86400000).toISOString();
      const end = new Date(Date.now() + 86400000 + 7200000).toISOString();

      const res = await request(app)
        .post(`/api/v1/bookings/${bookingId}/sessions`)
        .auth(tutor.token, { type: 'bearer' })
        .send({
          scheduled_start: start,
          scheduled_end: end,
        });

      if (res.status !== 201) {
        console.error('Session creation failed:', res.status, res.body);
      }

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      sessionId = res.body.data.id;
    });

    it('GET /api/v1/bookings/:id/sessions — lists sessions for booking', async () => {
      const res = await request(app)
        .get(`/api/v1/bookings/${bookingId}/sessions`)
        .auth(student.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/sessions/:id — gets session details', async () => {
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}`)
        .auth(student.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(sessionId);
    });

    it('PATCH /api/v1/sessions/:id/start — starts session', async () => {
      const res = await request(app)
        .patch(`/api/v1/sessions/${sessionId}/start`)
        .auth(tutor.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.actual_start).not.toBeNull();
    });

    it('PATCH /api/v1/sessions/:id/complete — completes session', async () => {
      const res = await request(app)
        .patch(`/api/v1/sessions/${sessionId}/complete`)
        .auth(tutor.token, { type: 'bearer' })
        .send({
          session_feedback: 'Great participation',
          homework_assigned: 'Complete exercises 1 to 10',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.session_feedback).toBe('Great participation');
    });

    it('PATCH /api/v1/sessions/:id/confirm-attendance — student confirms attendance', async () => {
      const res = await request(app)
        .patch(`/api/v1/sessions/${sessionId}/confirm-attendance`)
        .auth(student.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.body.data.student_confirmed_at).not.toBeNull();
    });
  });

  describe('Card 11: Invoices API', () => {
    beforeAll(async () => {
      const inv = await prisma.invoices.create({
        data: {
          id: 'inv_test_123',
          invoice_number: 'INV-TEST-001',
          invoice_type: 'STUDENT_TUITION' as invoices_invoice_type_enum,
          booking_id: bookingId,
          payer_user_id: student.userId,
          payee_user_id: tutor.userId,
          amount: 1000,
          commission_fee: 100,
          status: 'UNPAID',
        },
      });
      invoiceId = inv.id;
    });

    it('GET /api/v1/invoices — lists user invoices', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .auth(student.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/invoices/:id — gets invoice details', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .auth(student.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(invoiceId);
    });

    it('POST /api/v1/invoices/:id/pay — submits payment slip', async () => {
      const res = await request(app)
        .post(`/api/v1/invoices/${invoiceId}/pay`)
        .auth(student.token, { type: 'bearer' })
        .send({ slip_file_id: 'fil_slip_999' });

      expect(res.status).toBe(200);
      expect(res.body.data.slip_file_id).toBe('fil_slip_999');
      expect(res.body.data.status).toBe('PENDING_VERIFICATION');
    });

    it('PATCH /api/v1/invoices/:id/verify — verifies invoice payment', async () => {
      const res = await request(app)
        .patch(`/api/v1/invoices/${invoiceId}/verify`)
        .auth(tutor.token, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.paid_at).not.toBeNull();
    });
  });
});
