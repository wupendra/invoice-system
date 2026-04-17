import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsEmail() email!: string;
  @IsIn(['admin', 'viewer']) role!: 'admin' | 'viewer';
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
