import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { SenderType } from '@prisma/client';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token as string;
      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: no token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
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

      if (!user || !user.isActive) {
        this.logger.warn(`Client ${client.id} disconnected: user not found or inactive`);
        client.disconnect();
        return;
      }

      client.data.user = user;
      this.logger.log(`Client connected: ${client.id} user: ${user.email}`);

    } catch {
      this.logger.warn(`Client ${client.id} disconnected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    this.logger.log(
      `Client disconnected: ${client.id} ${user ? `user: ${user.email}` : ''}`,
    );
  }

  // ─── Private Helper ───────────────────────────────────────────────

  private async validateMembership(
    client: Socket,
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        conversationMembers: { select: { userId: true } },
      },
    });

    if (!conversation) {
      client.emit('error', { message: 'Conversation not found' });
      return false;
    }

    const isMember = conversation.conversationMembers.some(
      (m) => m.userId === userId,
    );

    if (!isMember) {
      client.emit('error', { message: 'You are not a member of this conversation' });
      return false;
    }

    return true;
  }

  // ─── Join Room ───────────────────────────────────────────────────

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = client.data.user;

    if (!user) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    const isValid = await this.validateMembership(
      client,
      data.conversationId,
      user.id,
    );
    if (!isValid) return;

    const roomName = `conversation:${data.conversationId}`;
    await client.join(roomName);

    this.logger.log(`User ${user.id} joined room ${roomName}`);

    client.emit('joinedRoom', {
      conversationId: data.conversationId,
      message: 'Successfully joined conversation room',
    });
  }

  // ─── Send Message ─────────────────────────────────────────────────

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const user = client.data.user;

    if (!user) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    if (!data.content || !data.content.trim()) {
      client.emit('error', { message: 'Message content cannot be empty' });
      return;
    }

    const isValid = await this.validateMembership(
      client,
      data.conversationId,
      user.id,
    );
    if (!isValid) return;

    const message = await this.prisma.message.create({
      data: {
        conversationId: data.conversationId,
        senderId: user.id,
        senderType: SenderType.USER,
        content: data.content.trim(),
      },
    });

    this.logger.log(
      `Message saved: ${message.id} in conversation: ${data.conversationId}`,
    );

    const roomName = `conversation:${data.conversationId}`;
    this.server.to(roomName).emit('newMessage', {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
      content: message.content,
      sentAt: message.sentAt,
    });
  }
}