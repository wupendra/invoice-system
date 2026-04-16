import { IsEmail, IsNumberString, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsNumberString() vatRate!: string;
  @IsString() @MaxLength(32) currencyLabel!: string;

  @IsString() @MaxLength(255) fromCompanyName!: string;
  @IsString() fromAddress!: string;
  @IsString() @MaxLength(64) fromPan!: string;
  @IsEmail() fromEmail!: string;

  @IsString() bankDetails!: string;

  @IsString() @MaxLength(255) contactName!: string;
  @IsEmail() contactEmail!: string;
  @IsString() @MaxLength(64) contactPhone!: string;
}