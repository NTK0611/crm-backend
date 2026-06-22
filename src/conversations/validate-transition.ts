import { ConflictException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { ALLOWED_TRANSITIONS } from './allowed-transitions';
import { RESULTING_STATUS } from './resulting-status';

export function validateTransition(
  currentStatus: ConversationStatus,
  action: string,
): ConversationStatus {
  const allowedStatuses = ALLOWED_TRANSITIONS[action];

  if (!allowedStatuses) {
    throw new ConflictException(`Unknown conversation action: ${action}`);
  }

  const isAllowed = allowedStatuses.includes(currentStatus);

  if (!isAllowed) {
    throw new ConflictException(
      `Cannot ${action} a conversation with status ${currentStatus}`,
    );
  }

  return RESULTING_STATUS[action];
}