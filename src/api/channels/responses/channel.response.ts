import { Channel } from './../schemas/channel.schema';
import myzod, { Infer } from 'myzod';

const ChannelResponseSchema = myzod.object({
  id: myzod.string(),
  guild_id: myzod.string().optional(),
  type: myzod.number(),
  owner_id: myzod.string().optional(),
  recipients: myzod.array(myzod.unknown()).optional(),
  parent_id: myzod.string().optional(),
  position: myzod.number().optional(),
  name: myzod.string().optional(),
  topic: myzod.string().optional(),
  icon: myzod.string().optional(),
  permission_overwrites: myzod.array(myzod.unknown()).optional(),
  nsfw: myzod.boolean().optional(),
  bitrate: myzod.number().optional(),
  user_limit: myzod.number().optional(),
  rate_limit_per_user: myzod.number().optional(),
  pinned_messages_ids: myzod.array(myzod.unknown())
});

export type ChannelResponse = Infer<typeof ChannelResponseSchema>;

export const ChannelResponseValidate = (channel: Channel) => { return<ChannelResponse> ChannelResponseSchema.allowUnknownKeys().parse(channel) }
