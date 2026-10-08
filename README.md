
# Backend

Backend API สำหรับโปรเจกต์

## Requirements

ก่อนเริ่มใช้งาน ต้องติดตั้ง:

* Node.js
* npm
* Git

ตรวจสอบเวอร์ชัน:

```bash
node -v
npm -v
git --version
```

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd BackEnd
```

### 2. ติดตั้ง Dependencies

ถ้ามี `package-lock.json` ให้ใช้:

```bash
npm ci
```

หรือสามารถใช้:

```bash
npm install
```

คำสั่งนี้จะติดตั้ง package ที่ระบุไว้ใน `package.json`

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`

```bash
cp .env.example .env
```

จากนั้นเปิดไฟล์ `.env` และกำหนดค่าตาม environment ของเครื่อง

> ห้าม commit ไฟล์ `.env` ขึ้น Git เนื่องจากอาจมีข้อมูลสำคัญ เช่น Secret หรือ Database credentials

### 4. Build Project

ตรวจสอบว่า TypeScript สามารถ compile ได้:

```bash
npm run build
```

### 5. Run Development Server

```bash
npm run dev
```

Server จะทำงานตาม Port ที่กำหนดไว้ใน `.env`

## Project Structure

```text
BackEnd/
├── src/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── routes/
│   ├── config/
│   ├── middleware/
│   └── server.ts
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

## Database

ปัจจุบัน Database ยังไม่ได้สร้างเป็น PostgreSQL จริง

มีการออกแบบ **Paper DB / Database Schema** ไว้สำหรับใช้เป็นโครงสร้างอ้างอิงในการพัฒนา API

ดังนั้น API ที่เกี่ยวข้องกับ Database อาจยังไม่สามารถทดสอบกับ Database จริงได้จนกว่าจะมีการสร้าง PostgreSQL

## Development

สามารถพัฒนา API เพิ่มเติมโดยยึดตาม API Specification และ Paper DB ของโปรเจกต์

ตัวอย่าง API ที่สามารถพัฒนาต่อ:

```text
POST   /api/v1/bookings
GET    /api/v1/bookings
GET    /api/v1/bookings/:id
POST   /api/v1/bookings/:id/contract
PATCH  /api/v1/bookings/:id/confirm
PATCH  /api/v1/bookings/:id/cancel
```

## Important

ไม่ต้อง commit ไฟล์ต่อไปนี้:

```text
.env
node_modules/
dist/
```

ไฟล์ที่ควร commit:

```text
package.json
package-lock.json
src/
tsconfig.json
.env.example
.gitignore
README.md
```
