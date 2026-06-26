import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { diskStorageConfig, fileTypeFilter, MAX_FILE_SIZE } from '../common/utils/file-upload.utils';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { RoleName } from '@prisma/client';

@ApiTags('Conversations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  // ─── Create Conversation ──────────────────────────────────────────
  // CUSTOMER không được tạo conversation — chỉ ADMIN và STAFF
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Create a new conversation (ADMIN, STAFF only)' })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  @ApiResponse({ status: 403, description: 'CUSTOMER role cannot create conversations' })
  async create(@Body() dto: CreateConversationDto, @Request() req) {
    return this.conversationsService.create(dto, req.user.id);
  }

  // ─── List Conversations ───────────────────────────────────────────
  // ADMIN: thấy tất cả
  // STAFF & CUSTOMER: chỉ thấy conversations họ là member
  // userRole được extract từ req.user (đã được JwtStrategy attach)
  @Get()
  @ApiOperation({ summary: 'Get conversations — ADMIN sees all, STAFF/CUSTOMER sees own' })
  async findAll(@Query() query: QueryConversationDto, @Request() req) {
    // req.user.userRoles được JwtStrategy.validate() trả về — xem jwt.strategy.ts
    const userRole = req.user.userRoles?.[0]?.role?.name as RoleName ?? RoleName.STAFF;
    return this.conversationsService.findAll(req.user.id, userRole, query);
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

  // ─── Assignment & Status (Challenge 6) ───────────────────────────
  @Post(':id/pending')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @ApiOperation({ summary: 'Set a conversation to pending' })
  @ApiResponse({ status: 200, description: 'Conversation set to pending' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  async pending(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
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
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
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

  // ─── Message with Attachment (Challenge 8) ────────────────────────
  @Post(':id/messages/with-attachment')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorageConfig,
      fileFilter: fileTypeFilter,
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Send a message with a file attachment' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'content'],
      properties: {
        file: { type: 'string', format: 'binary' },
        content: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Message with attachment created' })
  @ApiResponse({ status: 400, description: 'Invalid file type or missing file' })
  @ApiResponse({ status: 403, description: 'Not a member of this conversation' })
  @ApiResponse({ status: 413, description: 'File too large' })
  async createMessageWithAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('content') content: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    return this.conversationsService.createMessageWithAttachment(
      id,
      content,
      file,
      req.user.id,
      req,
    );
  }
}