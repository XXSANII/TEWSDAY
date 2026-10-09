import { z } from 'zod';
import { entityId } from '../../common/ids';
import {
  locationSchema,
  name,
  nullableText,
  money,
  positiveMoney,
  teachingMode,
  textArray,
  nonEmpty,
} from '../../common/validation';

const studentFields = {
  first_name: name,
  last_name: name,
  current_grade_level: z.string().trim().min(1).max(50),
  school_name: z.string().trim().min(1).max(150),
  location: locationSchema,
};
export const createStudentSchema = z.object(studentFields).strict();
export const updateStudentSchema = nonEmpty(z.object(studentFields).partial().shape);
export const contactSchema = nonEmpty({
  parent_name: nullableText(150),
  parent_phone_number: nullableText(30),
  parent_relationship: nullableText(50),
  emergency_contact_name: nullableText(150),
  emergency_contact_phone: nullableText(30),
  emergency_contact_relationship: nullableText(50),
});

const tutorFields = {
  bio: z.string().trim().min(1).max(10000),
  hourly_rate: positiveMoney,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']),
  teaching_location_type: teachingMode,
  location: locationSchema,
  service_radius_km: z.number().min(0).max(9999.99),
  promptpay_identifier: nullableText(50),
  bank_code: nullableText(20),
  bank_account_number: nullableText(50),
  bank_account_name: nullableText(150),
};
export const createTutorSchema = z
  .object({ first_name: name, last_name: name, ...tutorFields })
  .strict();
// Legal names, identity, verification and media processing states are not directly writable.
export const updateTutorSchema = nonEmpty(z.object(tutorFields).partial().shape);
export const educationSchema = z
  .object({
    institution: z.string().trim().min(1).max(150),
    degree: z.string().trim().min(1).max(150),
    major: z.string().trim().min(1).max(150),
    graduation_year: z.number().int().min(1900).max(2700),
    verification_document_file_id: entityId('fil').nullable().optional(),
  })
  .strict();

const slot = z
  .object({
    is_recurring: z.boolean(),
    day_of_week: z.number().int().min(0).max(6).nullable().optional(),
    specific_date: z.iso.date().nullable().optional(),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.start_time >= v.end_time)
      ctx.addIssue({ code: 'custom', message: 'start_time must precede end_time' });
    if (
      v.is_recurring
        ? v.day_of_week == null || v.specific_date != null
        : v.specific_date == null || v.day_of_week != null
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Recurring slots require only day_of_week; one-off slots require only specific_date',
      });
    }
  });
export const availabilitySchema = z
  .object({ slots: z.array(slot).max(100) })
  .strict()
  .superRefine((v, ctx) => {
    for (let i = 0; i < v.slots.length; i++) {
      for (let j = i + 1; j < v.slots.length; j++) {
        const a = v.slots[i]!;
        const b = v.slots[j]!;
        const sameDay =
          a.is_recurring === b.is_recurring &&
          (a.is_recurring ? a.day_of_week === b.day_of_week : a.specific_date === b.specific_date);
        if (sameDay && a.start_time < b.end_time && b.start_time < a.end_time)
          ctx.addIssue({ code: 'custom', message: 'Slots on the same day cannot overlap' });
      }
    }
  });

export const subjectsSchema = z
  .object({
    subjects: z
      .array(
        z
          .object({
            subject_id: entityId('sbj'),
            grade_levels: textArray(50),
            specialized_topics: textArray(200),
            custom_rate: money.nullable().optional(),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .refine(
    (v) => new Set(v.subjects.map((s) => s.subject_id)).size === v.subjects.length,
    'Duplicate subject',
  );

const requestBase = { supporting_document_file_id: entityId('fil').nullable().optional() };
export const changeRequestSchema = z.discriminatedUnion('request_type', [
  z
    .object({
      ...requestBase,
      request_type: z.literal('LEGAL_NAME'),
      requested_changes: nonEmpty({ first_name: name.optional(), last_name: name.optional() }),
    })
    .strict(),
  z
    .object({
      ...requestBase,
      request_type: z.literal('EDUCATION'),
      requested_changes: educationSchema.extend({ education_id: entityId('edu').optional() }),
    })
    .strict(),
]);

export type TutorInput = z.infer<typeof createTutorSchema>;
export type StudentInput = z.infer<typeof createStudentSchema>;
