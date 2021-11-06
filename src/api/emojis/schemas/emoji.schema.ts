import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { EmojiPackResponse } from './../responses/emojiPack.response'

export type EmojiDocument = Emoji & Document

@Schema()
export class Emoji {
  @Prop({ unique: true })
  id: string // emoji id
  @Prop()
  file_id: string // emoji file id

  @Prop()
  pack_id: string //where emoji from

  @Prop()
  name: string // emoji name

  @Prop()
  words: string[]

  @Prop()
  user_id: string

  @Prop({ default: false })
  animated?: boolean // whether this emoji is animated

  @Prop({ default: false })
  deleted: boolean

  url: string

  emoji_pack?: EmojiPackResponse
}

export const EmojiSchema = SchemaFactory.createForClass(Emoji)
