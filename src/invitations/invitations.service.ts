import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { UserRole } from '@prisma/client';

const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 4,
  OWNER: 3,
  MANAGER: 2,
  CASHIER: 1,
};

const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

@Injectable()
export class InvitationsService {
  constructor(private prisma: PrismaService) {}

  async create(
    organizationId: string,
    requesterId: string,
    requesterRole: string,
    dto: CreateInvitationDto,
  ) {
    // 1. Can only invite someone at a strictly lower role level
    if ((ROLE_LEVEL[dto.role] ?? 0) >= (ROLE_LEVEL[requesterRole] ?? 0)) {
      throw new ForbiddenException(
        `You cannot invite a user with role ${dto.role}`,
      );
    }

    // 2. Validate locationId if provided
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId },
      });
      if (!location) throw new NotFoundException('Location not found');
      if (!location.isActive) {
        throw new BadRequestException(
          'Cannot invite to a deactivated location',
        );
      }
    }

    // 3. Reject if email already belongs to an active user in this org
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email, organizationId, isActive: true },
    });
    if (existingUser) {
      throw new ConflictException(
        'A user with this email already exists in your organization',
      );
    }

    // 4. Upsert — creates new or refreshes an existing (even accepted) invite
    //    so a re-invite after acceptance is seamless
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    const invitation = await this.prisma.userInvitation.upsert({
      where: { organizationId_email: { organizationId, email: dto.email } },
      create: {
        organizationId,
        email: dto.email,
        role: dto.role,
        locationId: dto.locationId ?? null,
        tokenHash,
        expiresAt,
        invitedBy: requesterId,
      },
      update: {
        role: dto.role,
        locationId: dto.locationId ?? null,
        tokenHash,
        expiresAt,
        acceptedAt: null,
        invitedBy: requesterId,
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });

    // Placeholder for email sending — log raw token to console
    console.log(
      `[DEV ONLY] Invitation token for ${dto.email}: ${rawToken}`,
    );

    return invitation;
  }

  async findAll(organizationId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [invitations, total] = await this.prisma.$transaction([
      this.prisma.userInvitation.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          inviter: { select: { firstName: true, lastName: true, email: true } },
          location: { select: { id: true, name: true } },
        },
      }),
      this.prisma.userInvitation.count({ where: { organizationId } }),
    ]);

    return {
      data: invitations.map(({ tokenHash: _, ...inv }) => inv),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async resend(id: string, organizationId: string) {
    const invitation = await this.prisma.userInvitation.findFirst({
      where: { id, organizationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    if (invitation.acceptedAt !== null) {
      throw new BadRequestException('Cannot resend an already accepted invitation');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    const updated = await this.prisma.userInvitation.update({
      where: { id },
      data: { tokenHash, expiresAt },
      select: { id: true, email: true, role: true, expiresAt: true },
    });

    console.log(
      `[DEV ONLY] Resent invitation token for ${invitation.email}: ${rawToken}`,
    );

    return updated;
  }

  async cancel(id: string, organizationId: string) {
    const invitation = await this.prisma.userInvitation.findFirst({
      where: { id, organizationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    if (invitation.acceptedAt !== null) {
      throw new BadRequestException('Cannot cancel an already accepted invitation');
    }

    await this.prisma.userInvitation.delete({ where: { id } });

    return { cancelled: { id, email: invitation.email } };
  }

  async accept(dto: AcceptInvitationDto) {
    // Find a non-expired, non-accepted invitation for this email
    const invitations = await this.prisma.userInvitation.findMany({
      where: {
        email: dto.email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    // Match token — generic error to prevent enumeration
    const GENERIC_ERROR = 'Invalid or expired invitation';
    if (invitations.length === 0) {
      throw new BadRequestException(GENERIC_ERROR);
    }

    let matched: (typeof invitations)[0] | null = null;
    for (const inv of invitations) {
      if (await bcrypt.compare(dto.token, inv.tokenHash)) {
        matched = inv;
        break;
      }
    }
    if (!matched) throw new BadRequestException(GENERIC_ERROR);

    // Guard against race: email may have been registered since invite was sent
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          organizationId: matched!.organizationId,
          email: matched!.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: matched!.role as UserRole,
        },
      });

      await tx.userInvitation.update({
        where: { id: matched!.id },
        data: { acceptedAt: new Date() },
      });

      if (matched!.locationId) {
        await tx.userLocation.create({
          data: {
            userId: newUser.id,
            locationId: matched!.locationId,
            assignedBy: matched!.invitedBy,
          },
        });
      }

      return newUser;
    });

    // Return SafeUser (strip sensitive hashes)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _p, pinHash: _pin, ...safeUser } = user;
    return safeUser;
  }
}
