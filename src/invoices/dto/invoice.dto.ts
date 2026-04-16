import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { InvoiceItemDto } from './invoice-item.dto';

export class InvoiceDto {
  @IsInt() @Type(() => Number) customerId!: number;
  @IsDateString() invoiceDate!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
  @IsOptional() @IsString() amountInWords?: string;
}
