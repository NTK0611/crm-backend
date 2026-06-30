import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryMessageDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'uuid-of-conversation',
    description: 'Filter messages by conversation ID (required)',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({
    example: 'hello',
    description: 'Search messages by keyword in content',
  })
  @IsOptional()
  @IsString()
  keyword?: string;
}