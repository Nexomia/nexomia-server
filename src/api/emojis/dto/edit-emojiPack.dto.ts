import { IsString, Length, IsOptional, IsBoolean } from 'class-validator'

export class EditEmojiPackDto {
  @IsOptional()
  @IsString()
  @Length(1, 35)
  name: string

  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string

  @IsOptional()
  @IsString()
  icon?: string

  @IsOptional()
  @IsBoolean()
  open_for_new_users?: boolean
}
