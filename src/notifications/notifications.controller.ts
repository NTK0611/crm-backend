import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

// All notification endpoints require a valid JWT token
// There is no public notification endpoint — you must be logged in
@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── GET /api/notifications ────────────────────────────────────────
  //
  // Returns notifications for the logged-in user only.
  // The userId comes from req.user (JWT payload) — NOT from a query param.
  // This prevents a user from passing someone else's userId to see their
  // notifications.
  //
  // Optional query: ?isRead=true or ?isRead=false

  @ApiOperation({ summary: 'Get my notifications' })
  @Get()
  async findAll(@Request() req, @Query() query: QueryNotificationDto) {
    const notifications = await this.notificationsService.findAll(
      req.user.id,
      query,
    );
    return { data: notifications };
  }

  // ─── POST /api/notifications/:id/read ─────────────────────────────
  //
  // Marks a single notification as read.
  // The service layer checks ownership — a user cannot mark another
  // user's notification as read even if they know the UUID.

  @ApiOperation({ summary: 'Mark a notification as read' })
  @Post(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    const notification = await this.notificationsService.markAsRead(
      id,
      req.user.id,
    );
    return { data: notification };
  }
}