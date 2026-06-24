// src/attachments/attachments.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helper: turn stored relative path into a full URL ────────────
  // The DB column "fileUrl" actually stores a relative path: /uploads/abc.jpg
  
  buildFileUrl(req: Request, relativePath: string): string {
    return `${req.protocol}://${req.get('host')}${relativePath}`;
  }

  // ─── GET /api/attachments/:id ──────────────────────────────────────
  async findOne(attachmentId: string, userId: string, req: Request) {
    // Step 1: Find attachment — join through message to get conversationId
    // Attachment → Message → conversationId (no direct FK to conversation)
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          select: { conversationId: true },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with id ${attachmentId} not found`);
    }

    // Step 2: Authorization — user must be a member of the conversation
    const conversationId = attachment.message.conversationId;

    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
    });

    if (!member) {
      throw new ForbiddenException('You do not have access to this attachment');
    }

    this.logger.log(`Attachment ${attachmentId} accessed by user ${userId}`);

    // Step 3: Shape the response
    // - Drop the internal `message` join (not useful to the caller)
    // - Replace the stored relative path with a full URL
    const { message: _msg, fileUrl: relativePath, ...rest } = attachment;

    return {
      ...rest,
      fileUrl: this.buildFileUrl(req, relativePath),
    };
  }
}