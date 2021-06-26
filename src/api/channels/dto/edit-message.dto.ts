import { AllowedMentions, Attachment, Embed, MessageReference } from './../schemas/message.schema';
export class EditMessageDto {
  /**
   * The message contents (up to 2000 characters)
   */
  content?: string;

  /**
   * The message contents (up to 2000 characters)
   */
  embed?: Embed;

  /**
   * The message contents (up to 2000 characters)
   */
  flags?: number;

  /**
   * The message contents (up to 2000 characters)
   */
  allowed_mentions?: AllowedMentions;

  /**
   * The message contents (up to 2000 characters)
   */
  attachments?: Attachment[];
}
