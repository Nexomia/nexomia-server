import { IsArray, IsString, Length, IsOptional } from 'class-validator'

export class AddEmojiDto {
  @IsString()
  @Length(1, 35)
  name: string

  @IsString()
  file_id: string

  @IsOptional()
  @IsArray()
  @Length(0, 3)
  words: string[]
}
