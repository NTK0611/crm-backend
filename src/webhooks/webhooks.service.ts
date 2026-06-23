import {
  Injectable,
  Logger,
 
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiveWebhookDto } from './dto/receive-webhook.dto';
import { WebhookStatus } from '@prisma/client';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Receive Webhook ───────────────────────────────────────────────
  
  // This is called when an external system POSTs to /api/webhooks/messages
  
  // Flow:
  // 1. Check if eventId already exists in DB (idempotency check)
  // 2. If yes → return early, do not process again
  // 3. If no → store the event with status RECEIVED
  // 4. Process the payload (currently just logs — real processing comes later)
  // 5. Update status to PROCESSED with processedAt timestamp
  //
  // If processing fails → status stays RECEIVED or gets set to FAILED
  

  async receive(dto: ReceiveWebhookDto) {
    // ─── Idempotency Check ─────────────────────────────────────────
    // Check if we already processed this eventId before
    
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId: dto.eventId },
    });

    if (existing) {
      this.logger.warn(
        `Duplicate webhook received — eventId: ${dto.eventId} already exists, skipping`,
      );
      // Return the existing record instead of throwing an error
      // The external system gets a 200 OK so it stops retrying
      // but we don't process it again
      return existing;
    }

    // ─── Store the event ───────────────────────────────────────────
    // Save with status RECEIVED first — before any processing
    // This guarantees we have a record even if processing crashes
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        eventId: dto.eventId,
        source: dto.source,
        payload: dto.payload,
        status: WebhookStatus.RECEIVED,
      },
    });

    this.logger.log(
      `Webhook received — eventId: ${dto.eventId}, source: ${dto.source}`,
    );

    // ─── Process the payload ───────────────────────────────────────
    // Wrapped in try/catch so a processing failure does not crash
    // the entire request — we still return 200 to the sender
    // but mark the event as FAILED for later inspection/retry
    try {
      
      // For now we just log the payload to confirm receipt
      this.logger.log(
        `Processing webhook payload: ${JSON.stringify(dto.payload)}`,
      );

      // ─── Mark as PROCESSED ─────────────────────────────────────
      const processed = await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: WebhookStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      return processed;
    } catch (error) {
      // ─── Mark as FAILED ────────────────────────────────────────
      // Processing failed — update status so we can find and retry later
      this.logger.error(
        `Failed to process webhook eventId: ${dto.eventId} — ${error instanceof Error ? error.message : String(error)}`,
       );

      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { status: WebhookStatus.FAILED },
      });

      // Re-throw so the caller knows something went wrong
      throw error;
    }
  }

  // ─── Get Webhook Events ────────────────────────────────────────────
  //
  // Returns all stored webhook events for debugging/inspection
  // In a real system this would have pagination and status filtering
  // For Challenge 7 scope, returning all ordered by newest first is fine

  async findAll() {
    const events = await this.prisma.webhookEvent.findMany({
      orderBy: { receivedAt: 'desc' },
    });

    this.logger.log(`Fetched ${events.length} webhook event(s)`);

    return events;
  }
}