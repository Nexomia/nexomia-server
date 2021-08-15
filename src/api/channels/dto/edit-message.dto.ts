import { IsNumberString, IsOptional } from 'class-validator';
import { AllowedMentions, Attachment, Embed, MessageReference } from './../schemas/message.schema';
export class EditMessageDto {

  @IsOptional()
  @IsNumberString()
  content?: string;

  @IsOptional()
  embed?: Embed;

  @IsOptional()
  @IsNumberString()
  flags?: number;

  @IsOptional()
  allowed_mentions?: AllowedMentions;

  @IsOptional()
  attachments?: Attachment[];
}
