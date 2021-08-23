import { RoleResponse, RoleResponseValidate } from './responses/role.response';
import { GuildResponse, GuildResponseValidate } from './responses/guild.response';
import { ChannelResponse, ChannelResponseValidate } from './../channels/responses/channel.response';
import { UserDocument } from './../users/schemas/user.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PatchGuildDto } from './dto/patch-guild.dto';
import { RoleDto } from './dto/role.dto';
import { User } from 'src/api/users/schemas/user.schema';
import { Role, RoleDocument, ComputedPermissions } from './schemas/role.schema';
import { config } from './../../app.config';
import { CreateChannelDto } from './dto/create-channel.dto';
import { Channel, ChannelDocument, ChannelType } from './../channels/schemas/channel.schema';
import { Guild, GuildDocument, GuildMember } from './schemas/guild.schema';
import { CreateGuildDto } from './dto/create-guild.dto';
import { Injectable, BadRequestException, NotFoundException, Inject, CACHE_MANAGER } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UniqueID } from 'nodejs-snowflake';
import { Cache } from 'cache-manager';

@Injectable()
export class GuildsService {
  constructor(
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  async getGuild(guildId, userId): Promise<Guild> {
    const guild = await this.guildModel.findOne({ id: guildId, 'members.id': userId }).select('-_id -members').lean()
    if (!guild) throw new NotFoundException()

    return guild
  }

  async create(guildDto: CreateGuildDto, userId: string): Promise<GuildResponse> {
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
      deaf: false,
      permissions: {
        allow: 0,
        deny: 0
      }
    }
    guild.members.push(member)

    const role = new this.roleModel()
    role.id = new UniqueID(config.snowflake).getUniqueID()
    role.name = 'everyone'
    role.members.push(userId)
    role.guild_id = guild.id
    role.default = true
    role.hoist = true
    role.position = 999 // I won't force this role to bottom every time creates new one
    role.permissions = {
      allow: 253696,
      deny: 0
    }
    await role.save()

    await guild.save()

    return GuildResponseValidate(guild.toObject())

    // Тут надо будет дописать доп функционал для создания  сервера с канлами, ролями, кароч что-то ака шаблонов
  }

  async patchGuild(guildId: string, patchGuildDto: PatchGuildDto): Promise<GuildResponse> {
    const guild = await this.guildModel.findOne({ id: guildId })
    if (patchGuildDto.name && patchGuildDto.name !== guild.name)
      guild.name = patchGuildDto.name
    if (patchGuildDto.description && patchGuildDto.description !== guild.name)
      guild.description = patchGuildDto.description
    if (patchGuildDto.system_channel_id && patchGuildDto.system_channel_id !== guild.system_channel_id) {
      if (await this.channelModel.exists({ guild_id: guild.id, id: patchGuildDto.system_channel_id }))
        guild.system_channel_id = patchGuildDto.system_channel_id
    }
    if (patchGuildDto.default_channel && patchGuildDto.default_channel !== guild.default_channel) {
      if (await this.channelModel.exists({ guild_id: guild.id, id: patchGuildDto.default_channel }))
        guild.default_channel = patchGuildDto.default_channel
    }
    if (patchGuildDto.icon && patchGuildDto.icon !== guild.icon) //will change later
      guild.icon = patchGuildDto.icon
    if (patchGuildDto.banner && patchGuildDto.banner !== guild.banner) //will change later
      guild.banner = patchGuildDto.banner
    if (patchGuildDto.preferred_locale && patchGuildDto.preferred_locale !== guild.preferred_locale) //will change later
      guild.preferred_locale = patchGuildDto.preferred_locale
    await guild.save()
    const cleanedGuild: GuildResponse = GuildResponseValidate(guild.toObject())

    const data = {
      event: 'guild.patched',
      data: cleanedGuild
    }
    this.eventEmitter.emit(
      'guild.patched',
      data, 
      guildId
    )
    return cleanedGuild
  }

  async createChannel(guildId: string, channelDto: CreateChannelDto): Promise<ChannelResponse> {
    if (channelDto.type < 2) throw new BadRequestException()
    const channel = new this.channelModel()
    channel.id = new UniqueID(config.snowflake).getUniqueID()
    channel.name = channelDto.name
    channel.type = channelDto.type
    channel.guild_id = guildId

    if (channelDto.type === ChannelType.GUILD_TEXT) {
      channel.nsfw = channelDto.nsfw
      if (channelDto.topic) channel.topic = channelDto.topic
      if (channelDto.rate_limit_per_user) channel.rate_limit_per_user = channelDto.rate_limit_per_user
    }

    if (channelDto.type === ChannelType.GUILD_VOICE) {
      if (channelDto.bitrate) channel.bitrate = channelDto.bitrate
      if (channelDto.user_limit) channel.user_limit = channelDto.user_limit
    }

    if (channelDto.position) channel.position = channelDto.position
    if (channelDto.parent_id) channel.parent_id = channelDto.parent_id

    await channel.save()
    const cleanedChannel = ChannelResponseValidate(channel.toObject())

    const data = {
      event: 'guild.channel_created',
      data: cleanedChannel
    }
    this.eventEmitter.emit(
      'guild.channel_created',
      data, 
      guildId
    )

    return cleanedChannel
  }

  async getChannels(guildId): Promise<ChannelResponse[]> {
    return (await this.channelModel.find({ guild_id: guildId }).select('-_id')).map(channel => { return ChannelResponseValidate(channel) })
  }

  async getMembers(guildId, userId): Promise<ExtendedMember[]> {
    const guild: ExtendedGuild = (await this.guildModel.aggregate([
      {
        $match: {
          id: guildId,
        }
      },
      { $unwind: '$members' },
      { $sort: { 'members.id': 1 } },
      { $group: { _id: '$id', members: { $push: '$members' } } },
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
        'users.description': 1,
        'users.status': 1,
        'users.presence': 1,
        'users.avatar': 1,
        'users.banner': 1,
        'users.premium_type': 1,
        'users.public_flags': 1
      }
    }
    ]))[0]
    
    for (let member in guild.members) {
      guild.members[member].user = guild.users[member]
      guild.members[member].user.connected = !!(await this.onlineManager.get(guild.members[member].id) && guild.users[member].presence !== 4)
    }
    return guild.members
  }

  async getMember(guildId, userId): Promise<ExtendedMember> {
    let member =  (await this.guildModel.findOne({ id: guildId, 'members.id': userId }, 'members.$')).members[0]
    const user = (await this.userModel.findOne({ id: userId }).select('-_id id username discriminator avatar banner description status presence premium_type public_flags')).toObject()
    let roles: string[] = []
    const rolesArray = (await this.roleModel.find({ guild_id: guildId, members: { $in: userId } }, 'id')).forEach(role => roles.push(role.id))
   const extendedMember = new ExtendedMember()
   extendedMember.id = member.id
   extendedMember.joined_at = member.joined_at
   extendedMember.nickname = member.nickname
   extendedMember.permissions = member.permissions
   extendedMember.mute = member.mute
   extendedMember.deaf = member.deaf
   extendedMember.user = user
   extendedMember.roles = roles
   extendedMember.user.connected = !!(await this.onlineManager.get(user.id) && user.presence !== 4)
   return extendedMember
  }

  async getRoles(guildId: string): Promise<RoleResponse[]> {
    return (await this.roleModel.find({ guild_id: guildId }).select('-_id').lean()).map(role => { return RoleResponseValidate(role) })
  }

  async getRole(guildId: string, roleId: string, userId): Promise<RoleResponse> {
    const role = (await this.roleModel.findOne({ id: roleId, guild_id: guildId }).select('-_id')).toObject()
    return RoleResponseValidate(role)
  }

  async createRole(guildId: string, createRoleDto: RoleDto): Promise<RoleResponse> {
    const count = await this.roleModel.countDocuments({ guild_id: guildId })
    const role = new this.roleModel()
    role.id = new UniqueID(config.snowflake).getUniqueID()
    role.guild_id = guildId
    role.position = createRoleDto?.position || count
    role.permissions = {
      allow: 0,
      deny: 0
    }
    if (createRoleDto.name) role.name = createRoleDto.name
    if (createRoleDto.color) role.color = createRoleDto.color
    if (createRoleDto.hoist) role.hoist = createRoleDto.hoist
    if (createRoleDto.mentionable) role.mentionable = createRoleDto.mentionable
    if (createRoleDto.permissions) {
      role.permissions.allow = createRoleDto.permissions.allow &= ~(createRoleDto.permissions.deny | ComputedPermissions.OWNER)
      role.permissions.deny = createRoleDto.permissions.deny
    }
    await role.save()
    const cleanedRole = RoleResponseValidate(role.toObject())

    const data = {
      event: 'guild.role_created',
      data: cleanedRole
    }
    this.eventEmitter.emit(
      'guild.role_created',
      data, 
      guildId
    )

    return cleanedRole
  }

  async patchRole(guildId: string, roleId: string, patchRoleDto: RoleDto): Promise<RoleResponse> {
    const role = await this.roleModel.findOne({ id: roleId, guild_id: guildId })
    if (patchRoleDto.name) role.name = patchRoleDto.name
    if (patchRoleDto.color) role.color = patchRoleDto.color
    if (patchRoleDto.hoist && !role.default) role.hoist = patchRoleDto.hoist
    if (patchRoleDto.mentionable) role.mentionable = patchRoleDto.mentionable
    if (patchRoleDto.permissions) {
      role.permissions.allow = patchRoleDto.permissions.allow &= ~(patchRoleDto.permissions.deny | ComputedPermissions.OWNER)
      role.permissions.deny = patchRoleDto.permissions.deny
    }
    if (patchRoleDto.position && !role.default && patchRoleDto.position !== role.position) {
      if (patchRoleDto.position < role.position)
        await this.roleModel.updateMany(
          { guild_id: role.guild_id, position: { $gte: patchRoleDto.position, $lt: role.position, $ne: 999 } },
          { $inc: { position: 1 } }
        )
      else
        await this.roleModel.updateMany(
          { guild_id: role.guild_id, position: { $lte: patchRoleDto.position, $gt: role.position, $ne: 999 } },
          { $inc: { position: -1 } }
        )
      role.position = patchRoleDto.position
    }
    role.markModified('permissions')
    await role.save()
    const cleanedRole = RoleResponseValidate(role.toObject())

    const data = {
      event: 'guild.role_patched',
      data: cleanedRole
    }
    this.eventEmitter.emit(
      'guild.role_patched',
      data, 
      guildId
    )

    return cleanedRole
  }
  async isMember(guildId: string, userId: string) {
    return await this.guildModel.exists({ id: guildId, 'members.id': userId })
  }
}

export class ExtendedGuild extends Guild {
  users: User[]
  members: ExtendedMember[]
  roles: Array<string[]>
}

export class ExtendedMember extends GuildMember {
  user: User
  roles: string[]
  сonnected: boolean
}
