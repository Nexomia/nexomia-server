import { IsString, Length, IsOptional, IsInt, Min, Max } from 'class-validator'
import { EmojiPackType } from './../schemas/emojiPack.schema'

export class CreateEmojiPackDto {
  @IsString()
  @Length(1, 35)
  name: string

  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string

  @IsInt()
  @Min(0)
  @Max(1)
  type: EmojiPackType

  @IsOptional()
  @IsString()
  icon?: string
}
