import { Guild } from 'api/guilds/schemas/guild.schema'
import myzod, { Infer } from 'myzod'
import { User } from './../../users/schemas/user.schema'

const GuildResponseSchema = myzod.object({
  id: myzod.string(),
  owner_id: myzod.string(),
  name: myzod.string(),
  description: myzod.string().optional(),
  icon: myzod.string().optional(),
  banner: myzod.string().optional(),
  afk_channel_id: myzod.string().optional(),
  afk_timeout: myzod.number().optional(),
  default_channel: myzod.string().optional(),
  default_message_notifications: myzod.number().optional(),
  features: myzod.number().optional(),
  system_channel_id: myzod.string().optional(),
  rules_channel_id: myzod.string().optional(),
  vanity_url_code: myzod.string().optional(),
  preferred_locale: myzod.string().optional(),
  nsfw: myzod.boolean().optional(),
  channels: myzod.unknown().optional(),
  roles: myzod.unknown().optional(),
})

export type GuildResponse = Infer<typeof GuildResponseSchema>

export const GuildResponseValidate = (guild: Guild) => {
  return <GuildResponse>GuildResponseSchema.allowUnknownKeys().parse(guild)
}

const MemberUserResponseSchema = myzod.object({
  id: myzod.string(),
  username: myzod.string(),
  discriminator: myzod.string(),
  avatar: myzod.string().optional(),
})

export type MemberResponse = Infer<typeof MemberUserResponseSchema>

export const MemberUserResponseValidate = (user: User) => {
  return <MemberResponse>MemberUserResponseSchema.allowUnknownKeys().parse(user)
}
