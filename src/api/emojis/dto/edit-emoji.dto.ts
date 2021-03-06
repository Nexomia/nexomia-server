import { IsArray, IsString, Length, IsOptional } from 'class-validator'

export class EditEmojiDto {
  @IsOptional()
  @IsString()
  @Length(1, 35)
  name: string

  @IsOptional()
  @IsArray()
  @Length(0, 3)
  words: string[]
}
