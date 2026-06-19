import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ example: 'Hello, how can I help you?', description: 'Message content' })
  @IsNotEmpty({ message: 'Message content cannot be empty' })
  @IsString()
  @MaxLength(5000)
  content: string;
}