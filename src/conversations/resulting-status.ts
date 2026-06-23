import { ConversationStatus } from '@prisma/client';

// Maps each action to the status the conversation moves INTO after the action.
// This is the single source of truth for what status results from each action.
// validateTransition() reads this after confirming the action is allowed.
export const RESULTING_STATUS: Record<string, ConversationStatus> = {
  pending:  ConversationStatus.PENDING,    // OPEN → PENDING (no staff available)
  assign:   ConversationStatus.ASSIGNED,   // OPEN/PENDING → ASSIGNED
  unassign: ConversationStatus.PENDING,    // ASSIGNED → PENDING (staff removed, still needs help)
  close:    ConversationStatus.CLOSED,     // ASSIGNED → CLOSED (issue resolved)
  reopen:   ConversationStatus.OPEN,       // CLOSED → OPEN (needs attention again)
};