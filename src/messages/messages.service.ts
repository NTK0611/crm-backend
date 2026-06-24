import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMessageDto } from './dto/query-message.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryMessageDto, userId: string) {
    const { conversationId, keyword, page = 1, limit = 10 } = query;

    // Step 1: conversationId is functionally required
    if (!conversationId) {
      throw new BadRequestException('conversationId is required');
    }

    // Step 2: Check conversation exists
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with id ${conversationId} not found`,
      );
    }

    // Step 3: Check the requesting user is a member of this conversation
    
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'You are not a member of this conversation',
      );
    }

    // Step 4: Build where clause
    const where: any = {
      conversationId,
      
      ...(keyword && {
        content: {
          contains: keyword,
          mode: 'insensitive',
        },
      }),
    };

    const skip = (page - 1) * limit;

    // Step 5: Paginated query — same $transaction pattern as customers + conversations
    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'asc' }, // messages ordered oldest first — chronological
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          senderType: true,
          content: true,
          sentAt: true,
          // include attachment if exists — useful for the client
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
              fileSize: true,
              fileUrl: true,
            },
          },
        },
      }),
      this.prisma.message.count({ where }),
    ]);

    this.logger.log(
      `Messages fetched for conversation ${conversationId} by user ${userId} — page ${page}`,
    );

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}