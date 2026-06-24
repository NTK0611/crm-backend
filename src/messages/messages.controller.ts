import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { QueryMessageDto } from './dto/query-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Messages')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Search messages by conversationId and keyword with pagination' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 400, description: 'conversationId is required' })
  @ApiResponse({ status: 403, description: 'Not a member of this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async findAll(@Query() query: QueryMessageDto, @Request() req) {
    const data = await this.messagesService.findAll(query, req.user.id);
    return { message: 'Messages retrieved successfully', data };
  }
}