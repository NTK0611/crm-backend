import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { AssignConversationDto } from './dto/assign-conversation.dto';
import { SenderType, RoleName } from '@prisma/client';
import { validateTransition } from './validate-transition';
import { AttachmentsService } from '../attachments/attachments.service';
import { Request } from 'express';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { NotificationProducer } from '../queue/notification.producer';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentsService: AttachmentsService,
    private readonly notificationProducer: NotificationProducer,
  ) {}

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

  async findAll(userId: string, userRole: RoleName, query: QueryConversationDto) {
    const { status, assignedTo, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // ADMIN sees all conversations — no membership filter
    // STAFF and CUSTOMER only see conversations they are a member of
    const membershipFilter =
      userRole === RoleName.ADMIN
        ? {}
        : {
            conversationMembers: {
              some: { userId },
            },
          };

    const where: any = {
      ...membershipFilter,
      ...(status && { status }),
      ...(assignedTo && {
        assignments: {
          some: {
            assignedToId: assignedTo,
            unassignedAt: null,
          },
        },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.conversation.count({ where }),
    ]);

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

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: {
          select: { role: { select: { name: true } } },
        },
      },
    });

    const callerRoles = currentUser?.userRoles.map((ur) => ur.role.name) ?? [];
    const isAdmin = callerRoles.includes(RoleName.ADMIN);
    const isStaff = callerRoles.includes(RoleName.STAFF);

    if (isStaff && !isAdmin && dto.assignedTo !== userId) {
      throw new ForbiddenException('STAFF members can only self-assign conversations');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.assignedTo },
      select: {
        id: true,
        isActive: true,
        userRoles: {
          select: { role: { select: { name: true } } },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with id ${dto.assignedTo} not found`);
    }

    if (!targetUser.isActive) {
      throw new ForbiddenException(`User with id ${dto.assignedTo} is not active`);
    }

    const targetRoles = targetUser.userRoles.map((ur) => ur.role.name);
    const targetIsStaffOrAdmin =
      targetRoles.includes(RoleName.STAFF) || targetRoles.includes(RoleName.ADMIN);

    if (!targetIsStaffOrAdmin) {
      throw new ForbiddenException(
        `User with id ${dto.assignedTo} does not have STAFF or ADMIN role`,
      );
    }

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

      await tx.conversationMember.upsert({
        where: {
          conversationId_userId: {
            conversationId,
            userId: dto.assignedTo,
          },
        },
        update: {},
        create: {
          conversationId,
          userId: dto.assignedTo,
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
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const newStatus = validateTransition(conversation.status, 'pending');

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
          meta: { reason: 'No staff available' },
        },
      });

      return updated;
    });

    this.logger.log(`Conversation ${conversationId} set to PENDING by ${userId}`);

    return updatedConversation;
  }

  async unassign(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });

    const roles = currentUser?.userRoles.map((ur) => ur.role.name) ?? [];
    const isAdmin = roles.includes(RoleName.ADMIN);

    if (!isAdmin) {
      const activeAssignment = await this.prisma.assignment.findFirst({
        where: { conversationId, unassignedAt: null },
        orderBy: { assignedAt: 'desc' },
      });

      if (!activeAssignment || activeAssignment.assignedToId !== userId) {
        throw new ForbiddenException(
          'STAFF can only unassign conversations assigned to themselves',
        );
      }
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

    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: { select: { role: { select: { name: true } } } },
      },
    });

    const roles = currentUser?.userRoles.map((ur) => ur.role.name) ?? [];
    const isAdmin = roles.includes(RoleName.ADMIN);

    if (!isAdmin) {
      const activeAssignment = await this.prisma.assignment.findFirst({
        where: { conversationId, unassignedAt: null },
        orderBy: { assignedAt: 'desc' },
      });

      if (!activeAssignment || activeAssignment.assignedToId !== userId) {
        throw new ForbiddenException(
          'STAFF can only close conversations assigned to themselves',
        );
      }
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

    await this.notificationProducer.dispatchSendNotification({
      messageId: message.id,
      conversationId,
      senderId: userId,
      content: dto.content,
    });

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

  // ─── Message with Attachment ───────────────────────────────────────

  async createMessageWithAttachment(
    conversationId: string,
    content: string,
    file: Express.Multer.File,
    userId: string,
    req: Request,
  ) {
    await this.checkMembership(conversationId, userId);

    if (!file) {
      throw new BadRequestException('File is required');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          senderType: SenderType.USER,
          content,
        },
      });

      const relativePath = `/uploads/${file.filename}`;

      const attachment = await tx.attachment.create({
        data: {
          messageId: message.id,
          fileName: file.originalname,
          fileUrl: relativePath,
          fileType: file.mimetype,
          fileSize: file.size,
        },
      });

      return { message, attachment };
    });

    await this.notificationProducer.dispatchSendNotification({
      messageId: result.message.id,
      conversationId,
      senderId: userId,
      content,
    });

    this.logger.log(
      `Message with attachment created in conversation ${conversationId} by user ${userId}`,
    );

    const { fileUrl: relativePath, ...attachmentRest } = result.attachment;

    return {
      messageRecord: result.message,
      attachment: {
        ...attachmentRest,
        fileUrl: this.attachmentsService.buildFileUrl(req, relativePath),
      },
    };
  }
}