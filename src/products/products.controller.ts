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
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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
  findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.productsService.findAll(
      req.user.organizationId,
      search,
      categoryId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get(':id')
  @Roles(Role.CASHIER)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.productsService.findOne(id, req.user.organizationId);
  }

  @Post()
  @Roles(Role.MANAGER)
  create(@Body() dto: CreateProductDto, @Request() req: any) {
    return this.productsService.create(
      req.user.organizationId,
      dto,
      req.user.plan,
    );
  }

  @Patch(':id')
  @Roles(Role.MANAGER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: any,
  ) {
    return this.productsService.update(id, req.user.organizationId, dto);
  }

  @Delete(':id')
  @Roles(Role.MANAGER)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.productsService.softDelete(id, req.user.organizationId);
  }
}
