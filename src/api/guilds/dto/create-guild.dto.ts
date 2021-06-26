import { Channel } from './../../channels/schemas/channel.schema';
export class CreateGuildDto {

  /**
   * Name of the guild (2-100 characters)
   */
  name: string;

  /**
   * Voice region id
   */
  region?: string;

  /**
   * Base64 128x128 image for the guild icon
   */
  icon?: string;

  /**
   * Verification level
   */
  verification_level?: number;

  /**
   * Default message notification level
   */
  default_message_notifications?: number;

  /**
   * Explicit content filter level
   */
  explicit_content_filter?: number;

  /**
   * New guild roles
   */
  // roles?: Role[];

  /**
   * New guild's channels
   */
  channels?: Channel[];


  /**
   * Id for afk channel
   */
  afk_channel_id?: string;

  /**
   * Afk timeout in seconds
   */
  afk_timeout?: number;

  /**
   * The id of the channel where guild notices such as welcome messages and boost events are posted
   */
  system_channel_id?: string;

  /**
   * System channel flags
   */
  system_channel_flags?: number;
}