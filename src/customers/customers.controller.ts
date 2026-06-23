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
@ApiTags('customers')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  private readonly logger = new Logger(CustomersController.name);

  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async create(@Body() dto: CreateCustomerDto , @Req() req) {
    this.logger.log(`POST /customers - creating customer: ${dto.name}`);
    const data = await this.customersService.create(dto, req.user.id);
    return { message: 'Customer created successfully', data };
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers with search, filter and pagination' })
  @ApiResponse({ status: 200, description: 'List of customers' })
  async findAll(@Query() query: QueryCustomerDto) {
    this.logger.log(`GET /customers - query: ${JSON.stringify(query)}`);
    const data = await this.customersService.findAll(query);
    return { message: 'Customers retrieved successfully', data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findOne(@Param('id') id: string) {
    this.logger.log(`GET /customers/${id}`);
    const data = await this.customersService.findOne(id);
    return { message: 'Customer retrieved successfully', data };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @ApiResponse({ status: 409, description: 'Email or phone already exists' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    this.logger.log(`PUT /customers/${id}`);
    const data = await this.customersService.update(id, dto);
    return { message: 'Customer updated successfully', data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Customer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async remove(@Param('id') id: string) {
    this.logger.log(`DELETE /customers/${id}`);
    const data = await this.customersService.remove(id);
    return { message: 'Customer deleted successfully', data };
  }
}