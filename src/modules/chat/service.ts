import { db, transaction, Transaction } from '../../db';
import { guard } from '../../common/errors';
import { newId } from '../../common/ids';
import { ownFile } from '../../common/files';
import { ownProfile } from '../profiles/repository';
import * as repo from './repository';
import * as schemas from './schemas';

export async function getUserConversations(actor: string) {
  return repo.findUserConversations(db, actor);
}

export async function openOrCreateConversation(
  actor: string,
  input: schemas.CreateConversationInput,
) {
  return transaction(actor, async (tx) => {
    await repo.lockUser(tx, actor);

    const studentProfile = await ownProfile(tx, 'student_profiles', actor);
    guard(
      Boolean(studentProfile),
      400,
      'STUDENT_PROFILE_REQUIRED',
      'Student profile is required to open a conversation',
    );

    const studentId = studentProfile.id;

    let conversation = await repo.findExistingConversation(tx, studentId, input.tutor_id);
    if (!conversation) {
      const id = newId('cnv');
      conversation = await repo.createConversation(
        tx,
        id,
        studentId,
        input.tutor_id,
        input.booking_id,
        actor,
      );
    }
    return conversation;
  });
}

export async function getConversationMessages(
  actor: string,
  conversationId: string,
  query: schemas.GetMessagesQueryInput,
) {
  await verifyAccess(db, conversationId, actor);

  const rawMessages = await repo.findMessagesByConversationId(
    db,
    conversationId,
    query.cursor,
    query.limit,
  );

  let nextCursor: string | undefined = undefined;
  if (rawMessages.length > query.limit) {
    const nextItem = rawMessages.pop();
    nextCursor = nextItem?.id;
  }

  return {
    messages: rawMessages,
    next_cursor: nextCursor,
  };
}

export async function sendMessage(
  actor: string,
  conversationId: string,
  input: schemas.SendMessageInput,
) {
  return transaction(actor, async (tx) => {
    await repo.lockUser(tx, actor);
    await verifyAccess(tx, conversationId, actor);

    if (input.file_id) {
      await ownFile(tx, input.file_id, actor, ['CHAT_MEDIA']);
    }
    if (input.thumbnail_file_id) {
      await ownFile(tx, input.thumbnail_file_id, actor, ['CHAT_MEDIA']);
    }

    const msgId = newId('msg');
    return repo.createMessage(tx, msgId, conversationId, actor, input);
  });
}

export async function markAsRead(actor: string, conversationId: string) {
  return transaction(actor, async (tx) => {
    await repo.lockUser(tx, actor);
    await verifyAccess(tx, conversationId, actor);
    await repo.markMessagesAsRead(tx, conversationId, actor);
    return { success: true };
  });
}

export async function unsendMessage(actor: string, messageId: string) {
  return transaction(actor, async (tx) => {
    await repo.lockUser(tx, actor);
    const updated = await repo.softDeleteMessage(tx, messageId, actor);
    guard(updated.count > 0, 404, 'NOT_FOUND', 'Message not found or already deleted');
  });
}

async function verifyAccess(tx: Transaction | typeof db, conversationId: string, actor: string) {
  const conversation = await repo.findConversationById(tx, conversationId);
  guard(
    Boolean(conversation && conversation.is_active),
    404,
    'NOT_FOUND',
    'Conversation not found',
  );

  const isStudent = conversation?.student_profile?.user_id === actor;
  const isTutor = conversation?.tutor_profile?.user_id === actor;

  guard(Boolean(isStudent || isTutor), 403, 'FORBIDDEN', 'Access to conversation forbidden');

  return conversation!;
}
