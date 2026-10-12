import { Router } from 'express';
import { z } from 'zod';
import { db, transaction } from '../../db';
import { entityId, newId } from '../../common/ids';
import { requireFound } from '../../common/errors';
import { authenticate, roles } from '../../middleware/auth';

export const subjectRouter = Router();
const select = { id: true, name_th: true, name_en: true, category: true };
subjectRouter.get('/', async (_req, res) =>
  res.json({
    data: await db.subjects.findMany({
      where: { is_active: true },
      select,
      orderBy: { name_en: 'asc' },
      take: 500,
    }),
  }),
);
subjectRouter.get('/:id', async (req, res) =>
  res.json({
    data: requireFound(
      await db.subjects.findFirst({
        where: { id: entityId('sbj').parse(req.params.id), is_active: true },
        select,
      }),
      'Subject not found',
    ),
  }),
);

export const adminSubjectRouter = Router();
adminSubjectRouter.use(authenticate, roles('ADMIN'));
const subjectInput = z
  .object({
    name_th: z.string().trim().min(1).max(100),
    name_en: z.string().trim().min(1).max(100),
    category: z.string().trim().min(1).max(50),
  })
  .strict();

adminSubjectRouter.post('/', async (req, res) => {
  const input = subjectInput.parse(req.body);
  const data = await transaction(req.actor.userId, async (tx) =>
    tx.subjects.create({
      data: {
        id: newId('sbj'),
        ...input,
        created_by: req.actor.userId,
        updated_by: req.actor.userId,
      },
      select,
    }),
  );
  res.status(201).json({ data });
});

adminSubjectRouter.put('/:id', async (req, res) => {
  const id = entityId('sbj').parse(req.params.id);
  const input = subjectInput.parse(req.body);
  const data = await transaction(req.actor.userId, async (tx) => {
    const subject = requireFound(
      await tx.subjects.findFirst({ where: { id, is_active: true } }),
      'Subject not found',
    );
    return tx.subjects.update({
      where: { id: subject.id },
      data: { ...input, updated_by: req.actor.userId, updated_at: new Date() },
      select,
    });
  });
  res.json({ data });
});
