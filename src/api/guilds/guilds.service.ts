import { User } from 'src/api/users/schemas/user.schema';
import { Role, RoleDocument } from './schemas/role.schema';
import { config } from './../../app.config';
import { CreateChannelDto } from './dto/create-channel.dto';
import { Channel, ChannelDocument, ChannelType } from './../channels/schemas/channel.schema';
import { Guild, GuildDocument, GuildMember } from './schemas/guild.schema';
import { CreateGuildDto } from './dto/create-guild.dto';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UniqueID } from 'nodejs-snowflake';

@Injectable()
export class GuildsService {
  constructor(
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

  async getGuild(guildId, userId): Promise<Guild> {
    const guild = await this.guildModel.findOne({ id: guildId, 'members.id': userId }).select('-_id -members').lean()
    if (!guild) throw new NotFoundException()

    return guild
  }

  async create(guildDto: CreateGuildDto, userId: string): Promise<Guild> {
    if (!guildDto.name) throw new BadRequestException()
    
    const guild = new this.guildModel()
    guild.id = new UniqueID(config.snowflake).getUniqueID()
    guild.name = guildDto.name
    guild.owner_id = userId
    // иконку немного позже
    const member: GuildMember = {
      id: userId,
      joined_at: Date.now(),
      mute: false,
      deaf: false
    }
    guild.members.push(member)

    const role = new this.roleModel()
    role.id = new UniqueID(config.snowflake).getUniqueID()
    role.name = '@everyone'
    role.members.push(userId)
    role.guild_id = guild.id
    await role.save()

    guild.roles.push(role.id)
    await guild.save()
    const { _id, ...cleanedGuild } = guild.toObject()

    return cleanedGuild

    // Тут надо будет дописать доп функционал для создания  сервера с канлами, ролями, кароч что-то ака шаблонов
  }

  async createChannel(guildId: string, channelDto: CreateChannelDto, userId: string): Promise<Channel> {
    const channel = new this.channelModel()
    channel.id = new UniqueID(config.snowflake).getUniqueID()
    channel.name = channelDto.name
    channel.type = ChannelType.GUILD_TEXT
    channel.guild_id = guildId
    channel.nsfw = channelDto.nsfw
    if (channelDto.topic) channel.topic = channelDto.topic
    if (channelDto.position) channel.position = channelDto.position
    if (channelDto.parent_id) channel.parent_id = channelDto.parent_id
    if (channelDto.rate_limit_per_user) channel.rate_limit_per_user = channelDto.rate_limit_per_user

    if (channelDto.type === ChannelType.GUILD_VOICE) {
      if (channelDto.bitrate) channel.bitrate = channelDto.bitrate
      if (channelDto.user_limit) channel.user_limit = channelDto.user_limit
    }
    await channel.save()
    const { _id, ...cleanedChannel } = channel.toObject()
    return cleanedChannel
  }

  async getChannels(guildId): Promise<Channel[]> {
    return await this.channelModel.find({ guild_id: guildId }).select('-_id').lean()
  }

  async getMembers(guildId, userId): Promise<ExtendedMember[]> {
    const guild: ExtendedGuild = (await this.guildModel.aggregate([
      {
        $match: {
          id: guildId,
          'members.id': userId
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'members.id',
          foreignField: 'id',
          as: 'users'
      }
    },
    {
      $project: {
        'members': 1,
        'users.id': 1,
        'users.username': 1,
        'users.discriminator': 1,
        'users.avatar': 1,
        'users.verified': 1,
        'users.flags': 1,
        'users.premium_type': 1,
        'users.public_flags': 1
      }
    }
    ]))[0]

    for (let member in guild.members)
      guild.members[member].user = guild.users[member]

    return guild.members
  }
}

export class ExtendedGuild extends Guild {
  users: User[]
  members: ExtendedMember[]
}

export class ExtendedMember extends GuildMember {
  user: User
}
