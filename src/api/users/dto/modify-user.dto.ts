import { IsEmail, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
export class ModifyUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(6, 30)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(6, 30)
  new_password?: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  discriminator?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  banner?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  presence?: number;
}