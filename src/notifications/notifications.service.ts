import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Create Notification (called internally, not from controller) ──
  
  // This method is NOT an endpoint. It is called by ConversationsService
  // when a new message is sent. We create one notification row per
  // recipient — each member of the conversation except the sender.
  
  // Why a loop instead of createMany?
  // createMany in Prisma does not return the created records, which makes
  // it harder to log or debug. For notification volume at this scale,
  // individual creates inside a transaction is fine.

  async createForMessage(
    conversationId: string,
    senderId: string,
    messageId: string,
    content: string,
  ): Promise<void> {
    // Get all members of this conversation except the sender
    const members = await this.prisma.conversationMember.findMany({
      where: {
        conversationId,
        userId: { not: senderId }, // exclude the sender
      },
      select: { userId: true },
    });

    if (members.length === 0) {
      this.logger.log(
        `No recipients to notify for message ${messageId} in conversation ${conversationId}`,
      );
      return;
    }

    // Create one notification per recipient in a single transaction
    // If any insert fails, all fail — no partial notification state
    await this.prisma.$transaction(
      members.map((member) =>
        this.prisma.notification.create({
          data: {
            userId: member.userId,
            type: 'NEW_MESSAGE',
            content,
            referenceId: messageId, // lets the client navigate to the message
          },
        }),
      ),
    );

    this.logger.log(
      `Created ${members.length} notification(s) for message ${messageId}`,
    );
  }

  // ─── Get My Notifications ──────────────────────────────────────────
  //
  // Returns notifications belonging to the logged-in user only.
  // Optional filter by isRead status via query param.
  // Ordered newest first — most relevant notifications at the top.

  async findAll(userId: string, query: QueryNotificationDto) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        // Only add isRead filter if it was explicitly provided
        // If omitted, return both read and unread
        ...(query.isRead !== undefined && { isRead: query.isRead }),
      },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(
      `Fetched ${notifications.length} notification(s) for user ${userId}`,
    );

    return notifications;
  }

  // ─── Mark As Read ──────────────────────────────────────────────────
  //
  // Two checks before updating:
  // 1. Does the notification exist?
  // 2. Does it belong to the requesting user?
  //    A user must not be able to mark another user's notification as read
  //    by guessing the UUID — that would be an IDOR vulnerability.

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with id ${notificationId} not found`,
      );
    }

    // Ownership check — prevents IDOR
    if (notification.userId !== userId) {
      throw new NotFoundException(
        `Notification with id ${notificationId} not found`,
      );
      
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    this.logger.log(
      `Notification ${notificationId} marked as read by user ${userId}`,
    );

    return updated;
  }
}