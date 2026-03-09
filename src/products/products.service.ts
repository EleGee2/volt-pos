import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SubscriptionPlan } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const PLAN_PRODUCT_LIMITS: Record<SubscriptionPlan, number | null> = {
  FREE: 100,
  STARTER: 500,
  PRO: null, // unlimited
  ENTERPRISE: null,
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    search?: string,
    categoryId?: string,
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      organizationId,
      isActive: true,
      ...(categoryId ? { categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
              { barcode: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(
    organizationId: string,
    dto: CreateProductDto,
    plan: SubscriptionPlan,
  ) {
    // Enforce per-plan product count limit
    const limit = PLAN_PRODUCT_LIMITS[plan];
    if (limit !== null) {
      const count = await this.prisma.product.count({
        where: { organizationId, isActive: true },
      });
      if (count >= limit) {
        throw new ForbiddenException({
          errorCode: 'PLAN_LIMIT_EXCEEDED',
          message: `Your ${plan} plan allows a maximum of ${limit} products. Upgrade to add more.`,
        });
      }
    }

    // Check unique SKU within org
    const existing = await this.prisma.product.findFirst({
      where: { organizationId, sku: dto.sku },
    });
    if (existing)
      throw new ConflictException(
        `SKU '${dto.sku}' already exists in your catalog`,
      );

    return this.prisma.product.create({
      data: {
        organizationId,
        name: dto.name,
        sku: dto.sku,
        barcode: dto.barcode,
        categoryId: dto.categoryId,
        unitOfMeasure: dto.unitOfMeasure,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        taxRate: dto.taxRate ?? -1,
        reorderLevel: dto.reorderLevel ?? 0,
        isBundle: dto.isBundle ?? false,
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');

    // If selling price drops below cost, require manager PIN
    const newSellingPrice = dto.sellingPrice ?? Number(product.sellingPrice);
    const costPrice = dto.costPrice ?? Number(product.costPrice);
    if (newSellingPrice < costPrice) {
      if (!dto.managerPin) {
        throw new ForbiddenException({
          errorCode: 'BELOW_COST_OVERRIDE_REQUIRED',
          message: 'Manager PIN required for below-cost price.',
        });
      }
      if (!product) throw new NotFoundException('Product not found');
      // Note: Manager PIN is validated at controller level via a user lookup. Here we verify hash.
      const manager = await this.prisma.user.findFirst({
        where: {
          organizationId,
          role: { in: ['MANAGER', 'OWNER', 'SUPER_ADMIN'] },
          isActive: true,
        },
      });
      if (
        !manager?.pinHash ||
        !(await bcrypt.compare(dto.managerPin, manager.pinHash))
      ) {
        throw new ForbiddenException({
          errorCode: 'FORBIDDEN',
          message: 'Invalid manager PIN.',
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { managerPin, ...updateData } = dto;
    return this.prisma.product.update({ where: { id }, data: updateData });
  }

  async softDelete(id: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
