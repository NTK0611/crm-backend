import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';
import { NotificationProducer } from './notification.producer';
import { NotificationProcessor } from './notification.processor';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST') ?? 'localhost';
        // ConfigService.get always returns string from .env
        // Must convert to Number explicitly — ioredis requires a numeric port
        const port = Number(configService.get<string>('REDIS_PORT') ?? '6379');
        const password = configService.get<string>('REDIS_PASSWORD');
        const useTls = configService.get<string>('REDIS_TLS') === 'true';

        const connection: Record<string, unknown> = { host, port };
        if (password) connection.password = password;
        // TLS must NOT be present at all for local Redis
        // passing tls:{} to a non-TLS server causes a handshake hang
        if (useTls) connection.tls = {};

        return {
          connection,
          // Remove completed jobs after 100 kept — prevents Redis memory bloat
          // Remove failed jobs after 50 kept — keeps them for debugging
          defaultJobOptions: {
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 50 },
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATION,
    }),
    PrismaModule,
  ],
  providers: [NotificationProducer, NotificationProcessor],
  exports: [NotificationProducer],
})
export class QueueModule {}