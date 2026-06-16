import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service is running',
    schema: {
      example: {
        success: true,
        message: 'Success',
        data: {
          status: 'ok',
          timestamp: '2024-01-01T00:00:00.000Z',
          uptime: 12.345,
          environment: 'development',
        },
        errors: null,
      },
    },
  })
  check() {
    return {
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV ?? 'development',
      },
    };
  }
}
