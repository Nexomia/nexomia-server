import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator'

export class PatchChannelDto {
  /**
   * Channel name (2-100 characters)
   */
  @IsOptional()
  @IsString()
  @Length(1, 20)
  name?: string

  /**
   * Channel topic (0-1024 characters)
   */
  @IsOptional()
  @IsString()
  topic?: string

  /**
   * The bitrate (in bits) of the voice channel (voice only)
   */
  @IsOptional()
  @IsInt()
  bitrate?: number

  /**
   * The user limit of the voice channel (voice only)
   */
  @IsOptional()
  @IsNumber()
  user_limit?: number

  /**
   * Amount of seconds a user has to wait before sending another message (0-21600); bots, as well as users with the permission
   */
  @IsOptional()
  @IsNumber()
  rate_limit_per_user?: number

  /**
   * Sorting position of the channel
   */
  @IsOptional()
  @IsNumber()
  position?: number

  /**
   * Id of the parent category for a channel
   */
  @IsOptional()
  @IsString()
  parent_id?: string

  /**
   * Whether the channel is nsfw
   */
  @IsOptional()
  @IsBoolean()
  nsfw?: boolean
}
