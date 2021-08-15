import { IsDate, IsEmail, IsOptional, IsString, Length } from "class-validator";

export class RegAuthDto {
  @IsEmail()
  email: string;

  @Length(1, 20)
  username: string;

  @Length(6, 30)
  password: string;

  @IsOptional()
  @IsString()
  invite?: string;

  @IsOptional()
  @IsDate()
  date_of_birth?: string;
}
