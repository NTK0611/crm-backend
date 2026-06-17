import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID of the customer' })
  @IsNotEmpty()
  @IsUUID()
  customerId: string;

  @ApiPropertyOptional({ example: 'Issue with order #123', description: 'Optional note' })
  @IsOptional()
  @IsString()
  note?: string;
}