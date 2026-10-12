import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { ApiError, guard, requireFound } from '../../common/errors';
import { db, transaction } from '../../db';
import { ownFile } from '../../common/files';
import { Prisma } from '@prisma/client';

export const userRouter = Router();
userRouter.use(authenticate);

const userSelect = {
  id: true, email: true, roles: true, current_mode: true,
  avatar_file_id: true, notification_settings: true,
} as const;

userRouter.get('/me', async (req, res) => {
  const user = requireFound(await db.users.findFirst({
    where: { id: req.actor.userId, is_active: true }, select: userSelect,
  }), 'User not found');
  res.json({ data: user });
});

userRouter.patch('/me/mode', async (req, res) => {
  const body = z.object({ current_mode: z.enum(['STUDENT', 'TUTOR']) }).strict().parse(req.body);
  guard(req.actor.roles.includes(body.current_mode), 403, 'MODE_FORBIDDEN',
    'Mode must be one of your held roles');
  const data = await transaction(req.actor.userId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.actor.userId} FOR NO KEY UPDATE`;
    const user = requireFound(await tx.users.findUnique({ where: { id: req.actor.userId } }));
    guard(user.is_active && user.roles.includes(body.current_mode), 403, 'MODE_FORBIDDEN',
      'Mode must be one of your held roles');
    return tx.users.update({
      where: { id: user.id },
      data: { current_mode: body.current_mode, updated_by: user.id, updated_at: new Date() },
      select: { id: true, roles: true, current_mode: true },
    });
  });
  res.json({ data });
});

userRouter.patch('/me/notifications', async (req, res) => {
  const body = z.object({
    notification_settings: z.record(z.string(), z.boolean()).refine(
      (v) => Object.keys(v).length > 0 && Object.keys(v).length <= 30,
      'Provide between 1 and 30 notification settings',
    ),
  }).strict().parse(req.body);
  const data = await transaction(req.actor.userId, async (tx) => {
    const user = requireFound(await tx.users.findFirst({
      where: { id: req.actor.userId, is_active: true },
    }), 'User not found');
    const previous = (user.notification_settings ?? {}) as Record<string, unknown>;
    return tx.users.update({
      where: { id: user.id },
      data: {
        notification_settings: { ...previous, ...body.notification_settings } as Prisma.InputJsonValue,
        updated_by: user.id,
        updated_at: new Date(),
      },
      select: { id: true, notification_settings: true },
    });
  });
  res.json({ data });
});

userRouter.patch('/me/profile-image', async (req, res) => {
  const body = z.object({ avatar_file_id: z.string().min(1).max(36).nullable() }).strict().parse(req.body);
  const data = await transaction(req.actor.userId, async (tx) => {
    if (body.avatar_file_id) {
      await ownFile(tx, body.avatar_file_id, req.actor.userId, ['AVATAR']);
    }
    const user = requireFound(await tx.users.findFirst({
      where: { id: req.actor.userId, is_active: true },
    }), 'User not found');
    return tx.users.update({
      where: { id: user.id },
      data: { avatar_file_id: body.avatar_file_id, updated_by: user.id, updated_at: new Date() },
      select: { id: true, avatar_file_id: true },
    });
  });
  res.json({ data });
});
