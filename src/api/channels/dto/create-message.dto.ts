import { AllowedMentions, Embed, MessageReference } from '../schemas/message.schema';
export class CreateMessageDto {
  /**
   * The message contents (up to 2000 characters)
   */
  content?: string;

  /**
   * A nonce that can be used for optimistic message sending (up to 25 characters)
   */
  nonce?: string | number;

  /**
   * True if this is a TTS message
   */
  tts?: boolean;

  /**
   * Embedded rich content
   */
  embed?: Embed;

  /**
   * Allowed mentions for a message
   */
  allowed_mentions?: AllowedMentions;

  /**
   * Array of message ids what need to resent
   */
  resents?: string[];

  /**
   * Sticker id
   */
  sticker?: string;

  attachments?: string[];
}
