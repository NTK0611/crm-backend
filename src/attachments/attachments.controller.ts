
import {
  Controller,
  Get,
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
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Attachments')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get attachment metadata by ID' })
  @ApiResponse({ status: 200, description: 'Attachment found' })
  @ApiResponse({ status: 403, description: 'Not a member of this conversation' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ) {
    return this.attachmentsService.findOne(id, req.user.id, req);
  }
}