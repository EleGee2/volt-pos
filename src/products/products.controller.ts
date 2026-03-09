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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddBundleComponentDto } from './dto/add-bundle-component.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/roles.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles(Role.CASHIER)
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('parentOnly') parentOnly?: string,
    @Query('brandId') brandId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const result = await this.productsService.findAll(
      req.user.organizationId,
      search,
      categoryId,
      parentOnly === 'true',
      brandId,
      supplierId,
      parseInt(page),
      parseInt(limit),
    );
    return { message: 'Products retrieved successfully', ...result };
  }

  @Get(':id')
  @Roles(Role.CASHIER)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const data = await this.productsService.findOne(id, req.user.organizationId);
    return { message: 'Product retrieved successfully', data };
  }

  @Post()
  @Roles(Role.MANAGER)
  async create(@Body() dto: CreateProductDto, @Request() req: any) {
    const data = await this.productsService.create(req.user.organizationId, dto);
    return { message: 'Product created successfully', data };
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: any,
  ) {
    const data = await this.productsService.update(
      id,
      req.user.organizationId,
      req.user.sub,
      dto,
    );
    return { message: 'Product updated successfully', data };
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    await this.productsService.softDelete(id, req.user.organizationId);
    return { message: 'Product deleted successfully', data: null };
  }

  @Get(':id/variants')
  @Roles(Role.CASHIER)
  async findVariants(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const data = await this.productsService.findVariants(id, req.user.organizationId);
    return { message: 'Variants retrieved successfully', data };
  }

  @Get(':id/bundle-components')
  @Roles(Role.CASHIER)
  async findBundleComponents(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const data = await this.productsService.findBundleComponents(
      id,
      req.user.organizationId,
    );
    return { message: 'Bundle components retrieved successfully', data };
  }

  @Post(':id/bundle-components')
  @Roles(Role.MANAGER)
  async addBundleComponent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddBundleComponentDto,
    @Request() req: any,
  ) {
    const data = await this.productsService.addBundleComponent(
      id,
      req.user.organizationId,
      dto,
    );
    return { message: 'Bundle component added successfully', data };
  }

  @Delete(':id/bundle-components/:componentId')
  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.OK)
  async removeBundleComponent(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Request() req: any,
  ) {
    await this.productsService.removeBundleComponent(
      id,
      req.user.organizationId,
      componentId,
    );
    return { message: 'Bundle component removed successfully', data: null };
  }
}
