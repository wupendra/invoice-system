import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class InvoiceItemDto {
  @IsString() @MaxLength(255) itemName!: string;
  @IsString() description!: string;
  @IsNumberString() unitCost!: string;
  @IsNumberString() quantity!: string;
  @IsOptional() @IsString() @MaxLength(255) quantityNote?: string;
}
