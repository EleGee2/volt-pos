import { IsEmail, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsUUID('4')
  locationId?: string;
}
