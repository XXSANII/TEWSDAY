# Database Schema — แพลตฟอร์มหาครูสอนพิเศษ

## Domain 1: Identity, Profiles & Qualifications (ระบบผู้ใช้และโปรไฟล์)

### 1. `users` (บัญชีผู้ใช้หลัก)

* `id` (**VARCHAR(36)**, PK, Prefix: `usr_`) — รหัสผู้ใช้
* `email` (VARCHAR(255)) — อีเมลหลักสำหรับเข้าสู่ระบบและติดต่อ
* `email_verified_at` (TIMESTAMPTZ, Nullable) — เวลาที่ยืนยันอีเมลสำเร็จ
* `phone_number` (VARCHAR(30), Nullable) — เบอร์โทรศัพท์
* `phone_verified_at` (TIMESTAMPTZ, Nullable) — เวลาที่ยืนยันเบอร์โทรสำเร็จ
* `avatar_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงรูปโปรไฟล์ (`fil_...`)
* `roles` (VARCHAR(20)[], Default: `ARRAY['STUDENT']::varchar[]`) — บทบาท/สิทธิ์ที่ถือครอง (`STUDENT`, `TUTOR`, `ADMIN`)
* `current_mode` (ENUM: `STUDENT`, `TUTOR`, `ADMIN`, Default: `STUDENT`) — โหมดหน้าจอการใช้งานปัจจุบัน
* `notification_settings` (JSONB, Default: `'{"push_enabled": true, "email_enabled": true, "sms_urgent_only": true, "chat_enabled": true, "session_reminders": true}'::jsonb`) — การตั้งค่าการเปิด/ปิดช่องทางรับแจ้งเตือนของผู้ใช้
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะเปิดใช้งาน/ปิดบัญชี (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างข้อมูล (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 2. `user_auth_providers` (ช่องทางและกลไกการยืนยันตัวตน)

* `id` (**VARCHAR(36)**, PK, Prefix: `uap_`) — รหัสรายการ Provider
* `user_id` (**VARCHAR(36)**, FK -> `users`) — รหัสบัญชีผู้ใช้ที่เป็นเจ้าของสิทธิ์ (`usr_...`)
* `provider` (ENUM: `LOCAL`, `GOOGLE`, `APPLE`, `LINE`, `FACEBOOK`) — ชนิดของผู้ให้บริการยืนยันตัวตน
* `provider_user_id` (VARCHAR(255), Nullable) — ID ฝั่ง Provider เช่น `sub` (Google), UID (Apple/LINE)
* `password_hash` (VARCHAR(255), Nullable) — รหัสผ่านแฮช (เฉพาะกรณี `provider = 'LOCAL'`)
* `metadata` (JSONB, Nullable) — เก็บ Payload เสริม เช่น Token หรือ Profile ดั้งเดิม
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะเปิด/ปิดการล็อกอินผ่านช่องทางนี้
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างรายการ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 3. `user_sessions` (เซสชันการเข้าสู่ระบบและ Refresh Token)

* `id` (**VARCHAR(36)**, PK, Prefix: `uss_`) — รหัสเซสชันล็อกอิน
* `user_id` (**VARCHAR(36)**, FK -> `users`) — รหัสผู้ใช้เจ้าของเซสชัน (`usr_...`)
* `refresh_token_hash` (VARCHAR(255), Unique) — ค่า SHA-256 แฮชของ Refresh Token
* `device_name` (VARCHAR(100), Nullable) — ชื่ออุปกรณ์ที่ใช้ (เช่น `Chrome on macOS`, `iPhone 15 Safari`)
* `ip_address` (INET, Nullable) — หมายเลข IP Address ล่าสุดที่ใช้งาน
* `user_agent` (TEXT, Nullable) — ข้อมูล User-Agent ของเบราว์เซอร์
* `expires_at` (TIMESTAMPTZ) — เวลาหมดอายุของ Refresh Token
* `is_revoked` (BOOLEAN, Default: `FALSE`) — สถานะเพิกถอนสิทธิ์ (Sign Out หรือ Force Logout)
* `revoked_at` (TIMESTAMPTZ, Nullable) — เวลาที่ถูกเพิกถอนสิทธิ์
* `last_active_at` (TIMESTAMPTZ) — เวลาที่มีการ Request Refresh Token ล่าสุด
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะของ Record (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ระบบผู้สร้างเซสชัน (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขสถานะล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 4. `tutor_profiles` (โปรไฟล์ครูผู้สอน)

* `id` (**VARCHAR(36)**, PK, Prefix: `tut_`) — รหัสโปรไฟล์ครู
* `user_id` (**VARCHAR(36)**, FK -> `users`, Unique) — รหัสผู้ใช้เจ้าของโปรไฟล์ (`usr_...`)
* `first_name` / `last_name` (VARCHAR(100)) — ชื่อ และนามสกุลจริง
* `gender` (ENUM: `MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY`) — เพศสภาพ
* `bio` (TEXT) — ประวัติและรายละเอียดการสอน
* `hourly_rate` (NUMERIC(10,2)) — ราคาเริ่มต้นต่อชั่วโมง (บาท)
* `teaching_location_type` (ENUM: `ONLINE`, `ONSITE`, `BOTH`) — รูปแบบการสอน
* `location` (GEOMETRY(Point, 4326)) — พิกัดอ้างอิง PostGIS (WGS 84)
* `service_radius_km` (NUMERIC(6,2)) — รัศมีการเดินทางรับสอน Onsite (กม.)
* `promptpay_identifier` (VARCHAR(50), Nullable) — รหัสพร้อมเพย์สำหรับรับเงิน
* `bank_code` (VARCHAR(20), Nullable) — รหัสธนาคาร (เช่น KBANK, SCB, BBL)
* `bank_account_number` (VARCHAR(50), Nullable) — เลขที่บัญชีธนาคารสำหรับรับโอน
* `bank_account_name` (VARCHAR(150), Nullable) — ชื่อบัญชีธนาคาร
* `intro_video_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงไฟล์วิดีโอแนะนำตัวต้นฉบับ (`fil_...`)
* `intro_video_thumbnail_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงรูปปกวิดีโอ (`fil_...`)
* `intro_video_hls_url` (TEXT, Nullable) — ลิงก์สตรีมมิ่ง Master Playlist (`.m3u8`) ผ่าน CloudFront CDN
* `intro_video_status` (VARCHAR(20)) — สถานะวิดีโอ (`PROCESSING`, `READY`, `APPROVED`, `FLAGGED`, `FAILED`)
* `verification_status` (ENUM: `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED`) — สถานะการตรวจสอบตัวตน
* `account_status` (ENUM: `ACTIVE`, `RESTRICTED`, `SUSPENDED`) — สถานะโปรไฟล์
* `account_status_reason` (TEXT, Nullable) — สาเหตุการจำกัดสิทธิ์/ระงับ
* `account_status_updated_at` (TIMESTAMPTZ, Nullable) — เวลาที่เปลี่ยนสถานะล่าสุด
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะโปรไฟล์ (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างโปรไฟล์ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 5. `student_profiles` (โปรไฟล์นักเรียนและข้อมูลผู้ปกครอง/เบอร์ฉุกเฉิน)

* `id` (**VARCHAR(36)**, PK, Prefix: `std_`) — รหัสโปรไฟล์นักเรียน
* `user_id` (**VARCHAR(36)**, FK -> `users`, Unique) — รหัสผู้ใช้เจ้าของโปรไฟล์ (`usr_...`)
* `first_name` / `last_name` (VARCHAR(100)) — ชื่อและนามสกุลจริงของนักเรียน
* `current_grade_level` (VARCHAR(50)) — ระดับชั้นปัจจุบัน
* `school_name` (VARCHAR(150)) — สถานศึกษา
* `location` (GEOMETRY(Point, 4326)) — พิกัดที่พักอาศัย (WGS 84)
* `parent_name` (VARCHAR(150), Nullable) — ชื่อ-นามสกุลของผู้ปกครอง
* `parent_phone_number` (VARCHAR(30), Nullable) — เบอร์โทรศัพท์ติดต่อผู้ปกครอง
* `parent_relationship` (VARCHAR(50), Nullable) — ความสัมพันธ์กับนักเรียน (เช่น บิดา, มารดา, ผู้ปกครอง)
* `emergency_contact_name` (VARCHAR(150), Nullable) — ชื่อผู้ติดต่อฉุกเฉิน (กรณีติดต่อผู้ปกครองหลักไม่ได้)
* `emergency_contact_phone` (VARCHAR(30), Nullable) — เบอร์โทรศัพท์ติดต่อกรณีฉุกเฉิน
* `emergency_contact_relationship` (VARCHAR(50), Nullable) — ความสัมพันธ์ของผู้ติดต่อฉุกเฉิน
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการใช้งาน (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างโปรไฟล์ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 6. `subjects` (วิชาที่เปิดสอน)

* `id` (**VARCHAR(36)**, PK, Prefix: `sbj_`) — รหัสวิชา
* `name_th` / `name_en` (VARCHAR(100)) — ชื่อวิชาไทย-อังกฤษ
* `category` (VARCHAR(50)) — หมวดหมู่วิชา
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะเปิดให้เลือกวิชานี้ (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — แอดมินผู้เพิ่มวิชา (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — แอดมินผู้แก้ไขวิชาล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 7. `tutor_subjects` (วิชาและระดับชั้นที่ครูรับสอน)

* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`, PK) — รหัสครูผู้สอน (`tut_...`)
* `subject_id` (**VARCHAR(36)**, FK -> `subjects`, PK) — รหัสวิชา (`sbj_...`)
* `grade_levels` (VARCHAR(50)[]) — ระดับชั้นที่รับสอน
* `specialized_topics` (TEXT[], Default: `'{}'::text[]`) — หัวข้อย่อย/บทเรียนเฉพาะทางที่ถนัด (เช่น `['เซต', 'แคลคูลัส', 'ตรีโกณมิติ']`)
* `custom_rate` (NUMERIC(10,2), Nullable) — ค่าสอนเฉพาะวิชา (ถ้ามี)
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะเปิดรับสอนวิชานี้ (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้บันทึก (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 8. `tutor_education` (ประวัติการศึกษาและการรับรอง)

* `id` (**VARCHAR(36)**, PK, Prefix: `edu_`) — รหัสประวัติการศึกษา
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสครู (`tut_...`)
* `institution` / `degree` / `major` (VARCHAR(150)) — สถาบัน, ปริญญา, สาขาวิชา
* `graduation_year` (SMALLINT) — ปีที่จบการศึกษา
* `verification_document_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงไฟล์วุฒิบน S3 (`fil_...`)
* `is_verified` (BOOLEAN, Default: `FALSE`) — สถานะการตรวจสอบวุฒิโดย Admin
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการแสดงผล (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้เพิ่มข้อมูล (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้ตรวจ/แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 9. `tutor_availability` (ช่วงเวลาว่างของครู)

* `id` (**VARCHAR(36)**, PK, Prefix: `tav_`) — รหัสรายการตารางเวลา
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสครู (`tut_...`)
* `is_recurring` (BOOLEAN) — ว่างประจำรายสัปดาห์ (`TRUE`) หรือระบุวันเฉพาะ (`FALSE`)
* `day_of_week` (SMALLINT, Nullable) — วันในสัปดาห์ (0 = อาทิตย์ ถึง 6 = เสาร์)
* `specific_date` (DATE, Nullable) — วันที่เจาะจง
* `start_time` / `end_time` (TIME) — เวลาเริ่มและสิ้นสุด
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะเปิดใช้งานช่วงเวลานี้ (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้าง (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 10. `profile_change_requests` (คำขอแก้ไขข้อมูลโปรไฟล์อ่อนไหว)

* `id` (**VARCHAR(36)**, PK, Prefix: `pcr_`) — รหัสคำขอแก้ไข
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสโปรไฟล์ครู (`tut_...`)
* `user_id` (**VARCHAR(36)**, FK -> `users`) — รหัสผู้ใช้ผู้ยื่นคำขอ (`usr_...`)
* `request_type` (ENUM: `LEGAL_NAME`, `EDUCATION`, `IDENTIFICATION`, `OTHER`) — ประเภทข้อมูลที่ขอแก้ไข
* `current_data` (JSONB) — Snapshot ข้อมูลเดิมก่อนแก้ไข
* `requested_changes` (JSONB) — ข้อมูลใหม่ที่ขอเปลี่ยน
* `supporting_document_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงเอกสารหลักฐานบน S3 (`fil_...`)
* `status` (ENUM: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, Default: `PENDING`) — สถานะการตรวจสอบ
* `rejection_reason` (TEXT, Nullable) — เหตุผลกรณีไม่อนุมัติ
* `reviewed_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — แอดมินผู้ตรวจคำขอ (`usr_...`)
* `reviewed_at` (TIMESTAMPTZ, Nullable) — เวลาที่ตรวจสอบเสร็จ
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะของคำขอ (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างคำขอ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้ปรับสถานะล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

---

## Domain 2: Storage & Media (ระบบจัดการไฟล์ S3)

### 11. `storage_files` (จัดเก็บ Metadata ไฟล์บน AWS S3)

* `id` (**VARCHAR(36)**, PK, Prefix: `fil_`) — รหัสอ้างอิงไฟล์
* `bucket_name` (VARCHAR(100)) — ชื่อ S3 Bucket ที่ใช้จัดเก็บ
* `file_key` (TEXT, Unique) — Path/Key ของไฟล์บน S3
* `file_name` (VARCHAR(255)) — ชื่อไฟล์เดิมตอนอัปโหลด
* `mime_type` (VARCHAR(100)) — ประเภทไฟล์ (เช่น `image/jpeg`, `video/mp4`, `application/pdf`)
* `file_size_bytes` (BIGINT) — ขนาดไฟล์จริง (หน่วย Bytes)
* `file_category` (ENUM: `AVATAR`, `INTRO_VIDEO`, `VIDEO_THUMBNAIL`, `VERIFICATION_DOC`, `CHANGE_REQUEST_DOC`, `PAYMENT_SLIP`, `SIGNED_CONTRACT_PDF`, `CHAT_MEDIA`, `QUESTION_IMAGE`, `ANSWER_IMAGE`, `OTHER`) — หมวดหมู่ไฟล์
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะไฟล์ (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้อัปโหลด (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

---

## Domain 3: Two-Way Marketplace (ระบบโพสต์หางาน/หาครู)

### 12. `student_jobs` (ประกาศหาครู)

* `id` (**VARCHAR(36)**, PK, Prefix: `job_`) — รหัสประกาศงาน
* `student_id` (**VARCHAR(36)**, FK -> `student_profiles`) — รหัสนักเรียนผู้โพสต์ (`std_...`)
* `subject_id` (**VARCHAR(36)**, FK -> `subjects`) — รหัสวิชา (`sbj_...`)
* `target_grade_level` (VARCHAR(50)) — ระดับชั้นผู้เรียน
* `target_topics` (TEXT[], Default: `'{}'::text[]`) — หัวข้อย่อย/บทเรียนที่ต้องการเน้น (เช่น `['เซต', 'ตรรกศาสตร์']`)
* `learning_goal` (TEXT) — เป้าหมายการเรียน
* `budget_min` / `budget_max` (NUMERIC(10,2)) — งบประมาณต่อชั่วโมง
* `location_type` (ENUM: `ONLINE`, `ONSITE`, `BOTH`) — รูปแบบการเรียน
* `location` (GEOMETRY(Point, 4326), Nullable) — พิกัดนัดสอนกรณี Onsite (WGS 84)
* `frequency_per_week` (SMALLINT) — จำนวนครั้งต่อสัปดาห์
* `preferred_days` (SMALLINT[]) — วันที่สะดวกเรียน
* `status` (ENUM: `OPEN`, `MATCHED`, `CLOSED`, `CANCELLED`) — สถานะของงาน
* `share_count` (INTEGER, Default: 0) — ใช้นับว่ามีคนกดปุ่มแชร์ประกาศงานนี้ไปกี่ครั้ง
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการแสดงผล (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างประกาศ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 13. `job_applications` (ข้อเสนอการสอนจากครู)

* `id` (**VARCHAR(36)**, PK, Prefix: `app_`) — รหัสใบสมัคร
* `job_id` (**VARCHAR(36)**, FK -> `student_jobs`) — รหัสประกาศงาน (`job_...`)
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสครูผู้ยื่นสมัคร (`tut_...`)
* `proposed_rate` (NUMERIC(10,2)) — ราคาต่อชั่วโมงที่เสนอ
* `cover_message` (TEXT) — ข้อความแนะนำการสอน
* `status` (ENUM: `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`) — สถานะใบสมัคร
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะใบสมัคร (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้ส่งใบสมัคร (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้ปรับสถานะล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

---

## Domain 4: Bookings & Sessions (การจอง บันทึกคลาสเรียน และสัญญาเรียนที่เซ็นแล้ว)

### 14. `bookings` (สัญญาการจองคอร์สเรียนและไฟล์สัญญาแนบ)

* `id` (**VARCHAR(36)**, PK, Prefix: `bkg_`) — รหัสการจอง
* `student_id` (**VARCHAR(36)**, FK -> `student_profiles`) — รหัสนักเรียน (`std_...`)
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสครู (`tut_...`)
* `subject_id` (**VARCHAR(36)**, FK -> `subjects`) — รหัสวิชา (`sbj_...`)
* `originating_job_id` (**VARCHAR(36)**, FK -> `student_jobs`, Nullable) — รหัสงานต้นทาง (`job_...`)
* `agreed_hourly_rate` (NUMERIC(10,2)) — อัตราค่าเรียนตามที่ตกลง
* `location_type` (ENUM: `ONLINE`, `ONSITE`) — รูปแบบที่ตกลงจริง (ห้ามเป็น BOTH)
* `meeting_location` (TEXT, Nullable) — รายละเอียดสถานที่กรณี Onsite
* `meeting_url` (TEXT, Nullable) — ลิงก์ห้องเรียนกรณี Online
* `signed_contract_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงไฟล์ PDF สัญญาที่เซ็นชื่อเรียบร้อยแล้ว (`fil_...`)
* `contract_uploaded_at` (TIMESTAMPTZ, Nullable) — เวลาที่อัปโหลดไฟล์สัญญาที่เซ็นแล้ว
* `status` (ENUM: `PENDING_CONFIRMATION`, `ACTIVE`, `REJECTED`, `COMPLETED`, `CANCELLED`) — สถานะการจอง
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการใช้งาน (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างรายการจอง (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 15. `class_sessions` (รอบการสอนและรายงานผลถึงผู้ปกครอง)

* `id` (**VARCHAR(36)**, PK, Prefix: `ses_`) — รหัสรอบการสอน
* `booking_id` (**VARCHAR(36)**, FK -> `bookings`) — รหัสการจองหลัก (`bkg_...`)
* `student_id` (**VARCHAR(36)**, FK -> `student_profiles`) — รหัสนักเรียน (`std_...`)
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสครู (`tut_...`)
* `scheduled_start` / `scheduled_end` (TIMESTAMPTZ) — เวลาเริ่ม-สิ้นสุดตามนัด
* `actual_start` / `actual_end` (TIMESTAMPTZ, Nullable) — เวลาเข้าสอนและสิ้นสุดจริง
* `hourly_rate` (NUMERIC(10,2)) — อัตราค่าสอนต่อชั่วโมงในรอบนี้
* `duration_minutes` (SMALLINT, Default: 60) — ระยะเวลาการสอนจริงที่คิดเงิน (นาที)
* `gross_amount` (NUMERIC(10,2)) — ยอดรวมค่าสอนรอบนี้ (Snapshot ทางการเงิน)
* `session_feedback` (TEXT, Nullable) — สรุปเนื้อหา พัฒนาการ และฟีดแบ็กจากครูถึงนักเรียน/ผู้ปกครอง
* `homework_assigned` (TEXT, Nullable) — การบ้านหรืองานที่มอบหมายเพิ่มเติม
* `status` (ENUM: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED_BY_STUDENT`, `CANCELLED_BY_TUTOR`, `NO_SHOW`) — สถานะการสอน
* `payment_status` (ENUM: `PENDING_PAYMENT`, `STUDENT_PAID`, `TUTOR_CONFIRMED`, `DISPUTED`) — สถานะการจ่ายเงิน
* `dispute_reason` (TEXT, Nullable) — รายละเอียดข้อพิพาท (ถ้ามี)
* `student_confirmed_at` / `tutor_confirmed_at` (TIMESTAMPTZ, Nullable) — เวลายืนยันจากทั้ง 2 ฝ่าย
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการใช้งาน (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างนัด (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

---

## Domain 5: Financial & Invoicing (การเงินและใบแจ้งหนี้แบบตารางเดียว)

### 16. `invoices` (ใบแจ้งหนี้และบันทึกการชำระเงินค่าเรียน/ค่าคอมมิชชัน)

* `id` (**VARCHAR(36)**, PK, Prefix: `inv_`) — รหัสใบแจ้งหนี้
* `invoice_number` (VARCHAR(50), Unique) — เลขที่เอกสาร (เช่น `INV-2026-0001`)
* `invoice_type` (ENUM: `STUDENT_TUITION`, `TUTOR_COMMISSION`) — ประเภทใบแจ้งหนี้ (นักเรียนจ่ายค่าเรียน หรือ ติวเตอร์จ่ายคอมมิชชัน)
* `booking_id` (**VARCHAR(36)**, FK -> `bookings`, Nullable) — การจองที่เกี่ยวข้อง (`bkg_...`)
* `class_session_id` (**VARCHAR(36)**, FK -> `class_sessions`, Nullable) — รอบการสอนที่เรียกเก็บ (`ses_...`)
* `payer_user_id` (**VARCHAR(36)**, FK -> `users`) — ผู้มีหน้าที่ชำระเงิน (`usr_...`)
* `payee_user_id` (**VARCHAR(36)**, FK -> `users`) — ผู้รับเงิน (`usr_...`)
* `amount` (NUMERIC(10,2)) — ยอดรวมเงินที่ต้องชำระ
* `commission_fee` (NUMERIC(10,2), Default: 0) — ส่วนแบ่งค่าบริการระบบ (Snapshot)
* `status` (ENUM: `UNPAID`, `PENDING_VERIFICATION`, `PAID`, `CANCELLED`, Default: `UNPAID`) — สถานะการชำระเงิน
* `payment_method` (ENUM: `BANK_TRANSFER`, `PROMPTPAY`, `CREDIT_CARD`, `CASH`, `OTHER`, Nullable) — ช่องทางชำระเงิน
* `slip_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงสลิปโอนเงินบน S3 (`fil_...`)
* `due_date` (DATE, Nullable) — กำหนดวันชำระเงิน
* `paid_at` (TIMESTAMPTZ, Nullable) — วันเวลาที่ชำระเงินเสร็จสิ้น
* `verified_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — แอดมิน/ผู้ตรวจสอบสลิป (`usr_...`)
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะเอกสาร (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างใบแจ้งหนี้ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

---

## Domain 6: Messaging (ระบบแชทตรง)

### 17. `conversations` (ห้องสนทนา)

* `id` (**VARCHAR(36)**, PK, Prefix: `cnv_`) — รหัสห้องสนทนา
* `booking_id` (**VARCHAR(36)**, FK -> `bookings`, Nullable) — รหัสการจองที่เชื่อมโยง (`bkg_...`)
* `student_id` (**VARCHAR(36)**, FK -> `student_profiles`) — รหัสนักเรียน (`std_...`)
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสครู (`tut_...`)
* `last_message_at` (TIMESTAMPTZ, Nullable) — เวลาข้อความล่าสุดสำหรับ Sorting
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะห้องแชท (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้เปิดห้องสนทนา (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 18. `messages` (ข้อความแชท สื่อแนบ และอิโมจิ)

* `id` (**VARCHAR(36)**, PK, Prefix: `msg_`) — รหัสข้อความ
* `conversation_id` (**VARCHAR(36)**, FK -> `conversations`) — รหัสห้องสนทนา (`cnv_...`)
* `sender_id` (**VARCHAR(36)**, FK -> `users`) — รหัสผู้ส่ง (`usr_...`)
* `content` (TEXT, Nullable) — ข้อความตัวอักษร, โค้ดอิโมจิ (เช่น `emoji_fire`, `🎉`), หรือคำบรรยายประกอบไฟล์
* `message_type` (ENUM: `TEXT`, `EMOJI`, `IMAGE`, `VIDEO`, `FILE`, Default: `TEXT`) — ประเภทของข้อความ (แยก `EMOJI` ออกมาเพื่อเรนเดอร์ขนาดใหญ่พิเศษใน UI)
* `file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงไฟล์แนบหลักบน S3 (รูปภาพ/วิดีโอ/เอกสาร) (`fil_...`)
* `thumbnail_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงรูปพรีวิว/ภาพย่อ (`fil_...`)
* `is_read` (BOOLEAN, Default: `FALSE`) — สถานะเปิดอ่าน
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการแสดงผล (Soft-delete/Unsend)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้ส่งข้อความ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขข้อความ (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

---

## Domain 7: Reviews & Reputation (คะแนนและรีวิว)

### 19. `reviews` (คะแนนและคำติชม)

* `id` (**VARCHAR(36)**, PK, Prefix: `rev_`) — รหัสรีวิว
* `class_session_id` (**VARCHAR(36)**, FK -> `class_sessions`) — รหัสคลาสเรียนที่ถูกรีวิว (`ses_...`)
* `reviewer_user_id` (**VARCHAR(36)**, FK -> `users`) — รหัสผู้เขียนรีวิว (`usr_...`)
* `reviewee_user_id` (**VARCHAR(36)**, FK -> `users`) — รหัสผู้ถูกรีวิว (`usr_...`)
* `review_type` (**VARCHAR(20)**, Check: `STUDENT_TO_TUTOR`, `TUTOR_TO_STUDENT`) — ทิศทางการรีวิว
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`, Nullable) — รหัสโปรไฟล์ครู (`tut_...`) สำหรับคัดกรองคะแนนฝั่งครู
* `rating_score` (**SMALLINT**, Check: 1-5) — คะแนนประเมิน
* `comment` (**TEXT**, Nullable) — ข้อความรีวิว
* `is_published` (**BOOLEAN**, Default: `TRUE`) — อนุญาตให้แสดงผลต่อสาธารณะ
* `is_active` (**BOOLEAN**, Default: `TRUE`) — สถานะการแสดงผล (Soft-delete)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างข้อมูล (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขข้อมูล (`usr_...`)
* `created_at` / `updated_at` (**TIMESTAMPTZ**) — เวลาสร้างและแก้ไข

---

## Domain 8: Notifications, Audit & Activity Logs (การแจ้งเตือนและการบันทึกประวัติ)

### 20. `notifications` (การแจ้งเตือนผู้ใช้และระบบแบ่งระดับความสำคัญ)

* `id` (**VARCHAR(36)**, PK, Prefix: `ntf_`) — รหัสแจ้งเตือน
* `user_id` (**VARCHAR(36)**, FK -> `users`) — รหัสผู้รับการแจ้งเตือน (`usr_...`)
* `title` (VARCHAR(150)) — หัวข้อเรื่อง
* `body` (TEXT) — รายละเอียดเนื้อหา
* `type` (VARCHAR(50)) — หมวดหมู่การแจ้งเตือน
* `priority_tier` (ENUM: `LOW`, `NORMAL`, `HIGH`, `URGENT`, Default: `NORMAL`) — ระดับความสำคัญ (ใช้คุมการส่งต่อ เช่น Push Notification ทันที หรือหน่วงเวลาได้)
* `reference_type` (VARCHAR(50), Nullable) — ตารางอ้างอิง เช่น `BOOKING`, `CLASS_SESSION`, `JOB_APPLICATION`, `INVOICE`, `STUDENT_QUESTION`
* `reference_id` (**VARCHAR(36)**, Nullable) — รหัสอ็อบเจกต์ที่เกี่ยวข้อง (ตาม Prefix ตารางนั้นๆ)
* `is_read` (BOOLEAN, Default: `FALSE`) — สถานะอ่านแล้ว
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะเปิดแสดงในหน้ารวม (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างแจ้งเตือน (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขสถานะ (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 21. `user_activity_logs` (บันทึกกิจกรรมและการใช้งานระดับ Application)

* `id` (**VARCHAR(36)**, PK, Prefix: `ual_`) — รหัส Log กิจกรรม
* `user_id` (**VARCHAR(36)**, FK -> `users`, Nullable) — รหัสผู้ใช้ (`usr_...`)
* `browser_session_id` (VARCHAR(100)) — Session ID ของเว็บเบราว์เซอร์
* `event_name` (VARCHAR(100)) — ชื่อกิจกรรม
* `page_path` (VARCHAR(255)) — URL Path
* `element_id` (VARCHAR(100), Nullable) — คอมโพเนนต์ที่กด
* `metadata` (JSONB, Nullable) — Context เสริม
* `ip_address` (INET, Nullable) — หมายเลข IP Address
* `user_agent` (TEXT, Nullable) — ข้อมูลเบราว์เซอร์
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะ Log (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้บันทึก (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขสถานะ (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 22. `entity_audit_logs` (บันทึกประวัติการแก้ไขข้อมูลระดับ Database / CDC)

* `id` (**VARCHAR(36)**, PK, Prefix: `eal_`) — รหัส Audit Log
* `table_name` (VARCHAR(64)) — ชื่อตารางที่เกิดการแก้ไข
* `record_id` (**VARCHAR(36)**) — PK ของแถวข้อมูลที่ถูกแก้ไข (รองรับ ID ทุกตาราง)
* `action` (ENUM: `INSERT`, `UPDATE`, `DELETE`) — ประเภทคำสั่งที่เกิดขึ้นในฐานข้อมูล
* `old_data` (JSONB, Nullable) — Snapshot ค่าข้อมูลก่อนการเปลี่ยนแปลง
* `new_data` (JSONB, Nullable) — Snapshot ค่าข้อมูลหลังการเปลี่ยนแปลง
* `changed_fields` (JSONB, Nullable) — Array ชื่อคอลัมน์ที่มีค่าเปลี่ยนแปลงจริง
* `changed_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้กระทำการแก้ไข (`usr_...`)
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะ Log (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — บันทึกโดยระบบ
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขสถานะ Log
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาที่เกิด Transaction ใน Database

---

## Domain 9: Question & Answer Forum (ระบบถาม-ตอบโจทย์และการบ้าน)

### 23. `student_questions` (กระทู้ถามโจทย์/การบ้าน)

* `id` (**VARCHAR(36)**, PK, Prefix: `qst_`) — รหัสคำถาม
* `student_id` (**VARCHAR(36)**, FK -> `student_profiles`) — รหัสนักเรียนผู้โพสต์ (`std_...`)
* `subject_id` (**VARCHAR(36)**, FK -> `subjects`) — รหัสวิชา (`sbj_...`)
* `target_topics` (TEXT[], Default: `'{}'::text[]`) — แท็กหัวข้อย่อยของโจทย์
* `title` (VARCHAR(200)) — หัวข้อคำถาม/โจทย์สั้นๆ
* `content` (TEXT) — รายละเอียดโจทย์ หรือคำอธิบายจุดที่สงสัย
* `question_image_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงรูปภาพโจทย์บน S3 (`fil_...`)
* `status` (ENUM: `OPEN`, `RESOLVED`, `CLOSED`, Default: `OPEN`) — สถานะคำถาม
* `view_count` (INTEGER, Default: 0) — จำนวนครั้งที่เปิดดู
* `answers_count` (INTEGER, Default: 0) — จำนวนคำตอบที่ส่งเข้ามา
* `share_count` (INTEGER, Default: 0) — ใช้นับว่ามีคนกดปุ่มแชร์ประกาศงานนี้ไปกี่ครั้ง
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการแสดงผล (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้สร้างคำถาม (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข

### 24. `question_answers` (คำตอบและเฉลยวิธีทำจากติวเตอร์)

* `id` (**VARCHAR(36)**, PK, Prefix: `ans_`) — รหัสคำตอบ
* `question_id` (**VARCHAR(36)**, FK -> `student_questions`) — รหัสคำถามที่ตอบ (`qst_...`)
* `tutor_id` (**VARCHAR(36)**, FK -> `tutor_profiles`) — รหัสติวเตอร์ผู้ตอบ (`tut_...`)
* `content` (TEXT) — เนื้อหาคำอธิบาย วิธีคิด และแนวทางเฉลย
* `solution_file_id` (**VARCHAR(36)**, FK -> `storage_files`, Nullable) — อ้างอิงรูปภาพหรือเอกสารแสดงวิธีทำลายมือบน S3 (`fil_...`)
* `is_accepted` (BOOLEAN, Default: `FALSE`) — ปักหมุดเลือกเป็นคำตอบที่ถูกต้องที่สุดโดยนักเรียน
* `accepted_at` (TIMESTAMPTZ, Nullable) — เวลาที่คำตอบถูกเลือก
* `upvote_count` (INTEGER, Default: 0) — ยอดถูกใจ/มีประโยชน์
* `is_active` (BOOLEAN, Default: `TRUE`) — สถานะการแสดงผล (Soft-delete only)
* `created_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้ส่งคำตอบ (`usr_...`)
* `updated_by` (**VARCHAR(36)**, FK -> `users`, Nullable) — ผู้แก้ไขล่าสุด (`usr_...`)
* `created_at` / `updated_at` (TIMESTAMPTZ) — เวลาสร้างและแก้ไข
