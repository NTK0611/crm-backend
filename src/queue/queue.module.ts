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
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
          tls: {},
        },
      }),
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