import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryConversationDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ConversationStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiPropertyOptional({ example: 'uuid-of-user', description: 'Filter by assigned staff ID' })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;
}