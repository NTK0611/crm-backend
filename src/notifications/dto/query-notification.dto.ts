import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryNotificationDto {
  // isRead is optional — if omitted, return all notifications
  // if true  → only read notifications
  // if false → only unread notifications
  // Query params arrive as strings ("true"/"false"), so we use
  // @Transform to convert to actual boolean before validation
  @ApiPropertyOptional({ description: 'Filter by read status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isRead?: boolean;
}