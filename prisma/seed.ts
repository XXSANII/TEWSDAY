import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');

  // ----------------------------------------------------
  // 1. Seed Subjects (วิชาเรียน)
  // ----------------------------------------------------
  const subjects = [
    { id: 'sbj_mathematics', name_th: 'คณิตศาสตร์', name_en: 'Mathematics', category: 'Academic' },
    { id: 'sbj_science', name_th: 'วิทยาศาสตร์', name_en: 'Science', category: 'Academic' },
    { id: 'sbj_physics', name_th: 'ฟิสิกส์', name_en: 'Physics', category: 'Academic' },
    { id: 'sbj_chemistry', name_th: 'เคมี', name_en: 'Chemistry', category: 'Academic' },
    { id: 'sbj_biology', name_th: 'ชีววิทยา', name_en: 'Biology', category: 'Academic' },
    { id: 'sbj_english', name_th: 'ภาษาอังกฤษ', name_en: 'English', category: 'Languages' },
    { id: 'sbj_chinese', name_th: 'ภาษาจีน', name_en: 'Chinese', category: 'Languages' },
    {
      id: 'sbj_coding',
      name_th: 'เขียนโปรแกรม',
      name_en: 'Computer & Coding',
      category: 'Technology',
    },
  ];

  for (const subject of subjects) {
    await prisma.subjects.upsert({
      where: { id: subject.id },
      create: subject,
      update: subject,
    });
  }
  console.log('1. Subjects seeded.');

  // ----------------------------------------------------
  // 2. Seed System User (บัญชีระบบสำหรับรับค่าคอมมิชชัน)
  // ----------------------------------------------------
  await prisma.users.upsert({
    where: { id: 'usr_system' },
    create: {
      id: 'usr_system',
      email: 'system@tewsday.internal',
      roles: ['ADMIN'],
      current_mode: 'ADMIN',
      is_active: true,
    },
    update: {},
  });
  console.log('2. System user seeded.');

  // ----------------------------------------------------
  // 3. Seed Admin User
  // ----------------------------------------------------
  const adminPasswordHash = await hashPassword('Admin1234!');
  const adminUser = await prisma.users.upsert({
    where: { id: 'usr_admin_001' },
    create: {
      id: 'usr_admin_001',
      email: 'admin@tewsday.app',
      roles: ['ADMIN', 'STUDENT'],
      current_mode: 'ADMIN',
      is_active: true,
    },
    update: {},
  });

  await prisma.user_auth_providers.upsert({
    where: { id: 'uap_admin_001' },
    create: {
      id: 'uap_admin_001',
      user_id: adminUser.id,
      provider: 'LOCAL',
      password_hash: adminPasswordHash,
      is_active: true,
    },
    update: {},
  });
  console.log('3. Admin user seeded (admin@tewsday.app / Admin1234!)');

  // ----------------------------------------------------
  // 4. Seed Student User + Student Profile
  // ----------------------------------------------------
  const studentPasswordHash = await hashPassword('Student1234!');
  const studentUser = await prisma.users.upsert({
    where: { id: 'usr_student_001' },
    create: {
      id: 'usr_student_001',
      email: 'student@tewsday.app',
      roles: ['STUDENT'],
      current_mode: 'STUDENT',
      is_active: true,
    },
    update: {},
  });

  await prisma.user_auth_providers.upsert({
    where: { id: 'uap_student_001' },
    create: {
      id: 'uap_student_001',
      user_id: studentUser.id,
      provider: 'LOCAL',
      password_hash: studentPasswordHash,
      is_active: true,
    },
    update: {},
  });

  // ใส่ข้อมูล Student Profile (ใช้ PostGIS สำหรับพิกัดที่อยู่)
  await prisma.$executeRaw`
    INSERT INTO student_profiles (id, user_id, first_name, last_name, current_grade_level, school_name, location, created_by, updated_by)
    VALUES ('std_001', 'usr_student_001', 'สมชาย', 'เรียนดี', 'ม.6', 'โรงเรียนสาธิต', ST_SetSRID(ST_MakePoint(100.5018, 13.7563), 4326), 'usr_student_001', 'usr_student_001')
    ON CONFLICT (user_id) DO NOTHING;
  `;
  console.log('4. Student user & profile seeded (student@tewsday.app / Student1234!)');

  // ----------------------------------------------------
  // 5. Seed Tutor User + Tutor Profile + Tutor Subjects
  // ----------------------------------------------------
  const tutorPasswordHash = await hashPassword('Tutor1234!');
  const tutorUser = await prisma.users.upsert({
    where: { id: 'usr_tutor_001' },
    create: {
      id: 'usr_tutor_001',
      email: 'tutor@tewsday.app',
      roles: ['TUTOR', 'STUDENT'],
      current_mode: 'TUTOR',
      is_active: true,
    },
    update: {},
  });

  await prisma.user_auth_providers.upsert({
    where: { id: 'uap_tutor_001' },
    create: {
      id: 'uap_tutor_001',
      user_id: tutorUser.id,
      provider: 'LOCAL',
      password_hash: tutorPasswordHash,
      is_active: true,
    },
    update: {},
  });

  // ใส่ข้อมูล Tutor Profile
  await prisma.$executeRaw`
    INSERT INTO tutor_profiles (
      id, user_id, first_name, last_name, gender, bio, hourly_rate, 
      teaching_location_type, location, service_radius_km, intro_video_status, 
      verification_status, account_status, created_by, updated_by
    )
    VALUES (
      'tut_001', 'usr_tutor_001', 'กิตติ', 'สอนดี', 'MALE'::tutor_profiles_gender_enum, 
      'สอนคณิตศาสตร์และเขียนโปรแกรม ประสบการณ์สอน 5 ปี ติวเข้า ม.4 และ มหาลัย', 450.00, 
      'BOTH'::tutor_profiles_teaching_location_type_enum, ST_SetSRID(ST_MakePoint(100.5120, 13.7450), 4326), 
      15.00, 'PROCESSING', 'VERIFIED'::tutor_profiles_verification_status_enum, 'ACTIVE'::tutor_profiles_account_status_enum, 
      'usr_tutor_001', 'usr_tutor_001'
    )
    ON CONFLICT (user_id) DO NOTHING;
  `;

  // ผูกวิชาที่ติวเตอร์รับสอน
  await prisma.tutor_subjects.upsert({
    where: {
      tutor_id_subject_id: {
        tutor_id: 'tut_001',
        subject_id: 'sbj_mathematics',
      },
    },
    create: {
      tutor_id: 'tut_001',
      subject_id: 'sbj_mathematics',
      grade_levels: ['ม.4', 'ม.5', 'ม.6'],
      specialized_topics: ['แคลคูลัส', 'ตรรกศาสตร์', 'เซต'],
      custom_rate: 450.0,
      created_by: 'usr_tutor_001',
      updated_by: 'usr_tutor_001',
    },
    update: {},
  });

  await prisma.tutor_subjects.upsert({
    where: {
      tutor_id_subject_id: {
        tutor_id: 'tut_001',
        subject_id: 'sbj_coding',
      },
    },
    create: {
      tutor_id: 'tut_001',
      subject_id: 'sbj_coding',
      grade_levels: ['ม.ปลาย', 'มหาลัย'],
      specialized_topics: ['TypeScript', 'Node.js', 'Python'],
      custom_rate: 500.0,
      created_by: 'usr_tutor_001',
      updated_by: 'usr_tutor_001',
    },
    update: {},
  });

  console.log('5. Tutor user, profile & subjects seeded (tutor@tewsday.app / Tutor1234!)');

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
