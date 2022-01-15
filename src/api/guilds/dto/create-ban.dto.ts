import { IsOptional, IsString, Length } from 'class-validator'

export class CreateBanDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  reason: string
}
