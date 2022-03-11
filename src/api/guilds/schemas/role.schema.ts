import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type RoleDocument = Role & Document

export class Permissions {
  allow: number
  deny: number
}

@Schema({ versionKey: false })
export class Role {
  @Prop({ unique: true })
  id?: string

  @Prop()
  guild_id: string

  @Prop({ default: 'new role' })
  name?: string

  @Prop()
  members: string[]

  @Prop()
  permissions: Permissions

  @Prop({ default: '#fff' })
  color?: string

  @Prop({ default: false })
  hoist?: boolean

  @Prop()
  position?: number

  @Prop({ default: true })
  mentionable?: boolean

  @Prop({ default: false })
  default?: boolean

  @Prop({ default: false })
  deleted?: boolean
}

export const RoleSchema = SchemaFactory.createForClass(Role)

export enum ComputedPermissions {
  OWNER = 1 << 0,
  ADMINISTRATOR = 1 << 1,
  CHANGE_MEMBER_NICKNAMES = 1 << 2,
  CREATE_INVITES = 1 << 3,
  MANAGE_ROLES = 1 << 4,
  MANAGE_GUILD = 1 << 5,
  MANAGE_EMOJIS = 1 << 6,
  MANAGE_MESSAGES = 1 << 7,
  READ_MESSAGES = 1 << 8,
  WRITE_MESSAGES = 1 << 9,
  VOICE_MESSAGES = 1 << 10,
  ATTACH_STICKERS = 1 << 11,
  ATTACH_FILES = 1 << 12,
  USE_EXTENDED_MARKDOWN = 1 << 13,
  FORWARD_MESSAGES_FROM_SERVER = 1 << 14,
  VIEW_CHANNEL = 1 << 15,
  CHANGE_SELF_NICKNAME = 1 << 16,
  ADD_REACTIONS = 1 << 17,
  ADD_EXTERNAL_REACTIONS = 1 << 18,
  BULK_DELETE = 1 << 19,
  MANAGE_CHANNELS = 1 << 20,
  MANAGE_MEMBERS = 1 << 21,
}
