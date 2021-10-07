import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator'
import { AllowedMentions, Embed } from '../schemas/message.schema'
export class CreateMessageDto {
  /**
   * The message contents (up to 2000 characters)
   */
  @IsOptional()
  @IsString()
  content?: string

  /**
   * A nonce that can be used for optimistic message sending (up to 25 characters)
   */
  @IsOptional()
  @IsString()
  nonce?: string

  /**
   * True if this is a TTS message
   */
  @IsOptional()
  @IsBoolean()
  tts?: boolean

  /**
   * Embedded rich content
   */
  @IsOptional()
  embed?: Embed

  /**
   * Allowed mentions for a message
   */
  @IsOptional()
  allowed_mentions?: AllowedMentions

  @IsOptional()
  @IsBoolean()
  allow_forwarding?: boolean

  /**
   * Array of message ids what need to resent
   */
  @IsOptional()
  @IsArray()
  forwarded_messages?: string[]

  /**
   * Sticker id
   */
  @IsOptional()
  @IsString()
  sticker?: string

  @IsOptional()
  @IsArray()
  attachments?: string[]
}
