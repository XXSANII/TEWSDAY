import { Router, Request, Response } from 'express';
import { authenticate, roles } from '../../middleware/auth';
import { entityId } from '../../common/ids';
import * as schemas from './schemas';
import * as service from './service';

export const jobRouter = Router();
jobRouter.get('/', async (req, res) =>
  res.json({ data: await service.list(schemas.jobSearchSchema.parse(req.query)) }),
);
jobRouter.get('/:id', async (req, res) =>
  res.json({ data: await service.detail(entityId('job').parse(req.params.id)) }),
);
jobRouter.post('/', authenticate, roles('STUDENT'), async (req, res) =>
  res
    .status(201)
    .json({ data: await service.create(req.actor.userId, schemas.jobSchema.parse(req.body)) }),
);
jobRouter.patch('/:id/status', authenticate, roles('STUDENT'), async (req, res) =>
  res.json({
    data: await service.setStatus(
      req.actor.userId,
      entityId('job').parse(req.params.id),
      schemas.jobStatusSchema.parse(req.body).status,
    ),
  }),
);
jobRouter.post('/:id/share', authenticate, async (req, res) =>
  res.json({ data: await service.share(req.actor.userId, entityId('job').parse(req.params.id)) }),
);
jobRouter.get('/:id/applications', authenticate, async (req, res) =>
  res.json({
    data: await service.applications(req.actor.userId, entityId('job').parse(req.params.id)),
  }),
);
const applyHandler = async (req: Request, res: Response) => {
  const input = schemas.applicationSchema.parse(req.body);
  res.status(201).json({
    data: await service.apply(
      req.actor.userId,
      entityId('job').parse(req.params.id),
      input.proposed_rate,
      input.cover_message,
    ),
  });
};
jobRouter.post('/:id/apply', authenticate, roles('TUTOR'), applyHandler);
jobRouter.post('/:id/applications', authenticate, roles('TUTOR'), applyHandler);
jobRouter.post(
  '/:jobId/applications/:id/accept',
  authenticate,
  roles('STUDENT'),
  async (req, res) =>
    res.json({
      data: await service.decide(
        req.actor.userId,
        entityId('app').parse(req.params.id),
        'ACCEPTED',
        schemas.acceptanceSchema.parse(req.body ?? {}),
        entityId('job').parse(req.params.jobId),
      ),
    }),
);

export const applicationRouter = Router();
applicationRouter.patch('/:id/status', authenticate, async (req, res) => {
  const { status, ...input } = schemas.applicationStatusSchema.parse(req.body);
  res.json({
    data: await service.decide(
      req.actor.userId,
      entityId('app').parse(req.params.id),
      status,
      input,
    ),
  });
});
