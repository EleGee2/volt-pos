import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 4,
  OWNER: 3,
  MANAGER: 2,
  CASHIER: 1,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findLocations(
    targetUserId: string,
    requesterId: string,
    requesterRole: string,
    organizationId: string,
    page: number,
    limit: number,
  ) {
    // Verify target user exists in the same org
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId },
    });
    if (!targetUser) {
      throw new NotFoundException(
        'User not found or does not belong to your organization',
      );
    }

    // CASHIER can only view their own location assignments
    if (
      (ROLE_LEVEL[requesterRole] ?? 0) <= ROLE_LEVEL['CASHIER'] &&
      requesterId !== targetUserId
    ) {
      throw new ForbiddenException(
        'Cashiers can only view their own location assignments',
      );
    }

    const skip = (page - 1) * limit;

    const [assignments, total] = await this.prisma.$transaction([
      this.prisma.userLocation.findMany({
        where: { userId: targetUserId },
        skip,
        take: limit,
        include: {
          location: {
            select: {
              id: true,
              name: true,
              isActive: true,
              addressCity: true,
              addressState: true,
              currencyCode: true,
            },
          },
        },
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.userLocation.count({ where: { userId: targetUserId } }),
    ]);

    return {
      data: assignments.map((a) => ({
        assignmentId: a.id,
        assignedAt: a.assignedAt,
        location: a.location,
      })),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
}
