import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { NotifyState } from './../../channels/schemas/channel.schema'
import { MessageUser } from './../../channels/responses/message.response'
import { EmojiPackResponse } from './../../emojis/responses/emojiPack.response'
import { Permissions } from './role.schema'

@Schema({ versionKey: false })
export class Guild {
  /**
   * Guild id
   */
  @Prop({ unique: true })
  id?: string

  /**
   * Guild name (2-100 characters, excluding trailing and leading whitespace)
   */
  @Prop()
  name?: string

  /**
   * When this message was sent
   */
  @Prop()
  created?: number

  /**
   * Icon hash
   */
  @Prop()
  icon?: string

  /**
   * Id of owner
   */
  @Prop()
  owner_id?: string

  /**
   * Voice region id for the guild
   */
  @Prop()
  region?: string

  /**
   * Id of afk channel
   */
  @Prop()
  afk_channel_id?: string

  /**
   * Afk timeout in seconds
   */
  @Prop()
  afk_timeout?: number

  /**
   * True if the server widget is enabled
   */
  @Prop()
  widget_enabled?: boolean

  /**
   * The channel id that the widget will generate an invite to, or @type { null } if set to no invite
   */
  @Prop()
  widget_channel_id?: string | null

  /**
   * Verification level required for the guild
   */
  @Prop()
  verification_level?: number

  /**
   * default message notifications level
   */
  @Prop()
  default_message_notifications?: NotifyState

  /**
   * Guild's default channel
   */
  @Prop()
  default_channel?: string

  /**
   * Enabled guild features
   */
  @Prop()
  features?: number

  /**
   * Required MFA level for the guild
   */
  @Prop()
  mfa_level?: number

  /**
   * Application id of the guild creator if it is bot-created
   */
  @Prop()
  application_id?: string

  /**
   * The id of the channel where guild notices such as welcome messages and boost events are posted
   */
  @Prop()
  system_channel_id?: string

  /**
   * System channel flags
   */
  @Prop()
  system_channel_flags?: number

  /**
   * The id of the channel where Community guilds can display rules and/or guidelines
   */
  @Prop()
  rules_channel_id?: string

  /**
   * Users in the guild
   */
  @Prop()
  members?: GuildMember[]

  /**
   * The vanity url code for the guild
   */
  @Prop()
  vanity_url_code?: string

  /**
   * The description for the guild, if the guild is discoverable
   */
  @Prop()
  description?: string

  /**
   * Banner
   */
  @Prop()
  banner?: string

  /**
   * The preferred locale of a Community guild; used in server discovery and notices from Nexomia
   */
  @Prop()
  preferred_locale?: string

  /**
   * The id of the channel where admins and moderators of Community guilds receive notices from Nexomia
   */
  @Prop()
  public_updates_channel_id?: string

  /**
   * The maximum amount of users in a video channel
   */
  @Prop()
  max_video_channel_users?: number

  /**
   * True if this guild is designated as NSFW
   */
  @Prop()
  nsfw?: boolean

  @Prop({ default: false })
  deleted?: boolean

  @Prop()
  emoji_packs_ids?: string[]

  @Prop()
  bans?: GuildBan[]

  emoji_packs?: EmojiPackResponse[]

  unread?: boolean
}

export class GuildShort {
  id: string
  name: string
  members_count: number
  online_members_count: number
  icon?: string
}

export class GuildMember {
  id: string
  nickname?: string
  joined_at: number
  mute: boolean
  deaf: boolean
  allow_dms: boolean
  permissions?: Permissions
}

export class GuildBan {
  user_id?: string
  reason?: string
  banned_by?: string
  date?: number
  users?: MessageUser[]
}

export type GuildDocument = Guild & Document

export const GuildSchema = SchemaFactory.createForClass(Guild)
