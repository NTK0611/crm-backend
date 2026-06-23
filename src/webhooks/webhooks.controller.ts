import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebhooksService } from './webhooks.service';
import { ReceiveWebhookDto } from './dto/receive-webhook.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // ─── POST /api/webhooks/messages ──────────────────────────────────
  // This endpoint is intentionally PUBLIC — no JwtAuthGuard here.
  // External systems (Facebook, Zalo, etc.) call this endpoint.
  // They don't have a JWT token — they are not your users.
  // In production you would validate a webhook signature instead
  

  @ApiOperation({ summary: 'Receive incoming webhook event' })
  @Post('messages')
  async receive(@Body() dto: ReceiveWebhookDto) {
    const event = await this.webhooksService.receive(dto);
    return { data: event };
  }

  // ─── GET /api/webhooks/events ─────────────────────────────────────
  //
  // This endpoint IS protected — only logged-in staff/admin should be
  // able to inspect stored webhook events for debugging.
  // External systems never call this endpoint.

  @ApiOperation({ summary: 'Get all webhook events for debugging' })
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Get('events')
  async findAll() {
    const events = await this.webhooksService.findAll();
    return { data: events };
  }
}