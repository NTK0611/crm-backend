import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SenderType } from '@prisma/client';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConversationDto, userId: string) {
    // Check customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id ${dto.customerId} not found`);
    }

    // Create conversation + add creator as member in one transaction
    const conversation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.conversation.create({
        data: {
          customerId: dto.customerId,
          note: dto.note,
        },
      });

      await tx.conversationMember.create({
        data: {
          conversationId: created.id,
          userId,
        },
      });

      return created;
    });

    this.logger.log(`Conversation created: ${conversation.id} by user: ${userId}`);

    return conversation;
  }

  async findAll(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        conversationMembers: {
          some: { userId },
        },
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return conversations;
  }

  async findOne(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
        conversationMembers: {
          select: { userId: true, joinedAt: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with id ${id} not found`);
    }

    // Check membership
    const isMember = conversation.conversationMembers.some(
      (m) => m.userId === userId,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    return conversation;
  }

  async createMessage(conversationId: string, dto: CreateMessageDto, userId: string) {
    // findOne already checks existence + membership
    await this.findOne(conversationId, userId);

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        senderType: SenderType.USER,
        content: dto.content,
      },
    });

    this.logger.log(`Message sent in conversation: ${conversationId} by user: ${userId}`);

    return message;
  }

  async findMessages(conversationId: string, userId: string) {
    // findOne already checks existence + membership
    await this.findOne(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
    });

    return messages;
  }
}