import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole, SubscriptionPlan } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SignupDto } from './dto/signup.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

type SafeUser = Omit<User, 'passwordHash' | 'pinHash'>;

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  organizationId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const slug = dto.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const result = await this.prisma.$transaction(async (tx) => {
      let org = await tx.organization.findUnique({ where: { slug } });
      if (org) {
        // Just a simple safety mechanism for MVP to avoid slug collision
        throw new ConflictException(
          'Organization name too similar to an existing one',
        );
      }

      org = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug,
          subscriptionPlan: SubscriptionPlan.FREE,
        },
      });

      await tx.location.create({
        data: {
          organizationId: org.id,
          name: dto.locationName || 'Main Store',
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: UserRole.OWNER,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash: _, pinHash, ...safeUser } = user;
      return safeUser;
    });

    return this.login(result);
  }

  async validateUser(email: string, pass: string): Promise<SafeUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, pinHash, ...result } = user;
      return result;
    }
    return null;
  }

  login(user: SafeUser) {
    const payload: JwtPayload = {
      sub: String(user.id),
      email: String(user.email),
      role: String(user.role),
      organizationId: user.organizationId,
    };

    return {
      success: true,
      data: {
        accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
        refreshToken: this.jwtService.sign(payload, { expiresIn: '30d' }),
        user: payload,
      },
      error: null,
      meta: {},
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(refreshToken);
      const payload = decoded;

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const newPayload: JwtPayload = {
        sub: String(user.id),
        email: String(user.email),
        role: String(user.role),
        organizationId: user.organizationId,
      };

      return {
        success: true,
        data: {
          accessToken: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
          refreshToken: this.jwtService.sign(newPayload, { expiresIn: '30d' }),
        },
        error: null,
        meta: {},
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Return success anyway to prevent email enumeration attacks
      return {
        success: true,
        message: 'If that email exists, a password reset link has been sent.',
      };
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // In a real app, send email here. For MVP/testing, log it.
    console.log(
      `[DEV ONLY] Password reset token for ${user.email}: ${rawToken}`,
    );

    return {
      success: true,
      message: 'If that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // 1. Find user by email first for O(1) lookup
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password reset token');
    }

    // 2. Fetch active tokens specifically for this user
    const userActiveTokens = await this.prisma.passwordResetToken.findMany({
      where: {
        userId: user.id,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    let matchedTokenRecord: any | null = null;
    for (const record of userActiveTokens) {
      if (await bcrypt.compare(dto.token, record.tokenHash)) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException(
        'Invalid or expired password reset token',
      );
    }

    // Mark token as used
    await this.prisma.passwordResetToken.update({
      where: { id: matchedTokenRecord.id },
      data: { isUsed: true },
    });

    // Update password
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: matchedTokenRecord.userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: 'Password has been successfully reset.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: 'Password changed successfully' };
  }
}
