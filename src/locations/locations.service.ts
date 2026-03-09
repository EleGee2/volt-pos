import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  // ─── User Assignment ──────────────────────────────────────────────────────

  async getLocationUsers(
    locationId: string,
    organizationId: string,
    page: number,
    limit: number,
  ) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });
    if (!location) throw new NotFoundException('Location not found');

    const skip = (page - 1) * limit;

    const [assignments, total] = await this.prisma.$transaction([
      this.prisma.userLocation.findMany({
        where: { locationId },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.userLocation.count({ where: { locationId } }),
    ]);

    return {
      data: assignments.map((a) => ({
        assignmentId: a.id,
        assignedAt: a.assignedAt,
        user: a.user,
      })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async assignUser(
    locationId: string,
    organizationId: string,
    requesterId: string,
    requesterRole: string,
    targetUserId: string,
  ) {
    // 1. Verify location belongs to org
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });
    if (!location) throw new NotFoundException('Location not found');

    // 2. Deactivated location
    if (!location.isActive) {
      throw new BadRequestException(
        'Cannot assign users to a deactivated location',
      );
    }

    // 3. Verify target user belongs to same org
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });
    if (!targetUser) {
      throw new NotFoundException(
        'User not found or does not belong to your organization',
      );
    }

    // 4. Deactivated user
    if (!targetUser.isActive) {
      throw new BadRequestException('Cannot assign a deactivated user');
    }

    // 5. MANAGER scope: can only assign to locations they are themselves assigned to
    //    This also blocks MANAGER self-escalation to new locations
    if (requesterRole === 'MANAGER') {
      const managerAssignment = await this.prisma.userLocation.findUnique({
        where: { userId_locationId: { userId: requesterId, locationId } },
      });
      if (!managerAssignment) {
        throw new ForbiddenException(
          'Managers can only assign users to locations they are assigned to',
        );
      }
    }

    // 6. Create assignment — catch duplicate (P2002 → 409)
    try {
      return await this.prisma.userLocation.create({
        data: { userId: targetUserId, locationId, assignedBy: requesterId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
          location: { select: { id: true, name: true } },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('User is already assigned to this location');
      }
      throw err;
    }
  }

  async unassignUser(
    locationId: string,
    organizationId: string,
    requesterId: string,
    requesterRole: string,
    targetUserId: string,
  ) {
    // 1. Verify location belongs to org
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
    });
    if (!location) throw new NotFoundException('Location not found');

    // 2. MANAGER scope check
    if (requesterRole === 'MANAGER') {
      const managerAssignment = await this.prisma.userLocation.findUnique({
        where: { userId_locationId: { userId: requesterId, locationId } },
      });
      if (!managerAssignment) {
        throw new ForbiddenException(
          'Managers can only manage users in locations they are assigned to',
        );
      }
    }

    // 3. Verify target user belongs to org
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });
    if (!targetUser) {
      throw new NotFoundException(
        'User not found or does not belong to your organization',
      );
    }

    // 4. Find assignment
    const assignment = await this.prisma.userLocation.findUnique({
      where: { userId_locationId: { userId: targetUserId, locationId } },
    });
    if (!assignment) {
      throw new NotFoundException(
        'This user is not assigned to this location',
      );
    }

    await this.prisma.userLocation.delete({ where: { id: assignment.id } });

    return {
      unassigned: { userId: targetUserId, locationId },
    };
  }
}
