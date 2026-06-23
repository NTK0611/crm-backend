import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Step 1: get socket from context
      const client: Socket = context.switchToWs().getClient();

      // Step 2: extract token from handshake
      const token = client.handshake.auth?.token;
      if (!token) {
        throw new UnauthorizedException('No token provided');
      }

      // Step 3: verify token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Step 4: fetch fresh user from DB
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          userRoles: {
            select: { role: { select: { name: true } } },
          },
        },
      });

      if (!user) throw new UnauthorizedException('User not found');
      if (!user.isActive) throw new UnauthorizedException('User is inactive');

      // Step 5: attach user to socket
      client.data.user = user;

      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}