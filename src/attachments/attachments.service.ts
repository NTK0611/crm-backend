import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ─── Upload buffer to Cloudinary ──────────────────────────────────
  // Called by ConversationsService when creating a message with attachment.
  // Returns the secure Cloudinary URL to store in DB.
  async uploadFile(file: Express.Multer.File): Promise<string> {
    const result = await this.cloudinaryService.uploadBuffer(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    // result.secure_url is the permanent HTTPS URL Cloudinary gives us.
    // This is what we store in the database as fileUrl.
    return result.secure_url;
  }

  // ─── GET /api/attachments/:id ──────────────────────────────────────
  async findOne(attachmentId: string, userId: string) {
    // Step 1: Find attachment — join through message to get conversationId
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          select: { conversationId: true },
        },
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
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

    // Step 3: Shape the response — drop the internal message join
    // fileUrl now contains the full Cloudinary URL directly from DB,
    // no need to build it from request like before
    const { message: _msg, ...rest } = attachment;
    return rest;
  }
}