import { IsOptional, IsString, IsNumber, IsArray, Length } from 'class-validator';
import { Channel } from './../../channels/schemas/channel.schema';
export class CreateGuildDto {

  /**
   * Name of the guild (2-100 characters)
   */
  @IsString()
  @Length(1, 20)
  name: string;

  /**
   * Voice region id
   */
  @IsOptional()
  @IsString()
  region?: string;

  /**
   * Base64 128x128 image for the guild icon
   */
  @IsOptional()
  @IsString()
  icon?: string;

  /**
   * Verification level
   */
  @IsOptional()
  @IsNumber()
  verification_level?: number;

  /**
   * Default message notification level
   */
  @IsOptional()
  @IsNumber()
  default_message_notifications?: number;

  /**
   * Explicit content filter level
   */
  @IsOptional()
  @IsNumber()
  explicit_content_filter?: number;

  /**
   * New guild roles
   */
  // roles?: Role[];

  /**
   * New guild's channels
   */
  @IsOptional()
  @IsArray()
  channels?: Channel[];


  /**
   * Id for afk channel
   */
  @IsOptional()
  @IsString()
  afk_channel_id?: string;

  /**
   * Afk timeout in seconds
   */
  @IsOptional()
  @IsNumber()
  afk_timeout?: number;

  /**
   * The id of the channel where guild notices such as welcome messages and boost events are posted
   */
  @IsOptional()
  @IsString()
  system_channel_id?: string;

  /**
   * System channel flags
   */
  @IsOptional()
  @IsNumber()
  system_channel_flags?: number;
}