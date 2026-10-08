import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { guard, requireFound } from '../../common/errors';
import { db, transaction } from '../../db';

export const userRouter = Router();
userRouter.use(authenticate);
userRouter.get('/me', async (req, res) =>
  res.json({
    data: requireFound(
      await db.users.findFirst({
        where: { id: req.actor.userId, is_active: true },
        select: {
          id: true,
          email: true,
          roles: true,
          current_mode: true,
          avatar_file_id: true,
          notification_settings: true,
        },
      }),
    ),
  }),
);
userRouter.patch('/me/mode', async (req, res) => {
  const body = z
    .object({ current_mode: z.enum(['STUDENT', 'TUTOR', 'ADMIN']) })
    .strict()
    .parse(req.body);
  guard(
    req.actor.roles.includes(body.current_mode),
    403,
    'MODE_FORBIDDEN',
    'Mode must be one of your held roles',
  );
  const data = await transaction(req.actor.userId, async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.actor.userId} FOR NO KEY UPDATE`;
    const user = requireFound(await tx.users.findUnique({ where: { id: req.actor.userId } }));
    guard(
      user.is_active && user.roles.includes(body.current_mode),
      403,
      'MODE_FORBIDDEN',
      'Mode must be one of your held roles',
    );
    return tx.users.update({
      where: { id: user.id },
      data: { current_mode: body.current_mode, updated_by: user.id, updated_at: new Date() },
      select: { id: true, roles: true, current_mode: true },
    });
  });
  res.json({ data });
});
