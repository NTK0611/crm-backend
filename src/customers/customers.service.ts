import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { RoleName } from '@prisma/client';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, userId: string) {
    if (dto.email) {
      const existingEmail = await this.prisma.customer.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.customer.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const customer = await this.prisma.customer.create({
      data: dto,
    });

    this.logger.log(`Customer created: ${customer.id}`);

    await this.prisma.activityLog.create({
      data: {
        conversationId: null,
        userId,
        action: 'CUSTOMER_CREATED',
        meta: { customerId: customer.id, name: customer.name },
      },
    });

    return customer;
  }

  async findAll(query: QueryCustomerDto, userId: string, userRole: RoleName) {
    if (userRole === RoleName.CUSTOMER) {
      throw new ForbiddenException('Access denied');
    }

    const { search, status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const baseWhere = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const where =
      userRole === RoleName.ADMIN
        ? baseWhere
        : {
            ...baseWhere,
            conversations: {
              some: {
                assignments: {
                  some: {
                    assignedToId: userId,
                    unassignedAt: null,
                  },
                },
              },
            },
          };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: RoleName) {
    // Step 1: check the customer exists at all
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    // Step 2: ADMIN sees any customer — no further check needed
    if (userRole === RoleName.ADMIN) {
      return customer;
    }

    // Step 3: STAFF must have an active assignment to a conversation
    // belonging to this customer — same rule as findAll
    const assigned = await this.prisma.assignment.findFirst({
      where: {
        assignedToId: userId,
        unassignedAt: null,
        conversation: {
          customerId: id,
        },
      },
    });

    if (!assigned) {
      throw new ForbiddenException(
        'You do not have an active assignment for this customer',
      );
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    // update/delete remain ADMIN-only via controller @Roles('ADMIN')
    // so no role check needed here
    await this.findOne(id, '', RoleName.ADMIN);

    if (dto.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: { phone: dto.phone, NOT: { id } },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    const customer = await this.prisma.customer.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Customer updated: ${id}`);

    return customer;
  }

  async remove(id: string) {
    await this.findOne(id, '', RoleName.ADMIN);

    await this.prisma.customer.delete({
      where: { id },
    });

    this.logger.log(`Customer deleted: ${id}`);

    return { message: 'Customer deleted successfully' };
  }
}