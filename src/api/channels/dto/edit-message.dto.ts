import { IsArray, IsNumberString, IsOptional } from 'class-validator';
import { AllowedMentions, Attachment, Embed } from './../schemas/message.schema';
export class EditMessageDto {
  @IsOptional()
  @IsNumberString()
  content?: string;

  @IsOptional()
  embed?: Embed;

  @IsOptional()
  allowed_mentions?: AllowedMentions;

  @IsOptional()
  attachments?: Attachment[];

  @IsOptional()
  @IsArray()
  forwarded_messages?: string[];
}
