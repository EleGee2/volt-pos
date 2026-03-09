import { UnitOfMeasure } from '@prisma/client';

export class UpdateProductDto {
  name?: string;
  barcode?: string;
  categoryId?: string;
  unitOfMeasure?: UnitOfMeasure;
  costPrice?: number;
  sellingPrice?: number;
  taxRate?: number;
  reorderLevel?: number;
  isActive?: boolean;
  /** Manager PIN required if new sellingPrice < costPrice */
  managerPin?: string;
}
