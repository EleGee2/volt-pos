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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @Roles(Role.CASHIER)
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const result = await this.brandsService.findAll(
      req.user.organizationId,
      search,
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Brands retrieved successfully', ...result };
  }

  @Get(':id')
  @Roles(Role.CASHIER)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const data = await this.brandsService.findOne(id, req.user.organizationId);
    return { message: 'Brand retrieved successfully', data };
  }

  @Post()
  @Roles(Role.MANAGER)
  async create(@Body() dto: CreateBrandDto, @Request() req: any) {
    const data = await this.brandsService.create(req.user.organizationId, dto);
    return { message: 'Brand created successfully', data };
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
    @Request() req: any,
  ) {
    const data = await this.brandsService.update(id, req.user.organizationId, dto);
    return { message: 'Brand updated successfully', data };
  }

  @Delete(':id')
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    await this.brandsService.remove(id, req.user.organizationId);
    return { message: 'Brand deleted successfully', data: null };
  }
}
