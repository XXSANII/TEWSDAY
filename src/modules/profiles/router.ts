import { Router } from 'express';
import { authenticate, roles } from '../../middleware/auth';
import { entityId } from '../../common/ids';
import * as schemas from './schemas';
import * as service from './service';

export const tutorProfileRouter = Router();
tutorProfileRouter.use('/me', authenticate, roles('TUTOR'));
tutorProfileRouter.get('/me', async (req, res) =>
  res.json({ data: await service.getOwn('tutor_profiles', req.actor.userId) }),
);
tutorProfileRouter.put('/me', async (req, res) =>
  res.json({
    data: await service.updateOwn(
      'tutor_profiles',
      req.actor.userId,
      schemas.updateTutorSchema.parse(req.body),
    ),
  }),
);
tutorProfileRouter.patch('/me', async (req, res) =>
  res.json({
    data: await service.updateOwn(
      'tutor_profiles',
      req.actor.userId,
      schemas.updateTutorSchema.parse(req.body),
    ),
  }),
);
tutorProfileRouter.post('/me/education', async (req, res) =>
  res.status(201).json({
    data: await service.addEducation(req.actor.userId, schemas.educationSchema.parse(req.body)),
  }),
);
tutorProfileRouter.delete('/me/education/:id', async (req, res) => {
  await service.removeEducation(req.actor.userId, entityId('edu').parse(req.params.id));
  res.status(204).end();
});
tutorProfileRouter.get('/me/availability', async (req, res) =>
  res.json({ data: await service.availability(req.actor.userId) }),
);
tutorProfileRouter.put('/me/availability', async (req, res) =>
  res.json({
    data: await service.replaceAvailability(
      req.actor.userId,
      schemas.availabilitySchema.parse(req.body),
    ),
  }),
);
tutorProfileRouter.put('/me/subjects', async (req, res) =>
  res.json({
    data: await service.replaceSubjects(req.actor.userId, schemas.subjectsSchema.parse(req.body)),
  }),
);
tutorProfileRouter.post('/me/change-requests', async (req, res) =>
  res.status(201).json({
    data: await service.changeRequest(
      req.actor.userId,
      schemas.changeRequestSchema.parse(req.body),
    ),
  }),
);

export const studentProfileRouter = Router();
studentProfileRouter.use(authenticate, roles('STUDENT'));
studentProfileRouter.get('/me', async (req, res) =>
  res.json({ data: await service.getOwn('student_profiles', req.actor.userId) }),
);
studentProfileRouter.put('/me', async (req, res) =>
  res.json({
    data: await service.updateOwn(
      'student_profiles',
      req.actor.userId,
      schemas.updateStudentSchema.parse(req.body),
    ),
  }),
);
studentProfileRouter.put('/me/emergency-contact', async (req, res) =>
  res.json({
    data: await service.updateOwn(
      'student_profiles',
      req.actor.userId,
      schemas.contactSchema.parse(req.body),
    ),
  }),
);

export const profileCreateRouter = Router();
profileCreateRouter.use(authenticate);
profileCreateRouter.post('/tutor', async (req, res) =>
  res.status(201).json({
    data: await service.createTutor(req.actor.userId, schemas.createTutorSchema.parse(req.body)),
  }),
);
profileCreateRouter.post('/student', async (req, res) =>
  res.status(201).json({
    data: await service.createStudent(
      req.actor.userId,
      schemas.createStudentSchema.parse(req.body),
    ),
  }),
);
