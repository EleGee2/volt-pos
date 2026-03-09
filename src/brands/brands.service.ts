import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
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
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, organizationId: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(organizationId: string, dto: CreateBrandDto) {
    try {
      return await this.prisma.brand.create({
        data: {
          organizationId,
          name: dto.name,
          logoUrl: dto.logoUrl,
          website: dto.website,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`Brand '${dto.name}' already exists`);
      }
      throw err;
    }
  }

  async update(id: string, organizationId: string, dto: UpdateBrandDto) {
    await this.findOne(id, organizationId);
    try {
      return await this.prisma.brand.update({ where: { id }, data: dto });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(`Brand name '${dto.name}' already exists`);
      }
      throw err;
    }
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.brand.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
