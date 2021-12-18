import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Injectable,
  NotFoundException,
  Inject,
  CACHE_MANAGER,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Cache } from 'cache-manager'
import { GuildResponseValidate } from './../guilds/responses/guild.response'
import { RoleResponseValidate } from './../guilds/responses/role.response'
import { ChannelResponseValidate } from './../channels/responses/channel.response'
import { MessageType } from './../channels/schemas/message.schema'
import { ChannelsService } from './../channels/channels.service'
import { Role, RoleDocument } from './../guilds/schemas/role.schema'
import { Invite, InviteDocument } from './schemas/invite.schema'
import {
  Guild,
  GuildDocument,
  GuildShort,
  GuildMember,
} from './../guilds/schemas/guild.schema'
import { Channel, ChannelShort } from './../channels/schemas/channel.schema'

class InviteRoot {
  channel: Channel[]
  guild: Guild[]
}

type InviteData = InviteRoot & InviteDocument

export class InviteInfo {
  code: string
  channel: ChannelShort
  guild: GuildShort
}

@Injectable()
export class InvitesService {
  constructor(
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private channelService: ChannelsService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getInvite(inviteId): Promise<InviteInfo> {
    const inviteData = (
      await this.inviteModel.aggregate<InviteData>([
        {
          $match: {
            code: inviteId,
          },
        },
        {
          $lookup: {
            from: 'channels',
            localField: 'channel_id',
            foreignField: 'id',
            as: 'channel',
          },
        },
        {
          $lookup: {
            from: 'guilds',
            localField: 'guild_id',
            foreignField: 'id',
            as: 'guild',
          },
        },
      ])
    )[0]

    const guild: GuildShort = {
      id: inviteData.guild[0].id,
      name: inviteData.guild[0].name,
      members_count: inviteData.guild[0].members.length,
      online_members_count: JSON.parse(
        (await this.onlineManager.get(inviteData.guild[0].id)) || '[]',
      ).length,
      icon: inviteData.guild[0].icon,
    }
    const channel: ChannelShort = {
      id: inviteData.channel[0].id,
      name: inviteData.channel[0].name,
      type: inviteData.channel[0].type,
    }
    const invite = {
      code: inviteData.code,
      guild,
      channel,
    }
    return invite
  }

  async accept(inviteId, userId): Promise<Guild> {
    const invite = await this.inviteModel.findOne({ code: inviteId })
    if (!invite || invite.uses === invite.max_uses)
      throw new NotFoundException()
    const guild = (
      await this.guildModel.aggregate([
        {
          $match: {
            id: invite.guild_id,
            'members.id': { $ne: userId },
          },
        },
        {
          $lookup: {
            from: 'channels',
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$guild_id', invite.guild_id],
                  },
                },
              },
            ],
            as: 'channels',
          },
        },
        {
          $lookup: {
            from: 'roles',
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$guild_id', invite.guild_id],
                  },
                },
              },
            ],
            as: 'roles',
          },
        },
      ])
    )[0]

    if (!guild) throw new NotFoundException()

    const member: GuildMember = {
      id: userId,
      joined_at: Date.now(),
      mute: false,
      deaf: false,
      allow_dms: true,
      permissions: {
        allow: 0,
        deny: 0,
      },
    }

    await this.guildModel.updateOne(
      { id: guild.id },
      { $push: { members: member } },
    )
    await this.roleModel.updateOne(
      { guild_id: guild.id, default: true },
      { $push: { members: userId } },
    )

    invite.uses++
    invite.user_ids.push(userId)
    await invite.save()

    if (guild.default_channel !== '')
      this.channelService.createMessage(
        userId,
        guild.default_channel,
        {},
        { type: MessageType.JOIN },
      )

    const data = {
      event: 'guild.user_joined',
      data: {
        id: userId,
        guild: guild.id,
      },
    }
    this.eventEmitter.emit('guild.user_joined', data, guild.id)
    if (await this.onlineManager.get(userId)) {
      const membersStr: string = await this.onlineManager.get(guild.id)
      let members: string[] = []
      if (membersStr) members = members.concat(JSON.parse(membersStr))
      members.push(userId)
      await this.onlineManager.set(guild.id, JSON.stringify(members))
    }

    guild.channels.map((channel) => {
      return ChannelResponseValidate(channel)
    })
    guild.roles.map((role) => {
      return RoleResponseValidate(role)
    })
    return GuildResponseValidate(guild)
  }
}
