import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, userId: string) {
    // Check duplicate email
    if (dto.email) {
      const existingEmail = await this.prisma.customer.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check duplicate phone
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

    // Activity log
    await this.prisma.activityLog.create({
       data: {
        conversationId: null,
        userId,
        action: 'CUSTOMER_CREATED',
        meta: { customerId: customer.id, name: customer.name },
      },
    })

    return customer;
  }

  async findAll(query: QueryCustomerDto) {
    const { search, status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
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

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    // Check customer exists
    await this.findOne(id);

    // Check duplicate email
    if (dto.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Check duplicate phone
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
    await this.findOne(id);

    await this.prisma.customer.delete({
      where: { id },
    });

    this.logger.log(`Customer deleted: ${id}`);

    return { message: 'Customer deleted successfully' };
  }
}