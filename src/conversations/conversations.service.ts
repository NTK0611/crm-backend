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
import { SenderType } from '@prisma/client';
import { validateTransition } from './validate-transition';
import { NotificationsService } from '../notifications/notifications.service';
import { AttachmentsService } from '../attachments/attachments.service'; 
import { Request } from 'express';
import { QueryConversationDto } from './dto/query-conversation.dto';
@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly attachmentsService: AttachmentsService,
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

async findAll(userId: string, query: QueryConversationDto) {
    const { status, assignedTo, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    
    // Always scoped to conversations the current user is a member of
    const where: any = {
      conversationMembers: {
        some: { userId },
      },
      // Only add status filter if provided
      ...(status && { status }),
      // assignedTo filter — checks the assignments table for an active
      // (unassignedAt: null) assignment to the specified user
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

  // ─── Validate calling user's role ─────────────────────────────────
  const currentUser = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      userRoles: {
        select: { role: { select: { name: true } } },
      },
    },
  });

  const callerRoles = currentUser?.userRoles.map((ur) => ur.role.name) ?? [];
  const isAdmin = callerRoles.includes('ADMIN');
  const isStaff = callerRoles.includes('STAFF');

  if (isStaff && !isAdmin && dto.assignedTo !== userId) {
    throw new ForbiddenException('STAFF members can only self-assign conversations');
  }

  // ─── Validate target user exists, is active, has STAFF or ADMIN role ──
  // This prevents assigning a conversation to a CUSTOMER or a random UUID.
  
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
    targetRoles.includes('STAFF') || targetRoles.includes('ADMIN');

  if (!targetIsStaffOrAdmin) {
    throw new ForbiddenException(
      `User with id ${dto.assignedTo} does not have STAFF or ADMIN role`,
    );
  }

  // ─── Validate status transition ────────────────────────────────────
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

    // ─── Add assigned staff to conversation_members if not already a member ──
   
    await tx.conversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId: dto.assignedTo,
        },
      },
      update: {},  // already a member — do nothing
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

  // ─── STAFF restriction ─────────────────────────────────────────────
  // STAFF can only unassign conversations where they are the active assignee.
  // ADMIN can unassign any conversation.
  const currentUser = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });

  const roles = currentUser?.userRoles.map((ur) => ur.role.name) ?? [];
  const isAdmin = roles.includes('ADMIN');

  if (!isAdmin) {
    // Not an admin — check they are the active assignee
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

  // ─── STAFF restriction ─────────────────────────────────────────────
  // STAFF can only close conversations where they are the active assignee.
  // ADMIN can close any conversation.
  const currentUser = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });

  const roles = currentUser?.userRoles.map((ur) => ur.role.name) ?? [];
  const isAdmin = roles.includes('ADMIN');

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

  // Trigger notifications for all other members of this conversation
    await this.notificationsService.createForMessage(
    conversationId,
    userId,
    message.id,
    `New message in conversation: ${dto.content.substring(0, 50)}`,
    );

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
    // Step 1: Membership check — reuse existing guard
    // If user is not a member, throws 403 before any file is processed
    await this.checkMembership(conversationId, userId);

    // Step 2: Extra safety — file must exist
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Step 3: Single transaction — message + attachment created together
    // If attachment insert fails, message insert is also rolled back.
    
    const result = await this.prisma.$transaction(async (tx) => {
      // 3a: Create the message first — we need its ID for the attachment FK
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          senderType: SenderType.USER,
          content,
        },
      });

      // 3b: Store relative path in fileUrl column
      // We store /uploads/filename, NOT the full URL.
      // Full URL is constructed at response time via buildFileUrl().
      const relativePath = `/uploads/${file.filename}`;

      const attachment = await tx.attachment.create({
        data: {
          messageId: message.id,           // FK — this is why we create message first
          fileName: file.originalname,     // original filename from client
          fileUrl: relativePath,           // relative path, not full URL
          fileType: file.mimetype,         // e.g. "image/jpeg"
          fileSize: file.size,             // bytes
        },
      });

      return { message, attachment };
    });

    // Step 4: Trigger notifications — same as regular createMessage()
    // Done OUTSIDE the transaction because notification failure should not
    // roll back a successfully uploaded file and message
    await this.notificationsService.createForMessage(
      conversationId,
      userId,
      result.message.id,
      `New message with attachment in conversation`,
    );

    this.logger.log(
      `Message with attachment created in conversation ${conversationId} by user ${userId}`,
    );

    // Step 5: Build response — replace stored relative path with full URL
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