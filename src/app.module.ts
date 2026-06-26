import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { CustomersModule } from './customers/customers.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { MessagesModule } from './messages/messages.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // Rate limiting — global default: 100 requests per 60 seconds
    // Individual endpoints override this with @Throttle({ default: { limit: X, ttl: Y } })
    ThrottlerModule.forRoot([{
      ttl: 60000,   // window size: 60 seconds (in ms)
      limit: 100,   // max requests per window per IP
    }]),

    PrismaModule,
    HealthModule,
    CustomersModule,
    UsersModule,
    AuthModule,
    ConversationsModule,
    ChatModule,
    NotificationsModule,
    WebhooksModule,
    AttachmentsModule,
    MessagesModule,
    QueueModule,
  ],
  providers: [
    // Đăng ký ThrottlerGuard globally — áp dụng cho TẤT CẢ routes
    // Các endpoint muốn override thì dùng @Throttle() decorator
    // Các endpoint muốn skip thì dùng @SkipThrottle() decorator
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}