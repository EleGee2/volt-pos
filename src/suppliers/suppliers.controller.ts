import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @Roles(Role.MANAGER)
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const result = await this.suppliersService.findAll(
      req.user.organizationId,
      search,
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Suppliers retrieved successfully', ...result };
  }

  @Get(':id')
  @Roles(Role.MANAGER)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const data = await this.suppliersService.findOne(id, req.user.organizationId);
    return { message: 'Supplier retrieved successfully', data };
  }

  @Post()
  @Roles(Role.MANAGER)
  async create(@Body() dto: CreateSupplierDto, @Request() req: any) {
    const data = await this.suppliersService.create(req.user.organizationId, dto);
    return { message: 'Supplier created successfully', data };
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @Request() req: any,
  ) {
    const data = await this.suppliersService.update(id, req.user.organizationId, dto);
    return { message: 'Supplier updated successfully', data };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    await this.suppliersService.remove(id, req.user.organizationId);
    return { message: 'Supplier deleted successfully', data: null };
  }
}
