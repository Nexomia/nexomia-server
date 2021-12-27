import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

@Schema({ versionKey: false })
export class Channel {
  @Prop({ unique: true })
  id?: string

  @Prop()
  created?: number

  @Prop()
  type?: number

  @Prop()
  guild_id?: string

  @Prop()
  position?: number

  @Prop()
  permission_overwrites?: PermissionsOverwrite[]

  @Prop()
  name?: string

  @Prop()
  topic?: string

  @Prop()
  nsfw?: boolean

  @Prop()
  bitrate?: number

  @Prop()
  user_limit?: number

  @Prop()
  rate_limit_per_user?: number

  @Prop()
  recipients?: string[]

  @Prop()
  icon?: string

  @Prop()
  owner_id?: string

  @Prop()
  application_id?: string

  @Prop()
  parent_id?: string

  @Prop()
  pinned_messages_ids?: string[]

  @Prop()
  last_pin_timestamp?: number

  @Prop({ default: false })
  deleted?: boolean
}

export enum ChannelType {
  DM = 0,
  GROUP_DM = 1,
  GUILD_CATEGORY = 2,
  GUILD_TEXT = 3,
  GUILD_VOICE = 4,
  GUILD_NEWS = 5,
  GUILD_NEWS_THREAD = 6,
  GUILD_PUBLIC_THREAD = 7,
  GUILD_PRIVATE_THREAD = 8,
}

export class ChannelShort {
  id: string
  name: string
  type: number
}

export class PermissionsOverwrite {
  id?: string
  /**
   * 0 - role
   * 1 - member
   */
  type?: 0 | 1
  allow?: number
  deny?: number
}

export type ChannelDocument = Channel & Document

export const ChannelSchema = SchemaFactory.createForClass(Channel)
