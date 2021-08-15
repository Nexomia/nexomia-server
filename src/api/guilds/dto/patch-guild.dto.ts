import { IsBoolean, IsOptional, IsString, Length } from "class-validator"

export class PatchGuildDto {
  @IsOptional()
  @IsString()
  @Length(1, 20)
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsBoolean()
  closed?: boolean

  @IsOptional()
  @IsString()
  icon?: string

  @IsOptional()
  @IsString()
  banner?: string

  @IsOptional()
  @IsString()
  system_channel_id?: string

  @IsOptional()
  @IsString()
  default_channel?: string

  @IsOptional()
  @IsString()
  preferred_locale?: string
}
