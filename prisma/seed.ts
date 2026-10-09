import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const subjects = [
  { id: 'sbj_mathematics', name_th: 'คณิตศาสตร์', name_en: 'Mathematics', category: 'Academic' },
  { id: 'sbj_science', name_th: 'วิทยาศาสตร์', name_en: 'Science', category: 'Academic' },
  { id: 'sbj_english', name_th: 'ภาษาอังกฤษ', name_en: 'English', category: 'Languages' },
];
async function main() {
  for (const subject of subjects) {
    await prisma.subjects.upsert({ where: { id: subject.id }, create: subject, update: {} });
  }
}
main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
