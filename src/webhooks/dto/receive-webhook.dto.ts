import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReceiveWebhookDto {
  // eventId is the idempotency key.
  // The sender includes this in every webhook payload.
  // If we receive the same eventId twice, we skip processing the second one.
  // This prevents duplicate data if the sender retries a failed delivery.
  @ApiProperty({ description: 'Unique event identifier for idempotency' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  // source identifies which system sent this webhook
  // e.g. "facebook", "zalo", "website-chat"
  @ApiProperty({ description: 'Source system that sent the webhook' })
  @IsString()
  @IsNotEmpty()
  source: string;

  // payload is the actual data from the external system
  // We type it as Record<string, any> because different sources
  // send different payload shapes — we store it as JSON in the DB
  // and process it as needed
  @ApiProperty({ description: 'Webhook payload data' })
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;
}