import { Router } from 'express';
import { db } from '../../db';
import { entityId } from '../../common/ids';
import { requireFound } from '../../common/errors';

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
    ),
  }),
);
