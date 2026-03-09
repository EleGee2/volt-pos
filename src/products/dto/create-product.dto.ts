import { UnitOfMeasure } from '@prisma/client';

export class CreateProductDto {
  name!: string;
  sku!: string;
  barcode?: string;
  categoryId?: string;
  unitOfMeasure!: UnitOfMeasure;
  costPrice!: number;
  sellingPrice!: number;
  taxRate?: number;
  reorderLevel?: number;
  isBundle?: boolean;
}
