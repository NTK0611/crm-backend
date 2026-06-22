import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { SenderType } from '@prisma/client';
import { validateTransition } from './validate-transition';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Private Helper ───────────────────────────────────────────────

  public async checkMembership(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with id ${conversationId} not found`);
    }

    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this conversation');
    }
  }

  // ─── Conversations ────────────────────────────────────────────────

  async create(dto: CreateConversationDto, userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id ${dto.customerId} not found`);
    }

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
    await this.checkMembership(id, userId);

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

    return conversation;
  }

  // ─── Assignment & Status ───────────────────────────────────────────

  async assign(conversationId: string, dto: AssignConversationDto, userId: string) {
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new NotFoundException('Conversation not found');
  }

  // ─── Role-based assignment restriction ────────────────────────────
  // Fetch the current user's roles to enforce the business rule:
  // - ADMIN can assign to anyone (dto.assignedTo can be any user id)
  // - STAFF can only self-assign (dto.assignedTo must equal their own id)
  // This check happens AFTER the conversation existence check but BEFORE
  // the transition validation — no point validating the transition if the
  // user isn't even allowed to assign at all.
  const currentUser = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      userRoles: {
        select: { role: { select: { name: true } } },
      },
    },
  });

  const roles = currentUser?.userRoles.map((ur) => ur.role.name) ?? [];
  const isAdmin = roles.includes('ADMIN');
  const isStaff = roles.includes('STAFF');

  if (isStaff && !isAdmin && dto.assignedTo !== userId) {
    // STAFF trying to assign to someone else — block it
    throw new ForbiddenException(
      'STAFF members can only self-assign conversations',
    );
  }

  // ─── Validate status transition ────────────────────────────────────
  // Only runs if the role check above passed.
  // Throws 409 if current status is not in ALLOWED_TRANSITIONS['assign']
  const newStatus = validateTransition(conversation.status, 'assign');

  const updatedConversation = await this.prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: { status: newStatus },
    });

    await tx.assignment.create({
      data: {
        conversationId,
        assignedToId: dto.assignedTo,
        assignedById: userId,
      },
    });

    await tx.activityLog.create({
      data: {
        conversationId,
        userId,
        action: 'CONVERSATION_ASSIGNED',
        meta: { assignedTo: dto.assignedTo },
      },
    });

    return updated;
  });

  this.logger.log(
    `Conversation ${conversationId} assigned to ${dto.assignedTo} by ${userId}`,
  );

  return updatedConversation;
}

  async pending(conversationId: string, userId: string) {
  // Step 1: Check the conversation exists
  const conversation = await this.prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new NotFoundException('Conversation not found');
  }

  // Step 2: Validate the transition (only OPEN → PENDING is allowed)
  // validateTransition() throws 409 automatically if the current status
  // is not in ALLOWED_TRANSITIONS['pending'] = [OPEN]
  const newStatus = validateTransition(conversation.status, 'pending');

  // Step 3: Update status + write activity log in one transaction
  // Both writes must succeed or fail together — if the log fails,
  // we don't want the status update to persist either
  const updatedConversation = await this.prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.update({
      where: { id: conversationId },
      data: { status: newStatus },
    });

    await tx.activityLog.create({
      data: {
        conversationId,
        userId,
        action: 'CONVERSATION_PENDING',
        // meta records WHY it was set to pending — useful for debugging
        meta: { reason: 'No staff available' },
      },
    });

    return updated;
  });

  this.logger.log(
    `Conversation ${conversationId} set to PENDING by ${userId}`,
  );

  return updatedConversation;
}

  async unassign(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const newStatus = validateTransition(conversation.status, 'unassign');

    const updatedConversation = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.update({
        where: { id: conversationId },
        data: { status: newStatus },
      });

      const activeAssignment = await tx.assignment.findFirst({
        where: { conversationId, unassignedAt: null },
        orderBy: { assignedAt: 'desc' },
      });

      if (activeAssignment) {
        await tx.assignment.update({
          where: { id: activeAssignment.id },
          data: { unassignedAt: new Date() },
        });
      }

      await tx.activityLog.create({
        data: {
          conversationId,
          userId,
          action: 'CONVERSATION_UNASSIGNED',
          meta: { previouslyAssignedTo: activeAssignment?.assignedToId ?? null },
        },
      });

      return updated;
    });

    this.logger.log(`Conversation ${conversationId} unassigned by ${userId}`);

    return updatedConversation;
  }

  async close(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const newStatus = validateTransition(conversation.status, 'close');

    const updatedConversation = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.update({
        where: { id: conversationId },
        data: { status: newStatus },
      });

      await tx.activityLog.create({
        data: {
          conversationId,
          userId,
          action: 'CONVERSATION_CLOSED',
          meta: undefined,
        },
      });

      return updated;
    });

    this.logger.log(`Conversation ${conversationId} closed by ${userId}`);

    return updatedConversation;
  }

  async reopen(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const newStatus = validateTransition(conversation.status, 'reopen');

    const updatedConversation = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.conversation.update({
        where: { id: conversationId },
        data: { status: newStatus },
      });

      await tx.activityLog.create({
        data: {
          conversationId,
          userId,
          action: 'CONVERSATION_REOPENED',
          meta: undefined,
        },
      });

      return updated;
    });

    this.logger.log(`Conversation ${conversationId} reopened by ${userId}`);

    return updatedConversation;
  }

  // ─── Messages ─────────────────────────────────────────────────────

  async createMessage(conversationId: string, dto: CreateMessageDto, userId: string) {
    await this.checkMembership(conversationId, userId);

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
    await this.checkMembership(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sentAt: 'asc' },
    });

    return messages;
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        userRoles: {
          select: { role: { select: { name: true } } },
        },
      },
    });
  }
}