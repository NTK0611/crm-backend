import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ConversationsService } from '../conversations/conversations.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayInit,OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

 constructor(
  private readonly conversationsService: ConversationsService,
  private readonly jwtService: JwtService,
  private readonly configService: ConfigService,
) {}

  // ─── Lifecycle ───────────────────────────────────────────────────
     afterInit(server: Server) {
  server.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.query?.token as string);

      if (!token) {
        return next(new Error('No token provided'));
      }


      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });


      const user = await this.conversationsService.findUserById(
        payload.sub,
      );


      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }


      // attach authenticated user
      socket.data.user = user;


      this.logger.log(
        `Socket authenticated: ${socket.id} user: ${user.email}`,
      );


      // allow connection
      next();

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Socket authentication failed: ${message}`);
      next(new Error('Invalid token'));
    }
  });
  }
  handleConnection(client: Socket) {
      const user = client.data.user;

      this.logger.log(
      `Client connected: ${client.id} user: ${user.email}`,
      );
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
  try {
    await this.conversationsService.checkMembership(conversationId, userId);
    return true;
  } catch (e) {
    if (e instanceof NotFoundException) {
      client.emit('error', { message: 'Conversation not found' });
    } else {
      client.emit('error', { message: 'You are not a member of this conversation' });
    }
    return false;
  }
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

    const message = await this.conversationsService.createMessage(
     data.conversationId,
    { content: data.content.trim() },
    user.id,
     );

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