import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { RoleName } from '@prisma/client';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check duplicate email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Determine role — default to STAFF if not provided
    const roleName = dto.role ?? 'STAFF' as RoleName;

    // Find the role in DB
    const role = await this.prisma.role.findUnique({
      where: { name: roleName as RoleName },
    });

    if (!role) {
      throw new BadRequestException(`Role '${roleName}' does not exist in the system`);
    }

    // Create user and assign role in one transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
        },
      });

      await tx.userRole.create({
        data: {
          userId: created.id,
          roleId: role.id,
        },
      });

      return created;
    });

    this.logger.log(`New user registered: ${user.email} with role: ${roleName}`);

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: roleName,
      createdAt: user.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`Failed login attempt for email: ${dto.email} - user not found`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      this.logger.warn(`Failed login attempt for email: ${dto.email} - wrong password`);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      this.logger.warn(`Failed login attempt for email: ${dto.email} - account inactive`);
      throw new UnauthorizedException('Account is inactive');
    }

    const role = user.userRoles[0]?.role?.name ?? 'STAFF';

    const payload = {
      sub: user.id,
      email: user.email,
      role,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    return user;
  }
}