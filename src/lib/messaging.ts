import { db } from "./db";
import { getSettings } from "./settings";
import { replyToComment, sendInstagramMessage } from "./meta";
import { UserError } from "./errors";

/** Sends an Instagram DM (demo mode only records it locally) and stores it on the conversation. */
export async function sendDirectMessage(conversationId: string, text: string) {
  const convo = await db.conversation.findUnique({ where: { id: conversationId }, include: { contact: true } });
  if (!convo) throw new UserError("Conversation not found", 404);
  const settings = await getSettings();
  if (!settings.demoMode) {
    if (!convo.contact.igUserId) throw new UserError("This contact has no Instagram ID to message");
    await sendInstagramMessage(convo.contact.igUserId, text);
  }
  const msg = await db.message.create({ data: { conversationId, direction: "OUT", text } });
  await db.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.sentAt, unread: 0 } });
  return msg;
}

/** Replies publicly to an Instagram comment (demo mode only marks it handled) and marks it handled. */
export async function replyToCommentById(commentId: string, text: string) {
  const c = await db.comment.findUnique({ where: { id: commentId } });
  if (!c) throw new UserError("Comment not found", 404);
  const settings = await getSettings();
  if (!settings.demoMode) {
    if (!c.externalId) throw new UserError("This comment has no Instagram ID");
    await replyToComment(c.externalId, text);
  }
  await db.comment.update({ where: { id: commentId }, data: { handled: true } });
}
