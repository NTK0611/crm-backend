import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleName } from '@prisma/client';

@ApiTags('customers')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'STAFF')
@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new customer (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async create(@Body() dto: CreateCustomerDto, @Req() req) {
    this.logger.log(`POST /customers - creating customer: ${dto.name}`);
    const data = await this.customersService.create(dto, req.user.id);
    return { message: 'Customer created successfully', data };
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers — ADMIN sees all, STAFF sees assigned only' })
  @ApiResponse({ status: 200, description: 'List of customers' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  async findAll(@Query() query: QueryCustomerDto, @Req() req) {
    this.logger.log(`GET /customers - query: ${JSON.stringify(query)}`);
    // Extract role from JWT strategy's returned user object
    const userRole = req.user.userRoles[0]?.role?.name as RoleName;
    const data = await this.customersService.findAll(query, req.user.id, userRole);
    return { message: 'Customers retrieved successfully', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by ID (ADMIN sees all, STAFF sees assigned only)' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 403, description: 'Not assigned to this customer' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(@Param('id') id: string ,@Req() req) {
    this.logger.log(`GET /customers/${id}`);
    const userRole = req.user.userRoles?.[0]?.role?.name as RoleName;
    const data = await this.customersService.findOne(id, req.user.id, userRole);
    return { message: 'Customer retrieved successfully', data };
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a customer by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    this.logger.log(`PUT /customers/${id}`);
    const data = await this.customersService.update(id, dto);
    return { message: 'Customer updated successfully', data };
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a customer by ID (ADMIN only)' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 403, description: 'ADMIN only' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async remove(@Param('id') id: string) {
    this.logger.log(`DELETE /customers/${id}`);
    const data = await this.customersService.remove(id);
    return { message: 'Customer deleted successfully', data };
  }
}