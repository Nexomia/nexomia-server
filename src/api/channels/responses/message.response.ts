import { FileDocument } from './../../files/schemas/file.schema';
import { User } from 'src/api/users/schemas/user.schema';
import { Message, Attachment } from './../schemas/message.schema';
import myzod, { Infer } from 'myzod';

const MessageResponseSchema = myzod.object({
  id: myzod.string(),
  guild_id: myzod.string().optional(),
  channel_id: myzod.string(),
  author: myzod.string(),
  user: myzod.unknown(),
  content: myzod.string().optional(),
  type: myzod.number(),
  created: myzod.number(),
  edited: myzod.boolean(),
  edit_time: myzod.number().optional(),
  sticker: myzod.string().optional(),
  embeds: myzod.array(myzod.unknown()),
  mentions: myzod.array(myzod.string()),
  reactions:myzod.array(myzod.unknown()),
  attachments: myzod.array(myzod.unknown()),
  allow_forwarding: myzod.boolean().optional(),
  forwarded_ids: myzod.array(myzod.string()).optional(),
  forwarded_messages: myzod.array(myzod.unknown()).optional(),
});

export type MessageResponse = Infer<typeof MessageResponseSchema>
export const MessageResponseValidate = (message: Message) => { return<MessageResponse> MessageResponseSchema.allowUnknownKeys().parse(message) }

const MessageUserSchema = myzod.object({
  id: myzod.string(),
  username: myzod.string(),
  discriminator: myzod.string(),
  avatar: myzod.string().optional()
})

export type MessageUser = Infer<typeof MessageUserSchema>
export const MessageUserValidate = (user: User) => { return<MessageUser> MessageUserSchema.allowUnknownKeys().parse(user) }

const MessageAttachmentSchema = myzod.object({
  id: myzod.string(),
  name: myzod.string(),
  mime_type: myzod.string(),
  size: myzod.number(),
  url: myzod.string(),
  preview: myzod.string().optional(),
  width: myzod.number().optional(),
  height: myzod.number().optional(),
})

export type MessageAttachment = Infer<typeof MessageAttachmentSchema>
export const MessageAttachmentValidate = (att: FileDocument) => { return<MessageAttachment> MessageAttachmentSchema.allowUnknownKeys().parse(att) }
