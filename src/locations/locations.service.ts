import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.location.findMany({
      where: { organizationId, isActive: true },
    });
  }

  async findOne(id: string, organizationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, organizationId },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  create(organizationId: string, dto: CreateLocationDto) {
    return this.prisma.location.create({
      data: {
        organizationId,
        name: dto.name,
        logoUrl: dto.logoUrl,
        phone: dto.phone,
        email: dto.email,
        addressStreet: dto.addressStreet,
        addressCity: dto.addressCity,
        addressState: dto.addressState,
        addressCountry: dto.addressCountry,
        addressPostalCode: dto.addressPostalCode,
        taxRegistrationNumber: dto.taxRegistrationNumber,
        currencyCode: dto.currencyCode ?? 'NGN',
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateLocationDto) {
    await this.findOne(id, organizationId);
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);
    return this.prisma.location.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
