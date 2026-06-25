import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from './queue.constants';

export interface NotificationJobData {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
}

@Injectable()
export class NotificationProducer {
  private readonly logger = new Logger(NotificationProducer.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
  ) {}

  async dispatchSendNotification(data: NotificationJobData): Promise<void> {
    await this.notificationQueue.add(JOB_NAMES.SEND_NOTIFICATION, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    });

    this.logger.log(
      `Job dispatched: ${JOB_NAMES.SEND_NOTIFICATION} for message ${data.messageId}`,
    );
  }
}