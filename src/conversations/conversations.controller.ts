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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

  // ─── Assignment & Status (Challenge 6) ──────────────────────────────
  @Post(':id/pending')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Set a conversation to pending (no staff available)' })
  @ApiResponse({ status: 200, description: 'Conversation set to pending' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  async pending(
  @Param('id', ParseUUIDPipe) id: string,
  @Request() req,
  ) {
  const data = await this.conversationsService.pending(id, req.user.id);
  return { message: 'Conversation set to pending successfully', data };
  }


  @Post(':id/assign')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Assign a conversation to a staff member' })
  @ApiResponse({ status: 200, description: 'Conversation assigned' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' }
  )
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignConversationDto,
    @Request() req,
  ) {
    const data = await this.conversationsService.assign(id, dto, req.user.id);
    return { message: 'Conversation assigned successfully', data };
  }

  @Post(':id/unassign')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Unassign a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation unassigned' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  async unassign(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const data = await this.conversationsService.unassign(id, req.user.id);
    return { message: 'Conversation unassigned successfully', data };
  }

  @Post(':id/close')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Close a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation closed' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  async close(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const data = await this.conversationsService.close(id, req.user.id);
    return { message: 'Conversation closed successfully', data };
  }

  @Post(':id/reopen')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Reopen a closed conversation' })
  @ApiResponse({ status: 200, description: 'Conversation reopened' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  async reopen(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const data = await this.conversationsService.reopen(id, req.user.id);
    return { message: 'Conversation reopened successfully', data };
  }
}