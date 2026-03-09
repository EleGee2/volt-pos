import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    search?: string,
    page = 1,
    limit = 50,
  ) {
    const skip = (page - 1) * limit;
    const where = {
      organizationId,
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { contactName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { products: true } } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(organizationId: string, dto: CreateSupplierDto) {
    try {
      return await this.prisma.supplier.create({
        data: { organizationId, ...dto },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`Supplier '${dto.name}' already exists`);
      }
      throw err;
    }
  }

  async update(id: string, organizationId: string, dto: UpdateSupplierDto) {
    await this.findOne(id, organizationId);
    try {
      return await this.prisma.supplier.update({ where: { id }, data: dto });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`Supplier name '${dto.name}' already exists`);
      }
      throw err;
    }
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
