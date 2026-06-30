import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // ─── Register ─────────────────────────────────────────────────────
  // ADMIN-only: hệ thống CRM là closed system, không public registration
  // JwtAuthGuard chạy trước → xác thực token
  // RolesGuard chạy sau → kiểm tra role ADMIN
  // @Throttle override global 100/60s → xuống 3/60s vì endpoint nhạy cảm
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Register a new user (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized — no token' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN only' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto) {
    this.logger.log(`POST /auth/register - ${dto.email}`);
    const data = await this.authService.register(dto);
    return { message: 'User registered successfully', data };
  }

  // ─── Login ────────────────────────────────────────────────────────
  // Public endpoint — không cần JWT
  // @Throttle override global → 5/60s để chống brute-force password
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and get JWT token' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(@Body() dto: LoginDto) {
    this.logger.log(`POST /auth/login - ${dto.email}`);
    const data = await this.authService.login(dto);
    return { message: 'Login successful', data };
  }

  // ─── Profile ──────────────────────────────────────────────────────
  // Không đổi gì — global ThrottlerGuard apply 100/60s mặc định
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any) {
    this.logger.log(`GET /auth/profile - userId: ${req.user.id}`);
    const data = await this.authService.getProfile(req.user.id);
    return { message: 'Profile retrieved successfully', data };
  }
}