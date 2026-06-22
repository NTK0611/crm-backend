import { ConversationStatus } from '@prisma/client';

// Maps each action to the list of statuses it is allowed to run from.
// If the current conversation status is NOT in this list, validateTransition()
// will throw a 409 ConflictException before any DB write happens.
export const ALLOWED_TRANSITIONS: Record<string, ConversationStatus[]> = {
  pending:  [ConversationStatus.OPEN],
  assign:   [ConversationStatus.OPEN, ConversationStatus.PENDING],
  unassign: [ConversationStatus.ASSIGNED],
  close:    [ConversationStatus.ASSIGNED],
  reopen:   [ConversationStatus.CLOSED],
};