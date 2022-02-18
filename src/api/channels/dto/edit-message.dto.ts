import { IsArray, IsOptional, IsString } from 'class-validator'
import { AllowedMentions, Attachment, Embed } from './../schemas/message.schema'
export class EditMessageDto {
  @IsOptional()
  @IsString()
  content?: string

  @IsOptional()
  embed?: Embed

  @IsOptional()
  allowed_mentions?: AllowedMentions

  @IsOptional()
  attachments?: Attachment[]

  @IsOptional()
  @IsArray()
  forwarded_messages?: string[]
}
