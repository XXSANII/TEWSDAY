import { Prisma } from '@prisma/client';
import { db, Transaction } from '../../db';
import { first } from '../../common/sql';
import { guard } from '../../common/errors';
import { SendMessageInput } from './schemas';

export async function lockUser(tx: Transaction, actor: string) {
  const user = await first<{ is_active: boolean }>(
    tx,
    Prisma.sql`SELECT is_active FROM users WHERE id = ${actor} FOR NO KEY UPDATE`,
  );
  guard(user.is_active, 401, 'ACCOUNT_INACTIVE', 'Account is inactive');
}

export async function findUserConversations(tx: Transaction | typeof db, userId: string) {
  return tx.conversations.findMany({
    where: {
      is_active: true,
      OR: [{ student_profile: { user_id: userId } }, { tutor_profile: { user_id: userId } }],
    },
    include: {
      student_profile: {
        select: { id: true, first_name: true, last_name: true, user_id: true },
      },
      tutor_profile: {
        select: { id: true, first_name: true, last_name: true, user_id: true },
      },
      messages: {
        where: { is_active: true },
        take: 1,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          content: true,
          message_type: true,
          is_read: true,
          sender_id: true,
          created_at: true,
        },
      },
    },
    orderBy: [{ last_message_at: 'desc' }, { created_at: 'desc' }],
  });
}

export async function findExistingConversation(
  tx: Transaction | typeof db,
  studentId: string,
  tutorId: string,
) {
  return tx.conversations.findFirst({
    where: {
      student_id: studentId,
      tutor_id: tutorId,
      is_active: true,
    },
  });
}

export async function createConversation(
  tx: Transaction,
  id: string,
  studentId: string,
  tutorId: string,
  bookingId: string | null | undefined,
  actor: string,
) {
  return tx.conversations.create({
    data: {
      id,
      student_id: studentId,
      tutor_id: tutorId,
      booking_id: bookingId ?? null,
      created_by: actor,
    },
  });
}

export async function findMessagesByConversationId(
  tx: Transaction | typeof db,
  conversationId: string,
  cursor?: string,
  limit: number = 20,
) {
  return tx.messages.findMany({
    where: { conversation_id: conversationId, is_active: true },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { created_at: 'desc' },
    include: {
      sender: { select: { id: true, email: true } },
      file: true,
    },
  });
}

export async function createMessage(
  tx: Transaction,
  msgId: string,
  conversationId: string,
  senderId: string,
  input: SendMessageInput,
) {
  const message = await tx.messages.create({
    data: {
      id: msgId,
      conversation_id: conversationId,
      sender_id: senderId,
      content: input.content ?? null,
      message_type: input.message_type,
      file_id: input.file_id ?? null,
      thumbnail_file_id: input.thumbnail_file_id ?? null,
      created_by: senderId,
    },
    include: {
      sender: { select: { id: true, email: true } },
      file: true,
    },
  });

  await tx.conversations.update({
    where: { id: conversationId },
    data: { last_message_at: new Date() },
  });

  return message;
}

export async function markMessagesAsRead(tx: Transaction, conversationId: string, userId: string) {
  return tx.messages.updateMany({
    where: {
      conversation_id: conversationId,
      sender_id: { not: userId },
      is_read: false,
    },
    data: { is_read: true },
  });
}

export async function softDeleteMessage(tx: Transaction, messageId: string, senderId: string) {
  return tx.messages.updateMany({
    where: { id: messageId, sender_id: senderId, is_active: true },
    data: { is_active: false, updated_by: senderId, updated_at: new Date() },
  });
}

export async function findConversationById(tx: Transaction | typeof db, conversationId: string) {
  return tx.conversations.findUnique({
    where: { id: conversationId },
    include: {
      student_profile: { select: { user_id: true } },
      tutor_profile: { select: { user_id: true } },
    },
  });
}
