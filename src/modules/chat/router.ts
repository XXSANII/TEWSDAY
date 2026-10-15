import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { entityId } from '../../common/ids';
import * as schemas from './schemas';
import * as service from './service';

export const chatRouter = Router();

chatRouter.use(authenticate);

// GET / — ดึงรายการห้องแชททั้งหมดของผู้ใช้
chatRouter.get('/', async (req, res) =>
  res.json({ data: await service.getUserConversations(req.actor.userId) }),
);

// POST / — เปิดห้องแชทใหม่ หรือดึงห้องที่มีอยู่แล้ว
chatRouter.post('/', async (req, res) =>
  res.status(201).json({
    data: await service.openOrCreateConversation(
      req.actor.userId,
      schemas.createConversationSchema.parse(req.body),
    ),
  }),
);

// GET /:id/messages — ดึงประวัติข้อความ (Cursor Pagination)
chatRouter.get('/:id/messages', async (req, res) => {
  const conversationId = entityId('cnv').parse(req.params.id);
  const query = schemas.getMessagesQuerySchema.parse(req.query);
  res.json({
    data: await service.getConversationMessages(req.actor.userId, conversationId, query),
  });
});

// POST /:id/messages — ส่งข้อความใหม่
chatRouter.post('/:id/messages', async (req, res) => {
  const conversationId = entityId('cnv').parse(req.params.id);
  const input = schemas.sendMessageSchema.parse(req.body);
  res.status(201).json({
    data: await service.sendMessage(req.actor.userId, conversationId, input),
  });
});

// PATCH /:id/read — อัปเดตสถานะอ่านแล้ว
chatRouter.patch('/:id/read', async (req, res) => {
  const conversationId = entityId('cnv').parse(req.params.id);
  res.json({
    data: await service.markAsRead(req.actor.userId, conversationId),
  });
});

// DELETE /messages/:id — ยกเลิกการส่งข้อความ (Soft delete)
chatRouter.delete('/messages/:id', async (req, res) => {
  const messageId = entityId('msg').parse(req.params.id);
  await service.unsendMessage(req.actor.userId, messageId);
  res.status(204).end();
});

export default chatRouter;
