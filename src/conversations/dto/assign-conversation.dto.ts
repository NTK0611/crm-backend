import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignConversationDto {
  @ApiProperty({ description: 'User ID of the staff member to assign' })
  @IsUUID()
  @IsNotEmpty()
  assignedTo: string;
}