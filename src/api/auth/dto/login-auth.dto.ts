import { IsEmail, IsOptional, Length } from 'class-validator'

export class LoginUserDto {
  @IsEmail()
  login: string

  @Length(6, 30)
  password: string

  @IsOptional()
  @Length(4, 4)
  code?: string
}
