import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Pham Thi Lan', description: 'Full name of the customer' })
  @IsNotEmpty({ message: 'Customer name cannot be empty' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'lan.pham@gmail.com', description: 'Customer email' })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '0901234567', description: 'Customer phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '12 Nguyen Hue, Q1, HCM', description: 'Customer address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
    description: 'Customer status',
  })
  @IsOptional()
  @IsEnum(CustomerStatus, { message: 'Status must be ACTIVE, INACTIVE or BLOCKED' })
  status?: CustomerStatus;
}