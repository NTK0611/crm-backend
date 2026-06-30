import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { CloudinaryService } from './cloudinary.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, CloudinaryService],
  // CloudinaryService must be in providers so NestJS can inject it
  // into AttachmentsService via the constructor
  exports: [AttachmentsService, CloudinaryService],
  // Export CloudinaryService too — ConversationsModule imports AttachmentsModule
  // and ConversationsService needs AttachmentsService which depends on CloudinaryService.
  // Without exporting it, NestJS throws "CloudinaryService is not a provider" at runtime.
})
export class AttachmentsModule {}