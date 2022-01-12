import { IsOptional, IsString, Length } from 'class-validator'

export class CreateBanDto {
  @IsString()
  user_id: string

  @IsOptional()
  @IsString()
  @Length(1, 100)
  reason: string
}
