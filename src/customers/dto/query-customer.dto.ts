import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryCustomerDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Lan', description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CustomerStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}