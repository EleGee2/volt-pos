import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AcceptInvitationDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MaxLength(100)
  lastName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
