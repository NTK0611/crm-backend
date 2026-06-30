import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@gmail.com', description: 'User email' })
  @IsNotEmpty({ message: 'Email cannot be empty' })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({ example: 'Password123!', description: 'Password minimum 6 characters' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(50)
  password: string;

  @ApiProperty({ example: 'Nguyen Van A', description: 'Full name' })
  @IsNotEmpty({ message: 'Full name cannot be empty' })
  @IsString()
  @MaxLength(255)
  fullName: string;

  @ApiProperty({
    example: 'STAFF',
    description: 'Role to assign: ADMIN, STAFF, or CUSTOMER. Defaults to STAFF if omitted.',
    enum: ['ADMIN', 'STAFF', 'CUSTOMER'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'STAFF', 'CUSTOMER'], {
    message: 'role must be one of: ADMIN, STAFF, CUSTOMER',
  })
  role?: string;
}