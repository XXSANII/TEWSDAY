-- Canonical Database Schema V2 only. AI/Embedding migrations are separate.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "users_current_mode_enum" AS ENUM ('STUDENT', 'TUTOR', 'ADMIN');

CREATE TYPE "user_auth_providers_provider_enum" AS ENUM ('LOCAL', 'GOOGLE', 'APPLE', 'LINE', 'FACEBOOK');

CREATE TYPE "tutor_profiles_gender_enum" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

CREATE TYPE "tutor_profiles_teaching_location_type_enum" AS ENUM ('ONLINE', 'ONSITE', 'BOTH');

CREATE TYPE "tutor_profiles_verification_status_enum" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

CREATE TYPE "tutor_profiles_account_status_enum" AS ENUM ('ACTIVE', 'RESTRICTED', 'SUSPENDED');

CREATE TYPE "profile_change_requests_request_type_enum" AS ENUM ('LEGAL_NAME', 'EDUCATION', 'IDENTIFICATION', 'OTHER');

CREATE TYPE "profile_change_requests_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TYPE "storage_files_file_category_enum" AS ENUM ('AVATAR', 'INTRO_VIDEO', 'VIDEO_THUMBNAIL', 'VERIFICATION_DOC', 'CHANGE_REQUEST_DOC', 'PAYMENT_SLIP', 'SIGNED_CONTRACT_PDF', 'CHAT_MEDIA', 'QUESTION_IMAGE', 'ANSWER_IMAGE', 'OTHER');

CREATE TYPE "student_jobs_location_type_enum" AS ENUM ('ONLINE', 'ONSITE', 'BOTH');

CREATE TYPE "student_jobs_status_enum" AS ENUM ('OPEN', 'MATCHED', 'CLOSED', 'CANCELLED');

CREATE TYPE "job_applications_status_enum" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

CREATE TYPE "bookings_location_type_enum" AS ENUM ('ONLINE', 'ONSITE');

CREATE TYPE "bookings_status_enum" AS ENUM ('PENDING_CONFIRMATION', 'ACTIVE', 'REJECTED', 'COMPLETED', 'CANCELLED');

CREATE TYPE "class_sessions_status_enum" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_STUDENT', 'CANCELLED_BY_TUTOR', 'NO_SHOW');

CREATE TYPE "class_sessions_payment_status_enum" AS ENUM ('PENDING_PAYMENT', 'STUDENT_PAID', 'TUTOR_CONFIRMED', 'DISPUTED');

CREATE TYPE "invoices_invoice_type_enum" AS ENUM ('STUDENT_TUITION', 'TUTOR_COMMISSION');

CREATE TYPE "invoices_status_enum" AS ENUM ('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'CANCELLED');

CREATE TYPE "invoices_payment_method_enum" AS ENUM ('BANK_TRANSFER', 'PROMPTPAY', 'CREDIT_CARD', 'CASH', 'OTHER');

CREATE TYPE "messages_message_type_enum" AS ENUM ('TEXT', 'EMOJI', 'IMAGE', 'VIDEO', 'FILE');

CREATE TYPE "notifications_priority_tier_enum" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TYPE "entity_audit_logs_action_enum" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

CREATE TYPE "student_questions_status_enum" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');

CREATE TABLE "users" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "email" VARCHAR(255) NOT NULL,
  "email_verified_at" TIMESTAMPTZ ,
  "phone_number" VARCHAR(30) ,
  "phone_verified_at" TIMESTAMPTZ ,
  "avatar_file_id" VARCHAR(36) ,
  "roles" VARCHAR(20)[] NOT NULL DEFAULT ARRAY['STUDENT']::varchar[],
  "current_mode" "users_current_mode_enum" NOT NULL DEFAULT 'STUDENT',
  "notification_settings" JSONB NOT NULL DEFAULT '{"push_enabled": true, "email_enabled": true, "sms_urgent_only": true, "chat_enabled": true, "session_reminders": true}'::jsonb,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_auth_providers" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "user_id" VARCHAR(36) NOT NULL,
  "provider" "user_auth_providers_provider_enum" NOT NULL,
  "provider_user_id" VARCHAR(255) ,
  "password_hash" VARCHAR(255) ,
  "metadata" JSONB ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_sessions" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "user_id" VARCHAR(36) NOT NULL,
  "refresh_token_hash" VARCHAR(255) NOT NULL UNIQUE,
  "device_name" VARCHAR(100) ,
  "ip_address" INET ,
  "user_agent" TEXT ,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "is_revoked" BOOLEAN NOT NULL DEFAULT FALSE,
  "revoked_at" TIMESTAMPTZ ,
  "last_active_at" TIMESTAMPTZ NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "tutor_profiles" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "user_id" VARCHAR(36) NOT NULL UNIQUE,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "gender" "tutor_profiles_gender_enum" NOT NULL,
  "bio" TEXT NOT NULL,
  "hourly_rate" NUMERIC(10,2) NOT NULL,
  "teaching_location_type" "tutor_profiles_teaching_location_type_enum" NOT NULL,
  "location" GEOMETRY(Point, 4326) NOT NULL,
  "service_radius_km" NUMERIC(6,2) NOT NULL,
  "promptpay_identifier" VARCHAR(50) ,
  "bank_code" VARCHAR(20) ,
  "bank_account_number" VARCHAR(50) ,
  "bank_account_name" VARCHAR(150) ,
  "intro_video_file_id" VARCHAR(36) ,
  "intro_video_thumbnail_file_id" VARCHAR(36) ,
  "intro_video_hls_url" TEXT ,
  "intro_video_status" VARCHAR(20) NOT NULL,
  "verification_status" "tutor_profiles_verification_status_enum" NOT NULL,
  "account_status" "tutor_profiles_account_status_enum" NOT NULL,
  "account_status_reason" TEXT ,
  "account_status_updated_at" TIMESTAMPTZ ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "student_profiles" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "user_id" VARCHAR(36) NOT NULL UNIQUE,
  "first_name" VARCHAR(100) NOT NULL,
  "last_name" VARCHAR(100) NOT NULL,
  "current_grade_level" VARCHAR(50) NOT NULL,
  "school_name" VARCHAR(150) NOT NULL,
  "location" GEOMETRY(Point, 4326) NOT NULL,
  "parent_name" VARCHAR(150) ,
  "parent_phone_number" VARCHAR(30) ,
  "parent_relationship" VARCHAR(50) ,
  "emergency_contact_name" VARCHAR(150) ,
  "emergency_contact_phone" VARCHAR(30) ,
  "emergency_contact_relationship" VARCHAR(50) ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "subjects" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "name_th" VARCHAR(100) NOT NULL,
  "name_en" VARCHAR(100) NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "tutor_subjects" (
  "tutor_id" VARCHAR(36) NOT NULL,
  "subject_id" VARCHAR(36) NOT NULL,
  "grade_levels" VARCHAR(50)[] NOT NULL,
  "specialized_topics" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "custom_rate" NUMERIC(10,2) ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tutor_id, subject_id)
);

CREATE TABLE "tutor_education" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "tutor_id" VARCHAR(36) NOT NULL,
  "institution" VARCHAR(150) NOT NULL,
  "degree" VARCHAR(150) NOT NULL,
  "major" VARCHAR(150) NOT NULL,
  "graduation_year" SMALLINT NOT NULL,
  "verification_document_file_id" VARCHAR(36) ,
  "is_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "tutor_availability" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "tutor_id" VARCHAR(36) NOT NULL,
  "is_recurring" BOOLEAN NOT NULL,
  "day_of_week" SMALLINT ,
  "specific_date" DATE ,
  "start_time" TIME NOT NULL,
  "end_time" TIME NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "profile_change_requests" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "tutor_id" VARCHAR(36) NOT NULL,
  "user_id" VARCHAR(36) NOT NULL,
  "request_type" "profile_change_requests_request_type_enum" NOT NULL,
  "current_data" JSONB NOT NULL,
  "requested_changes" JSONB NOT NULL,
  "supporting_document_file_id" VARCHAR(36) ,
  "status" "profile_change_requests_status_enum" NOT NULL DEFAULT 'PENDING',
  "rejection_reason" TEXT ,
  "reviewed_by" VARCHAR(36) ,
  "reviewed_at" TIMESTAMPTZ ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "storage_files" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "bucket_name" VARCHAR(100) NOT NULL,
  "file_key" TEXT NOT NULL UNIQUE,
  "file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "file_size_bytes" BIGINT NOT NULL,
  "file_category" "storage_files_file_category_enum" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "student_jobs" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "student_id" VARCHAR(36) NOT NULL,
  "subject_id" VARCHAR(36) NOT NULL,
  "target_grade_level" VARCHAR(50) NOT NULL,
  "target_topics" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "learning_goal" TEXT NOT NULL,
  "budget_min" NUMERIC(10,2) NOT NULL,
  "budget_max" NUMERIC(10,2) NOT NULL,
  "location_type" "student_jobs_location_type_enum" NOT NULL,
  "location" GEOMETRY(Point, 4326) ,
  "frequency_per_week" SMALLINT NOT NULL,
  "preferred_days" SMALLINT[] NOT NULL,
  "status" "student_jobs_status_enum" NOT NULL,
  "share_count" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "job_applications" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "job_id" VARCHAR(36) NOT NULL,
  "tutor_id" VARCHAR(36) NOT NULL,
  "proposed_rate" NUMERIC(10,2) NOT NULL,
  "cover_message" TEXT NOT NULL,
  "status" "job_applications_status_enum" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "bookings" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "student_id" VARCHAR(36) NOT NULL,
  "tutor_id" VARCHAR(36) NOT NULL,
  "subject_id" VARCHAR(36) NOT NULL,
  "originating_job_id" VARCHAR(36) ,
  "agreed_hourly_rate" NUMERIC(10,2) NOT NULL,
  "location_type" "bookings_location_type_enum" NOT NULL,
  "meeting_location" TEXT ,
  "meeting_url" TEXT ,
  "signed_contract_file_id" VARCHAR(36) ,
  "contract_uploaded_at" TIMESTAMPTZ ,
  "status" "bookings_status_enum" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "class_sessions" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "booking_id" VARCHAR(36) NOT NULL,
  "student_id" VARCHAR(36) NOT NULL,
  "tutor_id" VARCHAR(36) NOT NULL,
  "scheduled_start" TIMESTAMPTZ NOT NULL,
  "scheduled_end" TIMESTAMPTZ NOT NULL,
  "actual_start" TIMESTAMPTZ ,
  "actual_end" TIMESTAMPTZ ,
  "hourly_rate" NUMERIC(10,2) NOT NULL,
  "duration_minutes" SMALLINT NOT NULL DEFAULT 60,
  "gross_amount" NUMERIC(10,2) NOT NULL,
  "session_feedback" TEXT ,
  "homework_assigned" TEXT ,
  "status" "class_sessions_status_enum" NOT NULL,
  "payment_status" "class_sessions_payment_status_enum" NOT NULL,
  "dispute_reason" TEXT ,
  "student_confirmed_at" TIMESTAMPTZ ,
  "tutor_confirmed_at" TIMESTAMPTZ ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "invoices" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "invoice_number" VARCHAR(50) NOT NULL UNIQUE,
  "invoice_type" "invoices_invoice_type_enum" NOT NULL,
  "booking_id" VARCHAR(36) ,
  "class_session_id" VARCHAR(36) ,
  "payer_user_id" VARCHAR(36) NOT NULL,
  "payee_user_id" VARCHAR(36) NOT NULL,
  "amount" NUMERIC(10,2) NOT NULL,
  "commission_fee" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "status" "invoices_status_enum" NOT NULL DEFAULT 'UNPAID',
  "payment_method" "invoices_payment_method_enum" ,
  "slip_file_id" VARCHAR(36) ,
  "due_date" DATE ,
  "paid_at" TIMESTAMPTZ ,
  "verified_by" VARCHAR(36) ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "conversations" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "booking_id" VARCHAR(36) ,
  "student_id" VARCHAR(36) NOT NULL,
  "tutor_id" VARCHAR(36) NOT NULL,
  "last_message_at" TIMESTAMPTZ ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "messages" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "conversation_id" VARCHAR(36) NOT NULL,
  "sender_id" VARCHAR(36) NOT NULL,
  "content" TEXT ,
  "message_type" "messages_message_type_enum" NOT NULL DEFAULT 'TEXT',
  "file_id" VARCHAR(36) ,
  "thumbnail_file_id" VARCHAR(36) ,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "reviews" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "class_session_id" VARCHAR(36) NOT NULL,
  "reviewer_user_id" VARCHAR(36) NOT NULL,
  "reviewee_user_id" VARCHAR(36) NOT NULL,
  "review_type" VARCHAR(20) NOT NULL CHECK (review_type IN ('STUDENT_TO_TUTOR','TUTOR_TO_STUDENT')),
  "tutor_id" VARCHAR(36) ,
  "rating_score" SMALLINT NOT NULL CHECK (rating_score BETWEEN 1 AND 5),
  "comment" TEXT ,
  "is_published" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "notifications" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "user_id" VARCHAR(36) NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "body" TEXT NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "priority_tier" "notifications_priority_tier_enum" NOT NULL DEFAULT 'NORMAL',
  "reference_type" VARCHAR(50) ,
  "reference_id" VARCHAR(36) ,
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "user_activity_logs" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "user_id" VARCHAR(36) ,
  "browser_session_id" VARCHAR(100) NOT NULL,
  "event_name" VARCHAR(100) NOT NULL,
  "page_path" VARCHAR(255) NOT NULL,
  "element_id" VARCHAR(100) ,
  "metadata" JSONB ,
  "ip_address" INET ,
  "user_agent" TEXT ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "entity_audit_logs" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "table_name" VARCHAR(64) NOT NULL,
  "record_id" VARCHAR(36) NOT NULL,
  "action" "entity_audit_logs_action_enum" NOT NULL,
  "old_data" JSONB ,
  "new_data" JSONB ,
  "changed_fields" JSONB ,
  "changed_by" VARCHAR(36) ,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "student_questions" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "student_id" VARCHAR(36) NOT NULL,
  "subject_id" VARCHAR(36) NOT NULL,
  "target_topics" TEXT[] NOT NULL DEFAULT '{}'::text[],
  "title" VARCHAR(200) NOT NULL,
  "content" TEXT NOT NULL,
  "question_image_file_id" VARCHAR(36) ,
  "status" "student_questions_status_enum" NOT NULL DEFAULT 'OPEN',
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "answers_count" INTEGER NOT NULL DEFAULT 0,
  "share_count" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "question_answers" (
  "id" VARCHAR(36) NOT NULL PRIMARY KEY,
  "question_id" VARCHAR(36) NOT NULL,
  "tutor_id" VARCHAR(36) NOT NULL,
  "content" TEXT NOT NULL,
  "solution_file_id" VARCHAR(36) ,
  "is_accepted" BOOLEAN NOT NULL DEFAULT FALSE,
  "accepted_at" TIMESTAMPTZ ,
  "upvote_count" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" VARCHAR(36) ,
  "updated_by" VARCHAR(36) ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "users" ADD CONSTRAINT "users_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_intro_video_file_id_fkey" FOREIGN KEY ("intro_video_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_intro_video_thumbnail_file_id_fkey" FOREIGN KEY ("intro_video_thumbnail_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subjects" ADD CONSTRAINT "subjects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subjects" ADD CONSTRAINT "subjects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_education" ADD CONSTRAINT "tutor_education_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_education" ADD CONSTRAINT "tutor_education_verification_document_file_id_fkey" FOREIGN KEY ("verification_document_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_education" ADD CONSTRAINT "tutor_education_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_education" ADD CONSTRAINT "tutor_education_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_availability" ADD CONSTRAINT "tutor_availability_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_availability" ADD CONSTRAINT "tutor_availability_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tutor_availability" ADD CONSTRAINT "tutor_availability_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_supporting_document_file_id_fkey" FOREIGN KEY ("supporting_document_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "profile_change_requests" ADD CONSTRAINT "profile_change_requests_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storage_files" ADD CONSTRAINT "storage_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "storage_files" ADD CONSTRAINT "storage_files_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_jobs" ADD CONSTRAINT "student_jobs_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_jobs" ADD CONSTRAINT "student_jobs_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_jobs" ADD CONSTRAINT "student_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_jobs" ADD CONSTRAINT "student_jobs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "student_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_originating_job_id_fkey" FOREIGN KEY ("originating_job_id") REFERENCES "student_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_signed_contract_file_id_fkey" FOREIGN KEY ("signed_contract_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payee_user_id_fkey" FOREIGN KEY ("payee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_slip_file_id_fkey" FOREIGN KEY ("slip_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_thumbnail_file_id_fkey" FOREIGN KEY ("thumbnail_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_class_session_id_fkey" FOREIGN KEY ("class_session_id") REFERENCES "class_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_user_id_fkey" FOREIGN KEY ("reviewee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entity_audit_logs" ADD CONSTRAINT "entity_audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entity_audit_logs" ADD CONSTRAINT "entity_audit_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "entity_audit_logs" ADD CONSTRAINT "entity_audit_logs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_questions" ADD CONSTRAINT "student_questions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_questions" ADD CONSTRAINT "student_questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_questions" ADD CONSTRAINT "student_questions_question_image_file_id_fkey" FOREIGN KEY ("question_image_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_questions" ADD CONSTRAINT "student_questions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_questions" ADD CONSTRAINT "student_questions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "student_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_solution_file_id_fkey" FOREIGN KEY ("solution_file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "question_answers" ADD CONSTRAINT "question_answers_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
