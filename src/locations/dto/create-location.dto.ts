import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressStreet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  addressPostalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;
}
