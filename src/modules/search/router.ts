import { Router } from 'express';
import { entityId } from '../../common/ids';
import { tutorSearchSchema } from './schemas';
import * as service from './service';

export const tutorSearchRouter = Router();
tutorSearchRouter.get('/', async (req, res) =>
  res.json({ data: await service.search(tutorSearchSchema.parse(req.query)) }),
);
tutorSearchRouter.get('/:id', async (req, res) =>
  res.json({ data: await service.detail(entityId('tut').parse(req.params.id)) }),
);
tutorSearchRouter.get('/:id/availability', async (req, res) =>
  res.json({ data: await service.publicAvailability(entityId('tut').parse(req.params.id)) }),
);
