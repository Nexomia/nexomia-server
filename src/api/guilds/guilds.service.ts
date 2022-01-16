import { EventEmitter2 } from '@nestjs/event-emitter'
import { User } from 'api/users/schemas/user.schema'
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  CACHE_MANAGER,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { UniqueID } from 'nodejs-snowflake'
import { Cache } from 'cache-manager'
import { Invite, InviteDocument } from '../invites/schemas/invite.schema'
import { File, FileDocument } from '../files/schemas/file.schema'
import { MessageUserValidate } from './../channels/responses/message.response'
import { CreateBanDto } from './dto/create-ban.dto'
import { UpdatedChannelsPositionsValidate } from './responses/updated-positions.response'
import { PatchChannelDto } from './../channels/dto/patch-channel.dto'
import { OverwritePermissionsDto } from './../channels/dto/overwrite-permissions.dto'
import { Message, MessageDocument } from './../channels/schemas/message.schema'
import { ParserUtils } from './../../utils/parser/parser.utils'
import {
  EmojiPack,
  EmojiPackDocument,
} from './../emojis/schemas/emojiPack.schema'
import { FilesService } from './../files/files.service'
import { FileType } from './../files/schemas/file.schema'
import { UserResponse } from './../users/responses/user.response'
import { RoleResponse, RoleResponseValidate } from './responses/role.response'
import {
  GuildResponse,
  GuildResponseValidate,
  MemberUserResponseValidate,
} from './responses/guild.response'
import {
  ChannelResponse,
  ChannelResponseValidate,
} from './../channels/responses/channel.response'
import { UserDocument } from './../users/schemas/user.schema'
import { PatchGuildDto } from './dto/patch-guild.dto'
import { RoleDto } from './dto/role.dto'
import { Role, RoleDocument, ComputedPermissions } from './schemas/role.schema'
import { config } from './../../app.config'
import { CreateChannelDto } from './dto/create-channel.dto'
import {
  Channel,
  ChannelDocument,
  ChannelType,
  PermissionsOverwrite,
} from './../channels/schemas/channel.schema'
import {
  Guild,
  GuildDocument,
  GuildMember,
  GuildBan,
} from './schemas/guild.schema'
import { CreateGuildDto } from './dto/create-guild.dto'

@Injectable()
export class GuildsService {
  constructor(
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    @InjectModel(EmojiPack.name)
    private emojiPackModel: Model<EmojiPackDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private eventEmitter: EventEmitter2,
    private filesService: FilesService,
    private parser: ParserUtils,
  ) {}

  async getGuild(guildId, userId): Promise<Guild> {
    // const guild = await this.guildModel.findOne({ id: guildId, 'members.id': userId }).select('-_id -members').lean()
    const guild = (
      await this.guildModel.aggregate([
        {
          $match: {
            id: guildId,
            'members.id': userId,
          },
        },
        {
          $lookup: {
            from: 'channels',
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$guild_id', guildId],
                  },
                  deleted: false,
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
                    $eq: ['$guild_id', guildId],
                  },
                  deleted: false,
                },
              },
            ],
            as: 'roles',
          },
        },
        {
          $lookup: {
            from: 'emojipacks',
            localField: 'emoji_pack_ids',
            foreignField: 'id',
            as: 'emoji_packs',
          },
        },
        {
          $project: {
            bans: 0,
          },
        },
      ])
    )[0]
    if (!guild) throw new NotFoundException()

    return guild
  }

  async create(
    guildDto: CreateGuildDto,
    userId: string,
  ): Promise<GuildResponse> {
    if (!guildDto.name || guildDto.name.replaceAll(' ', '') === '')
      throw new BadRequestException()

    const guild = new this.guildModel()
    guild.id = new UniqueID(config.snowflake).getUniqueID()
    guild.name = guildDto.name.replaceAll(/(\s){2,}/gm, ' ')
    guild.owner_id = userId
    // иконку немного позже
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
      deny: 0,
    }
    await role.save()

    await guild.save()

    return GuildResponseValidate(guild.toObject())

    // Тут надо будет дописать доп функционал для создания  сервера с канлами, ролями, кароч что-то ака шаблонов
  }

  async patchGuild(
    guildId: string,
    patchGuildDto: PatchGuildDto,
    userId,
  ): Promise<GuildResponse> {
    const guild = await this.guildModel.findOne({ id: guildId })
    if (patchGuildDto.name && patchGuildDto.name !== guild.name)
      guild.name = patchGuildDto.name
    if (patchGuildDto.description && patchGuildDto.description !== guild.name)
      guild.description = patchGuildDto.description
    if (
      patchGuildDto.system_channel_id &&
      patchGuildDto.system_channel_id !== guild.system_channel_id
    ) {
      if (
        await this.channelModel.exists({
          guild_id: guild.id,
          id: patchGuildDto.system_channel_id,
        })
      )
        guild.system_channel_id = patchGuildDto.system_channel_id
    }
    if (
      patchGuildDto.default_channel &&
      patchGuildDto.default_channel !== guild.default_channel
    ) {
      if (
        await this.channelModel.exists({
          guild_id: guild.id,
          id: patchGuildDto.default_channel,
        })
      )
        guild.default_channel = patchGuildDto.default_channel
    }
    if (patchGuildDto.icon && patchGuildDto.icon !== guild.icon) {
      if (patchGuildDto.icon === '0') guild.icon = ''
      else {
        const file = await this.filesService.getFileInfo(patchGuildDto.icon)
        if (!file || file.type !== FileType.AVATAR)
          throw new BadRequestException()
        guild.icon = file.url
      }
    }
    if (patchGuildDto.banner && patchGuildDto.banner !== guild.banner) {
      if (patchGuildDto.banner === '0') guild.banner = ''
      else {
        const file = await this.filesService.getFileInfo(patchGuildDto.banner)
        if (!file || file.type !== FileType.BANNER)
          throw new BadRequestException()
        guild.banner = file.url
      }
    }
    if (
      patchGuildDto.preferred_locale &&
      patchGuildDto.preferred_locale !== guild.preferred_locale
    )
      //will change later
      guild.preferred_locale = patchGuildDto.preferred_locale
    await guild.save()
    const cleanedGuild: GuildResponse = GuildResponseValidate(guild.toObject())

    const data = {
      event: 'guild.patched',
      data: cleanedGuild,
    }
    this.eventEmitter.emit('guild.patched', data, guildId)
    return cleanedGuild
  }

  async createChannel(
    guildId: string,
    channelDto: CreateChannelDto,
  ): Promise<ChannelResponse> {
    if (channelDto.name.replaceAll(' ', '') === '')
      throw new BadRequestException()

    if (channelDto.type < 2) throw new BadRequestException()
    const channel = new this.channelModel()
    channel.id = new UniqueID(config.snowflake).getUniqueID()
    channel.name = channelDto.name.replaceAll(/(\s){2,}/gm, ' ')
    channel.type = channelDto.type
    channel.guild_id = guildId

    if (channelDto.type === ChannelType.GUILD_TEXT) {
      channel.nsfw = channelDto.nsfw
      if (channelDto.topic) channel.topic = channelDto.topic
      if (channelDto.rate_limit_per_user)
        channel.rate_limit_per_user = channelDto.rate_limit_per_user
    }

    if (channelDto.type === ChannelType.GUILD_VOICE) {
      if (channelDto.bitrate) channel.bitrate = channelDto.bitrate
      if (channelDto.user_limit) channel.user_limit = channelDto.user_limit
    }

    if (!channelDto.parent_id) channelDto.parent_id = '0'
    const parent = await this.channelModel.exists({
      id: channelDto.parent_id,
      type: ChannelType.GUILD_CATEGORY,
      deleted: false,
    })

    if (!parent) channelDto.parent_id = '0'
    const count = await this.channelModel.countDocuments({
      guild_id: channel.guild_id,
      parent_id: channelDto.parent_id,
      deleted: false,
    })

    channel.position = count + 1
    channel.parent_id = channelDto.parent_id

    await channel.save()
    const cleanedChannel = ChannelResponseValidate(channel.toObject())

    const data = {
      event: 'guild.channel_created',
      data: cleanedChannel,
    }
    this.eventEmitter.emit('guild.channel_created', data, guildId)

    return cleanedChannel
  }

  async getChannel(channelId: string): Promise<ChannelResponse> {
    const channel = await this.channelModel.findOne({
      id: channelId,
      deleted: false,
    })
    if (!channel) throw new NotFoundException()
    return ChannelResponseValidate(channel)
  }

  async editChannel(
    channelId: string,
    dto: PatchChannelDto,
  ): Promise<ChannelResponse> {
    const channel = await this.channelModel.findOne({
      id: channelId,
      deleted: false,
    })
    if (!channel) throw new NotFoundException()

    if (dto.name) channel.name = dto.name
    if (dto.topic) channel.topic = dto.topic
    if (channel.type === ChannelType.GUILD_VOICE) {
      if (dto.bitrate && dto.bitrate > 16) channel.bitrate = dto.bitrate
      if (dto.user_limit && dto.user_limit >= 0)
        channel.user_limit = dto.user_limit
    }
    if (
      channel.type < ChannelType.GUILD_VOICE &&
      channel.type !== ChannelType.GUILD_CATEGORY
    ) {
      if (dto.rate_limit_per_user && dto.rate_limit_per_user > 0)
        channel.rate_limit_per_user = dto.rate_limit_per_user
      if (dto.nsfw === true || dto.nsfw === false) channel.nsfw = dto.nsfw
    }

    let channels = []
    if (
      channel.type === ChannelType.GUILD_TEXT ||
      channel.type === ChannelType.GUILD_VOICE ||
      channel.type === ChannelType.GUILD_CATEGORY
    ) {
      if (dto.parent_id || dto.position) {
        if (!dto.parent_id) dto.parent_id = '0'
        const parent = await this.channelModel.exists({
          id: dto.parent_id,
          type: ChannelType.GUILD_CATEGORY,
          deleted: false,
        })

        const count = await this.channelModel.countDocuments({
          guild_id: channel.guild_id,
          parent_id: dto.parent_id,
          deleted: false,
        })

        if (
          !(dto.parent_id === channel.parent_id && count === 1) &&
          (parent || dto.parent_id === '0')
        ) {
          if (dto.position > count || dto.position <= 0)
            dto.position = count + 1

          if (dto.parent_id !== channel.parent_id) {
            channels = await this.channelModel.find(
              {
                $or: [
                  {
                    guild_id: channel.guild_id,
                    parent_id: channel.parent_id,
                    position: { $gte: channel.position },
                  },
                  {
                    guild_id: channel.guild_id,
                    parent_id: dto.parent_id,
                    position: { $gte: channel.position },
                  },
                ],
              },
              '-_id id',
            )
            console.log(channels)
            await this.channelModel.updateMany(
              {
                guild_id: channel.guild_id,
                parent_id: channel.parent_id,
                position: { $gt: channel.position },
              },
              { $inc: { position: -1 } },
            )

            await this.channelModel.updateMany(
              {
                guild_id: channel.guild_id,
                parent_id: dto.parent_id,
                position: { $gte: channel.position },
              },
              { $inc: { position: 1 } },
            )
            channel.position = dto.position
            channel.parent_id = dto.parent_id
          } else {
            if (dto.position > channel.position) {
              channels = await this.channelModel.find(
                {
                  guild_id: channel.guild_id,
                  parent_id: channel.parent_id,
                  $and: [
                    { position: { $lte: dto.position } },
                    { position: { $gt: channel.position } },
                  ],
                },
                'id',
              )
              await this.channelModel.updateMany(
                {
                  guild_id: channel.guild_id,
                  parent_id: channel.parent_id,
                  $and: [
                    { position: { $lte: dto.position } },
                    { position: { $gt: channel.position } },
                  ],
                },
                { $inc: { position: -1 } },
              )
              channel.position = dto.position
              channel.parent_id = dto.parent_id
            } else {
              channels = await this.channelModel.find(
                {
                  guild_id: channel.guild_id,
                  parent_id: channel.parent_id,
                  $and: [
                    { position: { $gte: dto.position } },
                    { position: { $lt: channel.position } },
                  ],
                },
                'id',
              )
              await this.channelModel.updateMany(
                {
                  guild_id: channel.guild_id,
                  parent_id: channel.parent_id,
                  $and: [
                    { position: { $gte: dto.position } },
                    { position: { $lt: channel.position } },
                  ],
                },
                { $inc: { position: 1 } },
              )
              channel.position = dto.position
              channel.parent_id = dto.parent_id
            }
          }
        }
      }
    }
    await channel.save()

    const cleanedChannel = ChannelResponseValidate(channel.toObject())

    const data = {
      event: 'guild.channel_edited',
      data: cleanedChannel,
    }
    this.eventEmitter.emit('guild.channel_edited', data, channel.guild_id)

    const updatedChannelsIds = []
    channels.map((ch) => updatedChannelsIds.push(ch.id))
    console.log(updatedChannelsIds)
    const updatedChannels = await this.channelModel.find({
      id: { $in: updatedChannelsIds },
    })
    const data2 = {
      event: 'guild.channels_positions_updated',
      data: {
        channels: updatedChannels.map(UpdatedChannelsPositionsValidate),
      },
    }

    this.eventEmitter.emit(
      'guild.channels_positions_updated',
      data2,
      channel.guild_id,
    )

    return cleanedChannel
  }

  async deleteChannel(channelId: string): Promise<void> {
    const channel = await this.channelModel.findOne({ id: channelId })
    if (!channel) throw new NotFoundException()

    let channels

    channel.deleted = true
    await channel.save()
    if (channel.type !== 2) {
      // ОБновляем позиции у каналов под ним
      const channels = await this.channelModel.updateMany(
        {
          guild_id: channel.guild_id,
          parent_id: channel.parent_id,
          position: { $gt: channel.position },
          deleted: false,
        },
        {
          $inc: { position: -1 },
        },
      )

      // Если у нас была категория, все немного сложнее
    } else {
      const count = await this.channelModel.countDocuments({
        parent_id: channel.id,
      })
      channels = await this.channelModel.find(
        {
          $or: [
            {
              guild_id: channel.guild_id,
              parent_id: channel.parent_id,
              position: { $gt: channel.position },
              deleted: false,
            },
            {
              guild_id: channel.guild_id,
              parent_id: channel.id,
              deleted: false,
            },
          ],
        },
        '-_id id',
      )

      // Обновляем позиции у каналов, которые будут ниже тех, что будут подставлены из категории
      await this.channelModel.updateMany(
        {
          guild_id: channel.guild_id,
          parent_id: channel.parent_id,
          position: { $gt: channel.position },
          deleted: false,
        },
        {
          $inc: { position: count - 1 },
        },
      )

      // Подставляем каналы из удаленной категории
      await this.channelModel.updateMany(
        {
          guild_id: channel.guild_id,
          parent_id: channel.id,
          deleted: false,
        },
        {
          $inc: { position: channel.position - 1 },
          parent_id: channel.parent_id,
        },
      )
    }

    // потом надо аудиты запилить
    const data = {
      event: 'guild.channel_deleted',
      data: { id: channelId },
    }

    this.eventEmitter.emit('guild.channel_deleted', data, channel.guild_id)

    const updatedChannelsIds = []
    channels.map((ch) => updatedChannelsIds.push(ch.id))
    console.log(updatedChannelsIds)
    const updatedChannels = await this.channelModel.find({
      id: { $in: updatedChannelsIds },
    })

    const data2 = {
      event: 'guild.channels_positions_updated',
      data: {
        channels: updatedChannels.map(UpdatedChannelsPositionsValidate),
      },
    }

    this.eventEmitter.emit(
      'guild.channels_positions_updated',
      data2,
      channel.guild_id,
    )
    return
  }

  async getChannels(guildId): Promise<ChannelResponse[]> {
    return (
      await this.channelModel
        .find({ guild_id: guildId, deleted: false })
        .select('-_id')
    ).map(ChannelResponseValidate)
  }

  async getMembers(guildId, userId): Promise<ExtendedMember[]> {
    const guild: ExtendedGuild = (
      await this.guildModel.aggregate([
        {
          $match: {
            id: guildId,
            deleted: false,
          },
        },
        { $unwind: '$members' },
        { $sort: { 'members.id': 1 } },
        { $group: { _id: '$id', members: { $push: '$members' } } },
        {
          $lookup: {
            from: 'users',
            localField: 'members.id',
            foreignField: 'id',
            as: 'users',
          },
        },
        {
          $project: {
            members: 1,
            users: 1,
          },
        },
      ])
    )[0]

    for (const member in guild.members) {
      guild.members[member].user = MemberUserResponseValidate(
        guild.users[member],
      )
      guild.members[member].user.connected = !!(
        (await this.onlineManager.get(guild.members[member].id)) &&
        guild.users[member].presence !== 4
      )
    }
    return guild.members
  }

  async getMember(guildId, userId): Promise<ExtendedMember> {
    const member = <ExtendedMember>(
      (
        await this.guildModel.findOne(
          { id: guildId, 'members.id': userId },
          'members.$',
        )
      ).members[0]
    )
    const user = (
      await this.userModel
        .findOne({ id: userId })
        .select(
          '-_id id username discriminator avatar banner description status presence premium_type public_flags',
        )
    ).toObject()
    const roles: string[] = []
    //const rolesArray = (await this.roleModel.find({ guild_id: guildId, members: { $in: userId } }, 'id')).forEach(role => roles.push(role.id))
    member.user = MemberUserResponseValidate(user)
    //member.roles = roles
    member.user.connected = !!(
      (await this.onlineManager.get(user.id)) && user.presence !== 4
    )
    return member
  }

  async getRoles(guildId: string): Promise<RoleResponse[]> {
    return (
      await this.roleModel.find({ guild_id: guildId, deleted: false })
    ).map(RoleResponseValidate)
  }

  async getRole(
    guildId: string,
    roleId: string,
    userId,
  ): Promise<RoleResponse> {
    const role = (
      await this.roleModel.findOne({
        id: roleId,
        guild_id: guildId,
        deleted: false,
      })
    ).toObject()
    return RoleResponseValidate(role)
  }

  async createRole(
    guildId: string,
    createRoleDto: RoleDto,
    userId: string,
  ): Promise<RoleResponse> {
    const count = await this.roleModel.countDocuments({
      guild_id: guildId,
      deleted: false,
    })
    const role = new this.roleModel()
    role.id = new UniqueID(config.snowflake).getUniqueID()
    role.guild_id = guildId
    role.position = createRoleDto?.position || count
    role.permissions = {
      allow: 0,
      deny: 0,
    }
    if (createRoleDto.name && createRoleDto.name.replaceAll(' ', '') !== '')
      role.name = createRoleDto.name.replaceAll(/(\s){2,}/gm, ' ')

    if (createRoleDto.color) role.color = createRoleDto.color
    if (createRoleDto.hoist) role.hoist = createRoleDto.hoist
    if (createRoleDto.mentionable) role.mentionable = createRoleDto.mentionable
    if (createRoleDto.permissions) {
      role.permissions.allow = createRoleDto.permissions.allow &= ~(
        createRoleDto.permissions.deny | ComputedPermissions.OWNER
      )
      role.permissions.deny = createRoleDto.permissions.deny
    }
    await role.save()
    const cleanedRole = RoleResponseValidate(role.toObject())

    const data = {
      event: 'guild.role_created',
      data: cleanedRole,
    }
    this.eventEmitter.emit('guild.role_created', data, guildId)

    return cleanedRole
  }

  async deleteRole(
    guildId: string,
    roleId: string,
    userId: string,
  ): Promise<void> {
    if (!this.isMember(guildId, userId)) throw new ForbiddenException()
    const perms = await this.parser.computePermissions(guildId, userId)
    if (
      !(
        perms &
        (ComputedPermissions.OWNER |
          ComputedPermissions.ADMINISTRATOR |
          ComputedPermissions.MANAGE_ROLES)
      )
    )
      throw new ForbiddenException()
    const admin =
      perms &
      (ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.MANAGE_ROLES)
    const role = await this.roleModel.findOne({ id: roleId, deleted: false })
    const roles = await this.roleModel
      .find({ guild_id: guildId, members: userId })
      .sort({ position: -1 })
    if (roles[0].position <= role.position && !admin)
      throw new ForbiddenException()
    role.deleted = true
    await role.save()

    await this.roleModel.updateMany(
      {
        guild_id: guildId,
        deleted: false,
        position: {
          $gte: role.position,
          $ne: 999,
        },
      },
      { $inc: { position: 1 } },
    )

    const data = {
      event: 'guild.role_deleted',
      data: { id: roleId },
    }
    this.eventEmitter.emit('guild.role_deleted', data, guildId)

    return
  }

  async patchRole(
    guildId: string,
    roleId: string,
    patchRoleDto: RoleDto,
  ): Promise<RoleResponse> {
    const role = await this.roleModel.findOne({
      id: roleId,
      guild_id: guildId,
      deleted: false,
    })
    if (!role) throw new NotFoundException()
    if (patchRoleDto.name && patchRoleDto.name.replaceAll(' ', '') !== '')
      role.name = patchRoleDto.name.replaceAll(/(\s){2,}/gm, ' ')

    if (patchRoleDto.color) role.color = patchRoleDto.color
    if (patchRoleDto.hoist && !role.default) role.hoist = patchRoleDto.hoist
    if (patchRoleDto.mentionable) role.mentionable = patchRoleDto.mentionable
    if (patchRoleDto.permissions) {
      role.permissions.allow = patchRoleDto.permissions.allow &= ~(
        patchRoleDto.permissions.deny | ComputedPermissions.OWNER
      )
      role.permissions.deny = patchRoleDto.permissions.deny
      role.markModified('permissions')
    }
    if (
      patchRoleDto.position &&
      !role.default &&
      patchRoleDto.position !== role.position
    ) {
      if (patchRoleDto.position < role.position)
        await this.roleModel.updateMany(
          {
            guild_id: role.guild_id,
            deleted: false,
            position: {
              $gte: patchRoleDto.position,
              $lt: role.position,
              $ne: 999,
            },
          },
          { $inc: { position: 1 } },
        )
      else
        await this.roleModel.updateMany(
          {
            guild_id: role.guild_id,
            deleted: false,
            position: {
              $lte: patchRoleDto.position,
              $gt: role.position,
              $ne: 999,
            },
          },
          { $inc: { position: -1 } },
        )
      role.position = patchRoleDto.position
    }
    await role.save()
    const cleanedRole = RoleResponseValidate(role.toObject())

    const data = {
      event: 'guild.role_patched',
      data: cleanedRole,
    }
    this.eventEmitter.emit('guild.role_patched', data, guildId)

    return cleanedRole
  }

  async editPermissions(
    channelId: string,
    overwriteId: string,
    dto: OverwritePermissionsDto,
  ) {
    const channel = await this.channelModel.findOne({
      id: channelId,
      deleted: false,
    })
    if (!channel) throw new NotFoundException()

    let overwriteIndex = channel.permission_overwrites.findIndex(
      (overwrite) => overwrite.id === overwriteId,
    )
    let overwriteData: PermissionsOverwrite
    if (overwriteIndex !== -1)
      overwriteData = channel.permission_overwrites[overwriteIndex]
    else {
      overwriteData = {
        id: overwriteId,
      }
      const member = await this.isMember(channel.guild_id, overwriteId)
      if (member) overwriteData.type = 0
      else {
        const role = await this.roleModel.exists({ id: overwriteId })
        if (role) overwriteData.type = 1
        else throw new BadRequestException()
      }
      channel.permission_overwrites.push(overwriteData)
      overwriteIndex = channel.permission_overwrites.length - 1
    }
    if ((dto.allow || dto.allow === 0) && (dto.deny || dto.deny === 0)) {
      overwriteData.allow = dto.allow &= ~(dto.deny | ComputedPermissions.OWNER)
      overwriteData.deny = dto.deny
    } else {
      throw new BadRequestException()
    }
    channel.permission_overwrites[overwriteIndex] = overwriteData
    channel.markModified('permission_overwrites')
    await channel.save()
    const data = {
      event: 'guild.channel_permission_overwrite',
      data: channel.permission_overwrites[overwriteIndex],
    }
    this.eventEmitter.emit(
      'guild.channel_permission_overwrite',
      data,
      channel?.guild_id,
    )

    return channel.permission_overwrites[overwriteIndex]
  }

  async deletePermissions(channelId: string, overwriteId: string) {
    const channel = await this.channelModel.findOne({
      id: channelId,
      deleted: false,
    })
    if (!channel) throw new NotFoundException()

    const overwriteIndex = channel.permission_overwrites.findIndex(
      (overwrite) => overwrite.id === overwriteId,
    )
    if (!(overwriteIndex + 1)) throw new NotFoundException()

    channel.permission_overwrites.splice(overwriteIndex, 1)
    channel.markModified('permission_overwrites')
    await channel.save()

    const data = {
      event: 'guild.channel_permission_overwrite_deleted',
      data: {
        guild_id: channel.guild_id,
        channel_id: channel.id,
        permission_overwrite_id: overwriteId,
      },
    }
    this.eventEmitter.emit(
      'guild.channel_permission_overwrite_deleted',
      data,
      channel?.guild_id,
    )

    return
  }

  async getInvites(guildId) {
    const invites = await this.inviteModel.find({ guild_id: guildId }, '-_id')
    return invites
  }

  async addEmojiPack(packId: string, guildId: string): Promise<void> {
    const guild = await this.guildModel.findOne({ id: guildId })
    if (guild.emoji_packs_ids.includes(packId)) throw new ConflictException()

    const pack = (await this.emojiPackModel.findOne({ id: packId })).toObject()
    if (
      guild.emoji_packs_ids.includes(packId) ||
      !pack.access.open_for_new_users
    )
      throw new ForbiddenException()
    guild.emoji_packs_ids.push(pack.id)
    guild.markModified('emoji_packs_ids')
    await guild.save()
    return
  }

  async deleteEmojiPack(packId: string, userId: string): Promise<void> {
    const guild = await this.guildModel.findOne({ id: userId })
    if (!guild.emoji_packs_ids.includes(packId)) throw new NotFoundException()

    guild.emoji_packs_ids.splice(guild.emoji_packs_ids.indexOf(packId), 1)
    guild.markModified('emoji_packs_ids')
    await guild.save()
    return
  }

  async addRoleMember(
    guildId: string,
    roleId: string,
    memberId: string,
    userId: string,
  ) {
    if (!(await this.isMember(guildId, memberId))) throw new NotFoundException()

    const role = await this.roleModel.findOne({ id: roleId, guild_id: guildId })
    if (!role) throw new BadRequestException()

    const positions = this.getPositions(userId, memberId)
    if (positions[0] >= role.position) throw new ForbiddenException()

    if (role.members.indexOf(memberId) + 1) throw new ConflictException()

    role.members.push(memberId)
    role.markModified('members')
    await role.save()

    const data = {
      event: 'guild.role_member_added',
      data: {
        role_id: role.id,
        member_id: memberId,
      },
    }
    this.eventEmitter.emit('guild.role_member_added', data, guildId)
  }

  async removeRoleMember(
    guildId: string,
    roleId: string,
    memberId: string,
    userId: string,
  ) {
    if (!(await this.isMember(guildId, memberId))) throw new NotFoundException()

    const role = await this.roleModel.findOne({ id: roleId, guild_id: guildId })
    if (!role) throw new BadRequestException()

    const positions = this.getPositions(userId, memberId)
    if (positions[0] >= role.position) throw new ForbiddenException()

    const memberIndex = role.members.indexOf(memberId)
    if (!(memberIndex + 1)) throw new ConflictException()

    role.members.splice(memberIndex, 1)
    role.markModified('members')
    await role.save()

    const data = {
      event: 'guild.role_member_removed',
      data: {
        role_id: role.id,
        member_id: memberId,
      },
    }
    this.eventEmitter.emit('guild.role_member_removed', data, guildId)
  }

  async getMemberRoles(guildId: string, memberId: string) {
    if (!(await this.isMember(guildId, memberId))) throw new NotFoundException()
    const roles = await this.roleModel.find({ member: memberId })
    return roles.map(RoleResponseValidate)
  }

  async removeMember(
    guildId: string,
    memberId: string,
    userId: string,
  ): Promise<void> {
    if (!(await this.isMember(guildId, memberId))) throw new NotFoundException()

    const perms = await this.parser.computePermissions(guildId, memberId)
    if (perms & ComputedPermissions.OWNER) throw new ForbiddenException()

    const positions = this.getPositions(userId, memberId)
    if (positions[0] >= positions[1]) throw new ForbiddenException()

    const membersStr: string = await this.onlineManager.get(guildId)
    if (membersStr) {
      let members: string[] = JSON.parse(membersStr)
      const index = members.indexOf(memberId)
      if (index >= 0) {
        members = members.filter((m) => m !== memberId)
        await this.onlineManager.set(guildId, JSON.stringify(members))
      }
    }

    const guild = await this.guildModel.updateOne(
      { id: guildId, owner_id: { $ne: memberId }, 'members.id': memberId },
      { $pull: { members: { id: memberId } } },
    )
    if (!guild) throw new NotFoundException()

    await this.roleModel.updateMany(
      { guild_id: guildId, members: memberId },
      { $pull: { members: memberId } },
    )

    const data = {
      event: 'guild.user_left',
      data: {
        id: memberId,
        guild: guildId,
      },
    }
    this.eventEmitter.emit('guild.user_left', data, guildId)

    return
  }

  async createBan(
    guildId: string,
    dto: CreateBanDto,
    banId: string,
    userId: string,
  ): Promise<GuildBan> {
    if (!(await this.isOwner(guildId, userId))) {
      if (await this.isOwner(guildId, banId)) throw new ForbiddenException()

      if (await this.isMember(guildId, banId)) {
        const positions = await this.getPositions(userId, banId)
        const members: GuildMember[] = await this.getComparedMembers(
          guildId,
          userId,
          banId,
        )
        // eslint-disable-next-line prettier/prettier
        const perms = (members[0].permissions.allow &= ~members[1].permissions.allow)
        if (
          !(
            perms &
            (ComputedPermissions.OWNER |
              ComputedPermissions.ADMINISTRATOR |
              ComputedPermissions.MANAGE_MEMBERS)
          )
        )
          throw new ForbiddenException()
        if (positions[0] >= positions[1]) throw new ForbiddenException()
      }
    }
    if (userId === banId) throw new BadRequestException()

    const ban: GuildBan = {
      user_id: banId,
      reason: dto.reason?.trim() || '',
      banned_by: userId,
      date: Date.now(),
    }

    await this.guildModel.updateOne({ id: guildId }, { $push: { bans: ban } })

    await this.guildModel.updateOne(
      { id: guildId, 'members.id': banId },
      { $pull: { members: { id: banId } } },
    )

    await this.roleModel.updateMany(
      { guild_id: guildId, members: banId },
      { $pull: { members: banId } },
    )

    const users = await this.userModel.find({
      id: [ban.banned_by, ban.user_id],
    })
    ban.users = users.map(MessageUserValidate)

    const data = {
      event: 'guild.user_left',
      data: {
        id: banId,
        guild: guildId,
      },
    }
    this.eventEmitter.emit('guild.user_left', data, guildId)

    return ban
  }

  async getBans(
    guildId: string,
    one?: boolean,
    userId?: string,
  ): Promise<GuildBan[] | GuildBan> {
    if (one) {
      const ban: GuildBan = await this.guildModel.find(
        {
          id: guildId,
          'bans.user_id': userId,
        },
        'bans.$',
      )[0]
      if (ban) {
        const users = await this.userModel.find({
          id: [ban.banned_by, ban.user_id],
        })
        ban.users = users.map(MessageUserValidate)
        return ban
      }
    } else {
      const bans = <GuildBan[]>(
        await this.guildModel.findOne(
          {
            id: guildId,
          },
          'bans',
        )
      ).bans
      const userIds = []
      bans.forEach((b: GuildBan) => userIds.push(b.user_id, b.banned_by))
      const users = <User[]>await this.userModel.find({ id: userIds })

      return <unknown>bans
        .map((b: GuildBan) => {
          b.users = []
          b.users.push(
            MessageUserValidate(users.find((u) => u.id === b.user_id)),
            MessageUserValidate(users.find((u) => u.id === b.banned_by)),
          )
          return b
        })
        .sort((a, b) => b.date - a.date)
    }
  }

  async removeBan(guildId: string, userId: string): Promise<void> {
    const guild = await this.guildModel.updateOne(
      { id: guildId, 'bans.user_id': userId },
      { $pull: { bans: { user_id: userId } } },
    )
    if (!guild) throw new NotFoundException()
  }

  async isMember(guildId: string, userId: string) {
    return this.guildModel.exists({ id: guildId, 'members.id': userId })
  }

  async isOwner(guildId: string, userId: string) {
    return this.guildModel.exists({ id: guildId, owner_id: userId })
  }
  async getPositions(first: string, second: string) {
    const roles = await this.roleModel.find({
      $or: [{ members: first }, { members: second }],
    })

    let positionFirst: number
    let positionSecond: number
    roles.forEach((role) => {
      if (!positionFirst && role.members.includes(first))
        positionFirst = role.position
      if (!positionSecond && role.members.includes(second))
        positionSecond = role.position
    })
    return [positionFirst, positionSecond]
  }

  async getComparedMembers(guildId: string, first: string, second: string) {
    const member = <GuildMember>(
      (
        await this.guildModel.findOne(
          { id: guildId, 'members.id': first },
          'members.$',
        )
      ).members[0]
    )
    const member2 = <GuildMember>(
      (
        await this.guildModel.findOne(
          { id: guildId, 'members.id': second },
          'members.$',
        )
      ).members[0]
    )
    return [member, member2]
  }
}

export class ExtendedGuild extends Guild {
  users: User[]
  members: ExtendedMember[]
  roles: Array<string[]>
}

export class ExtendedMember extends GuildMember {
  user: UserResponse
  roles: string[]
  connected: boolean
}
