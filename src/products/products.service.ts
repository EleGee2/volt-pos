import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddBundleComponentDto } from './dto/add-bundle-component.dto';
import { SubscriptionPlan, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const PLAN_PRODUCT_LIMITS: Record<SubscriptionPlan, number | null> = {
  FREE: 100,
  STARTER: 500,
  PRO: null,
  ENTERPRISE: null,
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    search?: string,
    categoryId?: string,
    parentOnly?: boolean,
    brandId?: string,
    supplierId?: string,
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {
      organizationId,
      isActive: true,
      ...(parentOnly ? { parentProductId: null } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(brandId ? { brandId } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true, brand: true, supplier: true },
        orderBy: { createdAt: 'desc' },
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
      include: {
        category: true,
        brand: true,
        supplier: true,
        variants: { where: { isActive: true } },
        bundleItems: { include: { componentProduct: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(organizationId: string, dto: CreateProductDto) {
    // Fetch org to enforce plan limit from DB (not JWT which lacks plan field)
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subscriptionPlan: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const limit = PLAN_PRODUCT_LIMITS[org.subscriptionPlan];
    if (limit !== null) {
      const count = await this.prisma.product.count({
        where: { organizationId, isActive: true },
      });
      if (count >= limit) {
        throw new ForbiddenException({
          errorCode: 'PLAN_LIMIT_EXCEEDED',
          message: `Your ${org.subscriptionPlan} plan allows a maximum of ${limit} products. Upgrade to add more.`,
        });
      }
    }

    if (dto.parentProductId) {
      const parent = await this.prisma.product.findFirst({
        where: { id: dto.parentProductId, organizationId },
      });
      if (!parent) throw new NotFoundException('Parent product not found');
    }

    if (dto.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: dto.brandId, organizationId },
      });
      if (!brand) throw new NotFoundException('Brand not found');
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, organizationId },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    const existing = await this.prisma.product.findFirst({
      where: { organizationId, sku: dto.sku },
    });
    if (existing) {
      throw new ConflictException(`SKU '${dto.sku}' already exists in your catalog`);
    }

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
        description: dto.description,
        imageUrl: dto.imageUrl,
        minSaleQty: dto.minSaleQty ?? 1,
        attributes: dto.attributes,
        parentProductId: dto.parentProductId,
        variantLabel: dto.variantLabel,
        brandId: dto.brandId,
        supplierId: dto.supplierId,
      },
    });
  }

  async update(
    id: string,
    organizationId: string,
    requesterId: string,
    dto: UpdateProductDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const newSellingPrice = dto.sellingPrice ?? Number(product.sellingPrice);
    const costPrice = dto.costPrice ?? Number(product.costPrice);

    if (newSellingPrice < costPrice) {
      if (!dto.managerId || !dto.managerPin) {
        throw new ForbiddenException({
          errorCode: 'BELOW_COST_OVERRIDE_REQUIRED',
          message: 'managerId and managerPin are required for below-cost pricing.',
        });
      }

      const manager = await this.prisma.user.findFirst({
        where: {
          id: dto.managerId,
          organizationId,
          role: { in: ['MANAGER', 'OWNER', 'SUPER_ADMIN'] },
          isActive: true,
        },
      });
      if (!manager) throw new NotFoundException('Manager not found');

      const success =
        !!manager.pinHash &&
        (await bcrypt.compare(dto.managerPin, manager.pinHash));

      await this.prisma.priceOverrideLog.create({
        data: {
          productId: id,
          requestedById: requesterId,
          managerId: dto.managerId,
          attemptedSellingPrice: newSellingPrice,
          costPriceAtTime: costPrice,
          success,
        },
      });

      if (!success) {
        throw new ForbiddenException({
          errorCode: 'FORBIDDEN',
          message: 'Invalid manager PIN.',
        });
      }
    }

    if (dto.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: dto.brandId, organizationId },
      });
      if (!brand) throw new NotFoundException('Brand not found');
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, organizationId },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { managerId, managerPin, ...updateData } = dto;
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

  async findVariants(productId: string, organizationId: string) {
    const parent = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!parent) throw new NotFoundException('Product not found');

    return this.prisma.product.findMany({
      where: { parentProductId: productId, organizationId, isActive: true },
      include: { category: true },
    });
  }

  async findBundleComponents(productId: string, organizationId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.bundleComponent.findMany({
      where: { bundleProductId: productId },
      include: { componentProduct: true },
    });
  }

  async addBundleComponent(
    productId: string,
    organizationId: string,
    dto: AddBundleComponentDto,
  ) {
    const bundle = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!bundle) throw new NotFoundException('Product not found');
    if (!bundle.isBundle) {
      throw new BadRequestException('Product is not a bundle');
    }
    if (dto.componentProductId === productId) {
      throw new BadRequestException('A bundle cannot contain itself');
    }

    const component = await this.prisma.product.findFirst({
      where: { id: dto.componentProductId, organizationId },
    });
    if (!component) throw new NotFoundException('Component product not found');

    try {
      return await this.prisma.bundleComponent.create({
        data: {
          bundleProductId: productId,
          componentProductId: dto.componentProductId,
          quantity: dto.quantity,
        },
        include: { componentProduct: true },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Component already in this bundle');
      }
      throw err;
    }
  }

  async removeBundleComponent(
    productId: string,
    organizationId: string,
    componentId: string,
  ) {
    const bundle = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!bundle) throw new NotFoundException('Product not found');

    const record = await this.prisma.bundleComponent.findFirst({
      where: { id: componentId, bundleProductId: productId },
    });
    if (!record) throw new NotFoundException('Bundle component not found');

    await this.prisma.bundleComponent.delete({ where: { id: componentId } });
  }
}
