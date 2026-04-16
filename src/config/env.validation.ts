import { plainToInstance } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvVars {
  @IsInt() APP_PORT!: number;

  @IsString() JWT_SECRET!: string;
  @IsString() JWT_EXPIRES!: string;
  @IsBooleanString() COOKIE_SECURE!: string;

  @IsString() DB_HOST!: string;
  @IsInt() DB_PORT!: number;
  @IsString() DB_USER!: string;
  @IsOptional() @IsString() DB_PASS?: string;
  @IsString() DB_NAME!: string;

  @IsString() SMTP_HOST!: string;
  @IsInt() SMTP_PORT!: number;
  @IsString() SMTP_USER!: string;
  @IsString() SMTP_PASS!: string;
  @IsString() SMTP_FROM!: string;

  @IsString() PDF_STORAGE_DIR!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) throw new Error(errors.toString());
  return validated;
}
