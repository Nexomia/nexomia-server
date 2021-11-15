import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { EmojiPackOwnerResponse } from './../responses/emojiPack.response'
import { EmojiResponse } from './../responses/emoji.response'

export type EmojiPackDocument = EmojiPack & Document

export class EmojiPackOwnerInfo {
  id: string
  username: string
  discriminator: string
  avatar: string
  status: string
}

export class EmojiPackAccess {
  open_for_new_users: boolean
  allowedUsers?: string[]
  disallowedUsers?: string[]
}
const defaultAccess: EmojiPackAccess = {
  open_for_new_users: false,
}

export class EmojiPackStats {
  users: number
  servers: number
}

@Schema()
export class EmojiPack {
  @Prop({ unique: true })
  id: string

  @Prop()
  type: EmojiPackType

  @Prop()
  name: string

  @Prop()
  icon?: string

  @Prop({ default: '' })
  description?: string

  @Prop({ default: defaultAccess })
  access: EmojiPackAccess

  @Prop()
  owner_id: string

  owner?: EmojiPackOwnerResponse

  stats?: EmojiPackStats

  emojis?: EmojiResponse[]
}

export const EmojiPackSchema = SchemaFactory.createForClass(EmojiPack)

export enum EmojiPackType {
  EMOJI = 0,
  STICKER = 1,
}
