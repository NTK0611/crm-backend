import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Conversations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  async create(@Body() dto: CreateConversationDto, @Request() req) {
    return this.conversationsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all conversations for current user' })
  async findAll(@Request() req) {
    return this.conversationsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one conversation by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.conversationsService.findOne(id, req.user.id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  async createMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMessageDto,
    @Request() req,
  ) {
    return this.conversationsService.createMessage(id, dto, req.user.id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get all messages in a conversation' })
  async findMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.conversationsService.findMessages(id, req.user.id);
  }
}