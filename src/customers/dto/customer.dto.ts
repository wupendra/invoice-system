import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CustomerDto {
  @IsString() @MaxLength(255) companyName!: string;
  @IsOptional() @IsString() @MaxLength(64) registrationNumber?: string;
  @IsString() address!: string;
  @IsEmail() primaryEmail!: string;
  @IsOptional() @IsString() @MaxLength(64) phone?: string;
  @IsOptional() @IsString() notes?: string;

  // Form posts CCs as a textarea (one email per line). Coerce string → array → validate.
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    return value.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
  })
  @IsArray() @ArrayUnique() @IsEmail({}, { each: true })
  ccEmails!: string[];
}
