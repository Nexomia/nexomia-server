import { Role, RoleDocument } from './../guilds/schemas/role.schema';
import { Invite, InviteDocument } from './schemas/invite.schema';
import { Guild, GuildDocument, GuildShort, GuildMember } from './../guilds/schemas/guild.schema';
import { Channel, ChannelShort } from './../channels/schemas/channel.schema';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

class InviteRoot {
  channel: Channel[]
  guild: Guild[]
}
type InviteInfo = InviteRoot & InviteDocument

@Injectable()
export class InvitesService {
  constructor(
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

  async getInvite(inviteId): Promise<Invite> {
    const inviteInfo = (await this.inviteModel.aggregate<InviteInfo>([
      {
        $match: {
          code: inviteId
        }
      },
      {
        $lookup: {
          from: 'channels',
          localField: 'channel_id',
          foreignField: 'id',
          as: 'channel'
        }
      },
      {
        $lookup: {
          from: 'guilds',
          localField: 'guild_id',
          foreignField: 'id',
          as: 'guild'
        }
      }
    ]))[0]

    const guild: GuildShort = {
      id: inviteInfo.guild[0].id,
      name: inviteInfo.guild[0].name,
      members_count: inviteInfo.guild[0].members.length
    }
    const channel: ChannelShort = {
      id: inviteInfo.channel[0].id,
      name: inviteInfo.channel[0].name,
      type: inviteInfo.channel[0].type
    }
    const invite = {
      code: inviteInfo.code,
      guild,
      channel
    }
    return invite
  }

  async accept(inviteId, userId): Promise<Guild> {
    const invite = await this.inviteModel.findOne({ code: inviteId })
    if (!invite || invite.uses === invite.max_uses) throw new NotFoundException()
    const guild = await this.guildModel.findOne({ id: invite.guild_id, 'members.id': { $ne: userId } })
    if (!guild) throw new BadRequestException()
    
    const member: GuildMember = {
      id: userId,
      joined_at: Date.now(),
      mute: false,
      deaf: false
    }
    guild.members.push(member)
    await guild.save()
    const updatedGuild = guild.toObject()
    await this.roleModel.updateOne(
      { id: guild.roles[0] },
      { $push: { members: userId } }
    )
    delete updatedGuild.members
    return updatedGuild
  }
}
