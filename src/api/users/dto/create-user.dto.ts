import { IsEmail, IsString, Length } from 'class-validator'

export class CreateUserDto {
  @IsEmail()
  email: string

  @IsString()
  @Length(1, 20)
  name: string

  @IsString()
  @Length(6, 30)
  password: string
}
