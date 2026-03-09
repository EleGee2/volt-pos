import { IsUUID, IsNumber, Min } from 'class-validator';

export class AddBundleComponentDto {
  @IsUUID('4')
  componentProductId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}
