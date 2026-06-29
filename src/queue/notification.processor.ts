import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';
import { NotificationJobData } from './notification.producer';

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing job ${job.id} — name: ${job.name} — attempt: ${job.attemptsMade + 1}`,
    );

    switch (job.name) {
      case JOB_NAMES.SEND_NOTIFICATION:
        await this.handleSendNotification(job.data as NotificationJobData);
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleSendNotification(data: NotificationJobData): Promise<void> {
    const { messageId, conversationId, senderId, content } = data;

    const members = await this.prisma.conversationMember.findMany({
      where: {
        conversationId,
        userId: { not: senderId },
      },
      select: { userId: true },
    });

    if (members.length === 0) {
      this.logger.log(`No members to notify for conversation ${conversationId}`);
      return;
    }

    // skipDuplicates: true prevents duplicate rows if this job retries
    // after a partial insert. Prisma will skip any row that violates
    // a unique constraint instead of throwing.
    // The unique constraint needed: @@unique([userId, referenceId]) in schema
    await this.prisma.notification.createMany({
      data: members.map((member) => ({
        userId: member.userId,
        type: 'NEW_MESSAGE',
        content: content.length > 100 ? content.slice(0, 100) + '...' : content,
        referenceId: messageId,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Notifications created for ${members.length} members — message ${messageId}`,
    );
  }
}