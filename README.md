# BackEnd


คู่มือติดตั้งและตั้งค่า Backend ของแพลตฟอร์มหาครูสอนพิเศษ ตั้งแต่เครื่อง Developer ไปจนถึง Production**สมมติฐานที่ผมตั้งเอง** (ปรับได้): Python 3.12, SQLAlchemy 2.x + Alembic, Redis ใช้ทั้ง Cache / Rate limit / Pub-Sub, Background worker ใช้ ARQ, S3 + CloudFront สำหรับไฟล์ และ AWS MediaConvert สำหรับแปลงวิดีโอเป็น HLS ข้อที่ยืนยันจากเอกสารเดิม: FastAPI, PostgreSQL + PostGIS, Redis, AWS S3, CloudFront CDN, ID แบบ Prefix ขนาด `VARCHAR(36)`

---

## 5.1 สถาปัตยกรรมโดยรวม

```mermaid
flowchart LR
    C[Web / Mobile] -->|HTTPS| API[FastAPI]
    C -->|WebSocket| API
    API --> PG[(PostgreSQL + PostGIS)]
    API --> R[(Redis)]
    API -->|presigned URL| S3[(S3)]
    C -->|upload ตรง| S3
    S3 --> MC[MediaConvert]
    MC -->|HLS| S3
    S3 --> CF[CloudFront]
    C -->|สตรีมวิดีโอ| CF
    R --> W[Worker ARQ]
    W --> PG
    W --> EXT[Push / Email / SMS]
```

| ส่วน                       | หน้าที่                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **FastAPI**              | REST API + WebSocket (แชต)                                                                                                  |
| **PostgreSQL + PostGIS** | ข้อมูลหลัก, ค้นหาตามพิกัด (`GEOMETRY(Point, 4326)`)                                                   |
| **Redis**                | Rate limit, Cache คะแนนครู, นับ`view_count`, Pub/Sub สำหรับแชต, คิวงาน                             |
| **S3**                   | เก็บไฟล์ทั้งหมด (`storage_files`) แบบ private                                                              |
| **Worker**               | ส่งแจ้งเตือน, งานตั้งเวลา (หมดอายุ Booking, auto-confirm, no-show), ประมวลผลวิดีโอ |

---

## 5.2 สิ่งที่ต้องติดตั้งบนเครื่อง (Prerequisites)

| เครื่องมือ    | เวอร์ชันแนะนำ | ใช้ทำอะไร                                     |
| ----------------------- | -------------------------- | ------------------------------------------------------ |
| Python                  | 3.12+                      | รัน FastAPI                                         |
| uv หรือ Poetry      | ล่าสุด               | จัดการ dependency (ตัวอย่างใช้`uv`) |
| Docker + Docker Compose | ล่าสุด               | รัน Postgres, Redis, MinIO ในเครื่อง       |
| Git                     | ล่าสุด               | —                                                     |
| AWS CLI                 | v2                         | ตั้งค่า S3/CloudFront (staging/prod)            |

---

## 5.3 โครงสร้างโปรเจกต์ (แนะนำ)

```
backend/
├── app/
│   ├── main.py                 # สร้าง FastAPI app, รวม router
│   ├── core/
│   │   ├── config.py           # โหลดค่า env (pydantic-settings)
│   │   ├── security.py         # JWT, password hash
│   │   ├── database.py         # engine / session
│   │   ├── redis.py
│   │   └── ids.py              # สร้าง ID แบบ Prefix (usr_, tut_, ...)
│   ├── models/                 # SQLAlchemy models แยกตาม Domain 1-9
│   ├── schemas/                # Pydantic request/response
│   ├── routers/                # auth, users, tutors, students, jobs, bookings, ...
│   ├── services/               # Business logic (State Machine, คำนวณเงิน)
│   ├── workers/                # งาน ARQ
│   └── integrations/           # S3, OAuth, SMS, Email, Push
├── migrations/                 # Alembic
├── scripts/                    # seed, create_admin
├── tests/
├── docker-compose.yml
├── .env.example
├── pyproject.toml
└── README.md
```

---

## 5.4 ตัวแปรสภาพแวดล้อม (Environment Variables)

คัดลอก `.env.example` เป็น `.env` แล้วกรอกค่า **ห้าม commit `.env` เข้า Git**

### 5.4.1 ทั่วไป

| ตัวแปร             | ตัวอย่าง                             | คำอธิบาย                                                  |
| ------------------------ | -------------------------------------------- | ----------------------------------------------------------------- |
| `APP_ENV`              | `local` / `staging` / `production` | สภาพแวดล้อม                                            |
| `APP_DEBUG`            | `true`                                     | เปิด debug (ต้องเป็น`false` บน production)       |
| `APP_BASE_URL`         | `http://localhost:8000`                    | URL ของ API                                                    |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000`                    | คั่นด้วยจุลภาค ห้ามใช้`*` บน production |
| `DEFAULT_TIMEZONE`     | `Asia/Bangkok`                             | เขตเวลาที่ใช้แสดงผล                            |

### 5.4.2 ฐานข้อมูลและ Redis

| ตัวแปร           | ตัวอย่าง                                                 |
| ---------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`       | `postgresql+asyncpg://tutor:tutor@localhost:5432/forall_tutor` |
| `DATABASE_POOL_SIZE` | `10`                                                           |
| `REDIS_URL`          | `redis://localhost:6379/0`                                     |

### 5.4.3 Auth

| ตัวแปร                                      | ตัวอย่าง          | คำอธิบาย                               |
| ------------------------------------------------- | ------------------------- | ---------------------------------------------- |
| `JWT_SECRET_KEY`                                | (สุ่ม ≥ 32 ไบต์) | สร้างด้วย`openssl rand -hex 32`     |
| `JWT_ALGORITHM`                                 | `HS256`                 | —                                             |
| `ACCESS_TOKEN_EXPIRE_MINUTES`                   | `15`                    | อายุ Access Token                          |
| `REFRESH_TOKEN_EXPIRE_DAYS`                     | `30`                    | ตรงกับ`user_sessions.expires_at`       |
| `OTP_EXPIRE_SECONDS`                            | `300`                   | อายุ OTP ยืนยันเบอร์/อีเมล |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | —                        | OAuth Google                                   |

Refresh Token เก็บเป็น SHA-256 hash ใน `user_sessions.refresh_token_hash` เท่านั้น ห้ามเก็บค่าจริง

### 5.4.4 ไฟล์และวิดีโอ (AWS)

| ตัวแปร                                                  | ตัวอย่าง          | คำอธิบาย                                     |
| ------------------------------------------------------------- | ------------------------- | ---------------------------------------------------- |
| `AWS_REGION`                                                | `ap-southeast-1`        | —                                                   |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`           | —                        | ใช้เฉพาะ local (บน server ใช้ IAM Role) |
| `S3_BUCKET_NAME`                                            | `forall-tutor-dev`      | ตรงกับ`storage_files.bucket_name`            |
| `S3_ENDPOINT_URL`                                           | `http://localhost:9000` | ตั้งเฉพาะตอนใช้ MinIO                 |
| `S3_PRESIGNED_UPLOAD_EXPIRES`                               | `600`                   | อายุ URL อัปโหลด (วินาที)           |
| `S3_PRESIGNED_DOWNLOAD_EXPIRES`                             | `300`                   | อายุ URL ดาวน์โหลด                      |
| `CLOUDFRONT_DOMAIN`                                         | `dxxxx.cloudfront.net`  | โดเมนสำหรับ`intro_video_hls_url`        |
| `MEDIACONVERT_ROLE_ARN` / `MEDIACONVERT_QUEUE_ARN`      | —                        | งานแปลงวิดีโอ                           |
| `MAX_UPLOAD_SIZE_MB_IMAGE` / `MAX_UPLOAD_SIZE_MB_VIDEO` | `10` / `200`        | ขีดจำกัดตามประเภทไฟล์           |

### 5.4.5 แจ้งเตือน

| ตัวแปร                                                 | คำอธิบาย                                    |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` / `EMAIL_FROM`  | ส่งอีเมล (เช่น SES, SendGrid)           |
| `SMS_PROVIDER` / `SMS_API_KEY` / `SMS_SENDER_NAME` | ส่ง SMS (ใช้เฉพาะ`URGENT` และ OTP) |
| `PUSH_PROVIDER_CREDENTIALS`                                | FCM / APNs                                          |

### 5.4.6 ธุรกิจ

| ตัวแปร                     | ตัวอย่าง | คำอธิบาย                                                                                     |
| -------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `COMMISSION_RATE`              | `0.15`         | **ค่าสมมติ** ต้องยืนยันกับฝั่งธุรกิจ (ดูหัวข้อ 3.9 D1) |
| `PLATFORM_SYSTEM_USER_ID`      | `usr_system`   | บัญชีผู้รับค่าคอมมิชชัน (`invoices.payee_user_id`)                          |
| `BOOKING_PENDING_EXPIRE_HOURS` | `48`           | อายุ`PENDING_CONFIRMATION`                                                                     |
| `SESSION_AUTO_CONFIRM_HOURS`   | `48`           | ยืนยันอัตโนมัติฝั่งนักเรียน                                               |
| `NO_SHOW_GRACE_MINUTES`        | `15`           | —                                                                                                   |

---

## 5.5 ติดตั้งบนเครื่อง Developer (Local Setup)

### ขั้นที่ 1: ดึงโค้ดและติดตั้ง dependency

```bash
git clone <repo-url> backend
cd backend
uv sync                      # ติดตั้ง dependency ตาม pyproject.toml
cp .env.example .env         # แล้วแก้ค่าใน .env
```

### ขั้นที่ 2: เปิด Postgres, Redis, MinIO ด้วย Docker

`docker-compose.yml` (สำหรับ local เท่านั้น):

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: tutor
      POSTGRES_PASSWORD: tutor
      POSTGRES_DB: forall_tutor
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tutor -d forall_tutor"]
      interval: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

volumes:
  pgdata:
  miniodata:
```

```bash
docker compose up -d
```

สร้าง bucket ใน MinIO ผ่าน Console ที่ `http://localhost:9001` (ชื่อให้ตรงกับ `S3_BUCKET_NAME`) และตั้ง `S3_ENDPOINT_URL=http://localhost:9000`

### ขั้นที่ 3: เปิด Extension ที่จำเป็นในฐานข้อมูล

Migration แรกต้องรันคำสั่งเหล่านี้ก่อนสร้างตาราง:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;      -- GEOMETRY(Point, 4326)
CREATE EXTENSION IF NOT EXISTS btree_gist;   -- กัน session ซ้อนเวลา (หัวข้อ 3.5)
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- (เสริม) ค้นหาชื่อ/หัวข้อแบบ fuzzy
```

### ขั้นที่ 4: รัน Migration

```bash
uv run alembic upgrade head
```

ตรวจว่าครบ 24 ตาราง:

```bash
docker compose exec db psql -U tutor -d forall_tutor -c "\dt"
```

### ขั้นที่ 5: Seed ข้อมูลเริ่มต้น

```bash
uv run python scripts/seed.py
uv run python scripts/create_admin.py --email admin@example.com
```

| ข้อมูล                               | ที่ตาราง                        | หมายเหตุ                                                                            |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| รายการวิชา                       | `subjects`                            | อย่างน้อยหมวดหลัก (คณิต, วิทย์, อังกฤษ ฯลฯ)              |
| บัญชีระบบของแพลตฟอร์ม | `users` (`usr_system`)             | ใช้เป็น`payee_user_id` ของ `TUTOR_COMMISSION` ห้ามล็อกอินได้ |
| บัญชี Admin แรก                    | `users` (`roles` มี `ADMIN`) | สร้างผ่านสคริปต์เท่านั้น ไม่เปิดให้สมัครเอง       |

### ขั้นที่ 6: รันระบบ

```bash
# Terminal 1: API
uv run uvicorn app.main:app --reload --port 8000

# Terminal 2: Worker
uv run arq app.workers.settings.WorkerSettings
```

ตรวจว่าใช้งานได้:

| URL                              | ผลที่ควรเห็น                                 |
| -------------------------------- | -------------------------------------------------------- |
| `http://localhost:8000/health` | `{"status": "ok"}` และตรวจ DB + Redis ผ่าน |
| `http://localhost:8000/docs`   | Swagger UI (เปิดเฉพาะ`local`/`staging`)     |

---

## 5.6 การตั้งค่า AWS (Staging / Production)

### 5.6.1 S3 Bucket

- **Block Public Access = เปิดทั้งหมด** (bucket เป็น private)
- เปิด **Server-side encryption** (SSE-S3 หรือ SSE-KMS)
- แยก bucket หรือ prefix ตาม `file_category` ได้ เช่น `avatars/`, `intro-videos/`, `verification-docs/`, `payment-slips/`, `contracts/`, `chat/`, `qa/`
- เอกสารอ่อนไหว (`VERIFICATION_DOC`, `CHANGE_REQUEST_DOC`, `PAYMENT_SLIP`, `SIGNED_CONTRACT_PDF`) **ต้องไม่ผ่าน CloudFront สาธารณะ** ให้ดาวน์โหลดผ่าน presigned URL อายุสั้นหลังตรวจสิทธิ์เท่านั้น
- ตั้ง CORS ให้ domain ของเว็บเรียก `PUT` ได้ (สำหรับ presigned upload):

```json
[
  {
    "AllowedOrigins": ["https://app.example.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

- ตั้ง **Lifecycle rule** ลบไฟล์ที่อัปโหลดแต่ไม่ถูก confirm (ค้างใน prefix `tmp/`) ภายใน 1 วัน

### 5.6.2 Flow อัปโหลดไฟล์

```
1. Client → POST /files/upload-url (ระบุ file_category, mime_type, size)
2. API   → ตรวจสิทธิ์/ขนาด/ชนิดไฟล์ → สร้างแถว storage_files → ตอบ presigned PUT URL
3. Client → PUT ไฟล์ตรงไปที่ S3
4. Client → POST /files/{fil_id}/confirm
5. API   → ตรวจว่าไฟล์อยู่จริง (HEAD) → ถ้าเป็นวิดีโอ ส่งเข้า MediaConvert (intro_video_status = PROCESSING)
```

### 5.6.3 CloudFront และวิดีโอ HLS

- สร้าง Distribution ชี้ไปที่ bucket/prefix ของวิดีโอที่แปลงแล้ว ใช้ **Origin Access Control (OAC)**
- เมื่อ MediaConvert เสร็จ → Worker/Webhook ตั้ง `intro_video_hls_url` (เช่น `https://<CLOUDFRONT_DOMAIN>/intro-videos/<tut_id>/master.m3u8`) และตั้ง `intro_video_status = READY`
- ถ้าต้องการจำกัดการเข้าถึงวิดีโอ ใช้ CloudFront Signed URL/Cookie

### 5.6.4 IAM

- API/Worker ใช้ **IAM Role** (ไม่ฝัง Access Key) สิทธิ์ขั้นต่ำ: `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` บน bucket นี้ และ `mediaconvert:CreateJob` ตามจำเป็น
- ห้ามให้สิทธิ์ `s3:*` หรือ  ทั้งบัญชี

---

## 5.7 การตั้งค่า OAuth และผู้ให้บริการภายนอก

| บริการ | สิ่งที่ต้องทำ                                    | Redirect URI ที่ต้องลงทะเบียน |
| ------------ | ------------------------------------------------------------- | --------------------------------------------- |
| Google       | สร้าง OAuth Client (Web + iOS/Android)                   | `{APP_BASE_URL}/auth/google/callback`       |
| Email        | ยืนยัน Domain/Sender (SPF, DKIM)                        | —                                            |
| SMS          | ลงทะเบียน Sender Name ที่ผู้ให้บริการ | —                                            |

ใช้ OAuth App แยกกันระหว่าง `staging` กับ `production` และอย่าใช้ credential ชุดเดียวกัน

---

## 5.8 คำสั่งที่ใช้บ่อย

| งาน                                       | คำสั่ง                                                        |
| -------------------------------------------- | ------------------------------------------------------------------- |
| สร้าง migration ใหม่                | `uv run alembic revision --autogenerate -m "ข้อความ"`      |
| อัปเกรด / ย้อนกลับ 1 ขั้น | `uv run alembic upgrade head` / `uv run alembic downgrade -1` |
| รัน test                                  | `uv run pytest -q`                                                |
| รัน test พร้อม coverage              | `uv run pytest --cov=app --cov-report=term-missing`               |
| Lint / format                                | `uv run ruff check .` / `uv run ruff format .`                |
| Type check                                   | `uv run mypy app`                                                 |
| ล้างฐานข้อมูล local             | `docker compose down -v && docker compose up -d`                  |

ตรวจ migration ที่ autogenerate ทุกครั้งก่อน commit โดยเฉพาะคอลัมน์ `GEOMETRY`, Array, ENUM และ constraint ที่ระบุในหัวข้อ 3.8 เพราะ autogenerate มักสร้างไม่ครบ

---

## 5.9 สภาพแวดล้อมแต่ละระดับ

| หัวข้อ       | Local            | Staging                                                   | Production                                               |
| ------------------ | ---------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| ฐานข้อมูล | Docker (PostGIS) | Managed PostgreSQL (RDS/Aurora) + PostGIS                 | Managed PostgreSQL, Multi-AZ, backup อัตโนมัติ  |
| Redis              | Docker           | Managed (ElastiCache)                                     | Managed, ตั้ง persistence/replica ตามที่ใช้ |
| ไฟล์           | MinIO            | S3 + CloudFront (แยก bucket)                           | S3 + CloudFront                                          |
| `APP_DEBUG`      | `true`         | `false`                                                 | `false`                                                |
| Swagger`/docs`   | เปิด         | เปิด (จำกัดด้วย auth/IP)                     | **ปิด** หรือจำกัด                     |
| ข้อมูล       | Seed             | ข้อมูลทดสอบ (ไม่ใช้ข้อมูลจริง) | ข้อมูลจริง                                     |
| Secrets            | `.env`         | Secret Manager                                            | Secret Manager                                           |
| Logging            | Console          | JSON → ศูนย์รวม Log                              | JSON → ศูนย์รวม Log + แจ้งเตือน        |

---

## 5.10 Background Worker และงานตั้งเวลา

ต้องรัน Worker อย่างน้อย 1 instance ในทุก environment (ไม่เช่นนั้นแจ้งเตือนและงานอัตโนมัติจะไม่ทำงาน)

| งาน                                                  | ความถี่       | หน้าที่                                                      |
| ------------------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| ส่งแจ้งเตือน (Push/Email/SMS)               | ตามคิว         | ตาม`priority_tier` และ `notification_settings`          |
| เตือนก่อนเรียน                            | ทุก 5 นาที    | หา session ที่จะเริ่มภายในเวลาที่กำหนด |
| หมดอายุ Booking`PENDING_CONFIRMATION`          | ทุก 15 นาที   | →`CANCELLED`                                                     |
| ปิด session อัตโนมัติ / ตั้ง`NO_SHOW` | ทุก 5 นาที    | ตามกฎหัวข้อ 3.4.4                                        |
| ยืนยันฝั่งนักเรียนอัตโนมัติ  | ทุกชั่วโมง | ตั้ง`student_confirmed_at`                                    |
| Flush`view_count` จาก Redis → DB                 | ทุก 1 นาที    | —                                                                  |
| ล้าง`user_sessions` ที่หมดอายุ         | ทุกวัน         | ตั้ง`is_active = FALSE` (soft-delete)                        |

ทุกงานต้อง **idempotent** และมี lock กันรันซ้ำเมื่อมีหลาย instance (ดูหัวข้อ 3.8)

---

## 5.11 WebSocket (แชต) เมื่อมีหลาย Instance

- ใช้ Redis **Pub/Sub** เป็นตัวกลางกระจายข้อความระหว่าง instance (ห้ามเก็บ connection ไว้เฉพาะในหน่วยความจำของ instance เดียว)
- Load Balancer ต้องรองรับ WebSocket (Upgrade header) และตั้ง idle timeout ≥ 60 วินาที พร้อม ping/pong
- ยืนยันตัวตนตอนเชื่อมต่อด้วย Access Token (ผ่าน query param ที่อายุสั้น หรือ message แรก) แล้วตรวจว่าผู้ใช้เป็นสมาชิกของ `conversations` นั้น

---

## 5.12 ความปลอดภัย (Security Checklist)

- [ ] ไม่ commit `.env` / credential เข้า Git (ใส่ `.gitignore` และตรวจด้วย secret scanning)
- [ ] [ ] `JWT_SECRET_KEY` ยาวและสุ่ม แยกแต่ละ environment
- [ ] รหัสผ่านใช้ **argon2** หรือ **bcrypt** (`user_auth_providers.password_hash`)
- [ ] เปิด HTTPS ทุก environment ที่ไม่ใช่ local (บังคับ redirect + HSTS)
- [ ] CORS ระบุ origin ชัดเจน
- [ ] Rate limit ที่ login, OTP, สมัครสมาชิก, อัปโหลดไฟล์, ส่งข้อความ (เก็บใน Redis)
- [ ] ตรวจ `mime_type` และขนาดไฟล์ทั้งตอนขอ presigned URL และตอน confirm
- [ ] เอกสารอ่อนไหวเข้าถึงผ่าน presigned URL อายุสั้นเท่านั้น
- [ ] ข้อมูลส่วนบุคคล (เลขบัญชี, พร้อมเพย์, เบอร์ผู้ปกครอง, ที่อยู่) ไม่เขียนลง Log และ mask เมื่อแสดงใน `entity_audit_logs` ที่ส่งออก **[ต้องตัดสินใจ]** ว่าจะเข้ารหัสระดับคอลัมน์หรือไม่
- [ ] เก็บ `user_activity_logs` ตามนโยบาย PDPA (แจ้งวัตถุประสงค์, กำหนดอายุการเก็บ)
- [ ] ระบบนี้มีข้อมูลของ **ผู้เยาว์** (นักเรียน, ผู้ปกครอง) ต้องออกแบบการยินยอมตาม PDPA
- [ ] ตั้ง dependency scanning และอัปเดตเป็นระยะ

---

## 5.13 การสำรองและกู้คืนข้อมูล

| รายการ                 | ข้อเสนอ                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL                   | Automated backup รายวัน + Point-in-Time Recovery, เก็บ ≥ 7–30 วัน                                                                     |
| ทดสอบการกู้คืน | อย่างน้อยไตรมาสละครั้ง                                                                                                         |
| S3                           | เปิด Versioning สำหรับ bucket เอกสาร/สัญญา/สลิป                                                                             |
| Redis                        | ไม่ใช่แหล่งข้อมูลหลัก (สูญหายแล้วต้องสร้างใหม่ได้) ยกเว้นคิวงานที่ตั้ง persistence |
| Migration                    | ทุก migration ต้องมี plan ย้อนกลับ และทดสอบบน staging ที่มีข้อมูลขนาดใกล้ production                   |

---

## 5.14 แก้ปัญหาที่พบบ่อย (Troubleshooting)

| อาการ                                                              | สาเหตุที่เป็นไปได้                                 | วิธีแก้                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `type "geometry" does not exist`                                      | ยังไม่ได้เปิด PostGIS                                   | รัน`CREATE EXTENSION postgis;` หรือใช้ image `postgis/postgis`           |
| Migration ล้มเหลวที่`EXCLUDE USING gist`                    | ยังไม่มี`btree_gist`                                       | `CREATE EXTENSION btree_gist;`                                                         |
| `connection refused` ที่ DB/Redis                                 | Container ยังไม่พร้อม/พอร์ตชน                      | `docker compose ps`, ตรวจ `healthcheck`, ตรวจพอร์ต 5432/6379           |
| อัปโหลดไป S3 แล้วติด CORS                               | ยังไม่ตั้ง CORS ที่ bucket                              | ตั้งตามหัวข้อ 5.6.1                                                         |
| `SignatureDoesNotMatch` ตอน PUT                                   | `Content-Type` ที่ส่งไม่ตรงกับตอนขอ URL       | ให้ client ส่ง header เดียวกับที่ระบุตอนสร้าง presigned URL |
| วิดีโอค้างที่`PROCESSING`                                | MediaConvert ล้มเหลว หรือ webhook/worker ไม่ทำงาน | ดู Log Worker และสถานะ job ใน MediaConvert                                   |
| Login ผ่าน OAuth ไม่ได้                                       | Redirect URI ไม่ตรง                                            | ตรวจค่าที่ลงทะเบียนกับ`APP_BASE_URL`                             |
| แจ้งเตือนไม่ส่ง / งานตั้งเวลาไม่ทำงาน | Worker ไม่ได้รัน                                            | เปิด process ARQ และตรวจ`REDIS_URL`                                         |
| แชตไม่ถึงอีกฝ่ายเมื่อมีหลาย instance         | ไม่ได้ใช้ Redis Pub/Sub                                     | ดูหัวข้อ 5.11                                                                    |

---

## 5.15 รายการตรวจก่อนเริ่มพัฒนา (Onboarding Checklist)

- [ ] ติดตั้ง Python, uv, Docker แล้ว
- [ ] [ ] `docker compose up -d` สำเร็จ ทั้ง db, redis, minio
- [ ] [ ] `.env` กรอกครบอย่างน้อยหมวด 5.4.1–5.4.2, 5.4.3 (JWT) และ 5.4.4 (MinIO)
- [ ] [ ] `alembic upgrade head` สำเร็จ และเห็นครบ 24 ตาราง
- [ ] Seed วิชา + `usr_system` + Admin แล้ว
- [ ] [ ] `/health` ตอบ `ok` และ `/docs` เปิดได้
- [ ] [ ] `pytest` ผ่านทั้งหมด
- [ ] ทดสอบ flow อัปโหลดไฟล์ (ขอ URL → PUT → confirm) กับ MinIO ได้

---

## 5.16 ข้อที่ต้องยืนยันกับทีม

| หัวข้อ                                                                        | เหตุผล                                                                     |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| เวอร์ชัน Python / ORM / ตัวจัดการ dependency / ตัวรัน worker | เอกสารนี้สมมติ Python 3.12, SQLAlchemy 2, uv, ARQ                  |
| ผู้ให้บริการ Cloud และ Region                                        | เอกสารนี้สมมติ AWS`ap-southeast-1`                               |
| ผู้ให้บริการ Email / SMS / Push                                         | ยังไม่ระบุในเอกสารเดิม                                     |
| วิธีแปลงวิดีโอ                                                        | สมมติ MediaConvert อาจเปลี่ยนเป็น ffmpeg บน Worker          |
| ช่องทาง Deploy (ECS, Kubernetes, VM)                                         | กระทบการตั้งค่า Worker, WebSocket และ Secret                   |
| นโยบาย PDPA และการเก็บ Log                                          | ข้อมูลผู้เยาว์ ผู้ปกครอง และข้อมูลการเงิน |
