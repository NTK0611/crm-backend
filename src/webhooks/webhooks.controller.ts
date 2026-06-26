import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WebhooksService } from './webhooks.service';
import { ReceiveWebhookDto } from './dto/receive-webhook.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  // ─── POST /api/webhooks/messages ──────────────────────────────────
  // Intentionally PUBLIC — no JwtAuthGuard
  // External systems (Facebook, Zalo) call this, they have no JWT
  // Rate limit 30/60s để chống spam từ bên ngoài
  @Post('messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Receive incoming webhook event (public)' })
  @ApiResponse({ status: 201, description: 'Webhook event received' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async receive(@Body() dto: ReceiveWebhookDto) {
    const event = await this.webhooksService.receive(dto);
    return { data: event };
  }

  // ─── GET /api/webhooks/events ─────────────────────────────────────
  // ADMIN-only — chỉ admin mới được inspect webhook logs để debug
  // JwtAuthGuard → xác thực token
  // RolesGuard → kiểm tra role ADMIN
  @Get('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all webhook events for debugging (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Webhook events retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  async findAll() {
    const events = await this.webhooksService.findAll();
    return { data: events };
  }
}