import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type EmojiDocument = Emoji & Document

@Schema()
export class Emoji {
  @Prop({ unique: true })
  id?: string // emoji id

  @Prop()
  name?: string // emoji name

  @Prop()
  roles?: string[] // roles allowed to use this emoji

  @Prop()
  owner_id: string // user object	user that created this emoji

  @Prop()
  owner: boolean // 0 - user, 1 - server

  @Prop()
  require_colons?: boolean // whether this emoji must be wrapped in colons

  @Prop()
  managed?: boolean // whether this emoji is managed

  @Prop()
  animated?: boolean // whether this emoji is animated

  @Prop()
  available?: boolean // whether this emoji can be used, may be false due to loss of Server Boosts
}

export const EmojiSchema = SchemaFactory.createForClass(Emoji)
