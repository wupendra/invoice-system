import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmail, IsString, MaxLength } from 'class-validator';

export class SendEmailDto {
  @IsString() @MaxLength(512) subject!: string;
  @IsString() @MaxLength(20_000) bodyHtml!: string;

  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    return value.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
  })
  @IsArray() @ArrayUnique() @IsEmail({}, { each: true })
  ccEmails!: string[];
}
