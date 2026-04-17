import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class InvoiceItemDto {
  @IsString() @MaxLength(255) itemName!: string;
  @IsString() description!: string;
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'unitCost must be a non-negative number with up to 2 decimal places' })
  unitCost!: string;
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'quantity must be a non-negative number with up to 2 decimal places' })
  quantity!: string;
  @IsOptional() @IsString() @MaxLength(255) quantityNote?: string;
}
