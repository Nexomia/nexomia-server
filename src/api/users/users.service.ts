import { EventEmitter2 } from '@nestjs/event-emitter'
import { Model } from 'mongoose'
import {
  Injectable,
  NotFoundException,
  CACHE_MANAGER,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { UniqueID } from 'nodejs-snowflake'
import { Cache } from 'cache-manager'
import { EmojiResponseValidate } from 'api/emojis/responses/emoji.response'
import { Channel, ChannelDocument } from '../channels/schemas/channel.schema'
import { Guild } from '../guilds/schemas/guild.schema'
import { MessageUserValidate } from './../channels/responses/message.response'
import {
  EmojiPackResponse,
  EmojiPackResponseValidate,
} from './../emojis/responses/emojiPack.response'
import { Emoji } from './../emojis/schemas/emoji.schema'
import {
  EmojiPack,
  EmojiPackDocument,
} from './../emojis/schemas/emojiPack.schema'
import { FilesService } from './../files/files.service'
import { CreateUserChannelDto } from './dto/create-user-channel.dto'
import { File, FileDocument, FileType } from './../files/schemas/file.schema'
import { SaltService } from './../../utils/salt/salt.service'
import {
  ChannelResponse,
  ChannelResponseValidate,
} from './../channels/responses/channel.response'
import { GuildsService } from './../guilds/guilds.service'
import { ChannelsService } from './../channels/channels.service'
import { MessageType } from './../channels/schemas/message.schema'
import { Role, RoleDocument } from './../guilds/schemas/role.schema'
import { ChannelType } from './../channels/schemas/channel.schema'
import { config } from './../../app.config'
import { GuildDocument } from './../guilds/schemas/guild.schema'
import { ModifyUserDto } from './dto/modify-user.dto'
import { User, UserDocument } from './schemas/user.schema'
import { UserResponse, UserResponseValidate } from './responses/user.response'

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    @InjectModel(EmojiPack.name)
    private emojiPackModel: Model<EmojiPackDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private eventEmitter: EventEmitter2,
    private channelsService: ChannelsService,
    private guildsService: GuildsService,
    private filesService: FilesService,
    private saltService: SaltService,
  ) {}

  async getUser(userId, me): Promise<UserResponse> {
    const user: User = await this.userModel.findOne({ id: userId })
    if (!user) throw new NotFoundException()
    user.connected = !!(
      (await this.onlineManager.get(user.id)) && user.presence !== 4
    )
    if (!user.connected) user.presence = 4
    if (me) {
      const emojiPacks: EmojiPack[] = await this.emojiPackModel.aggregate([
        {
          $match: { id: { $in: user.emoji_packs_ids } },
        },
        {
          $lookup: {
            from: 'emojis',
            localField: 'id',
            foreignField: 'pack_id',
            as: 'emojis',
          },
        },
      ])
      user.emoji_packs = <EmojiPackResponse[]>emojiPacks.map(
        (pack: EmojiPack) => {
          pack.emojis = pack.emojis
            .filter((emoji) => !emoji.deleted)
            .map((emoji: Emoji) => {
              emoji.url = `https://cdn.nx.wtf/${emoji.id}/${
                pack.type ? 'sticker' : 'emoji' // 1 - sticker, 0 - emoji (true/else)
              }.webp`
              return EmojiResponseValidate(emoji)
            })
          if (pack.icon)
            pack.icon = `https://cdn.nx.wtf/${pack.icon}/avatar.webp`
          else pack.icon = pack.emojis[0]?.url
          return EmojiPackResponseValidate(pack)
        },
      )
    }
    const cleanedUser = UserResponseValidate(user)
    if (me) return cleanedUser
    else {
      const { email, ...cleanedUser2 } = cleanedUser
      return cleanedUser2
    }
  }

  async getMany(tags?: string, ids?: string): Promise<UserResponse[]> {
    let idsArray = []
    const tagsArray = []
    if (ids) idsArray = ids.split(',')
    if (tags) {
      console.log(tags)
      tags
        .split(',')
        .map((t) => {
          return t.split('#')
        })
        .filter((t) => t.length === 2)
        .map((t) => tagsArray.push({ username: t[0], discriminator: t[1] }))
    }
    const users: User[] = await this.userModel.find({
      $or: tagsArray.concat(idsArray ? { id: { $in: idsArray } } : null),
    })
    if (!users.length) throw new NotFoundException()
    return users.map((u) => {
      delete u.email
      return MessageUserValidate(u)
    })
  }

  async patchUser(userId, modifyData: ModifyUserDto): Promise<UserResponse> {
    const user: UserDocument = await this.userModel.findOne({ id: userId })
    if (!user) throw new NotFoundException()

    const pass =
      this.saltService.password(modifyData.password) === user.password

    let changes = 0
    let tagChanges = 0

    if (modifyData.username && modifyData.username !== user.username) {
      if (modifyData.username.replaceAll(' ', '') === '' || !pass)
        throw new BadRequestException()

      user.username = modifyData.username
      changes++
      tagChanges++
    }

    if (
      modifyData.discriminator &&
      modifyData.description !== user.discriminator
    ) {
      if (!pass) throw new BadRequestException()
      user.discriminator = modifyData.discriminator
      changes++
      tagChanges++
    }

    if (modifyData.new_password) {
      if (!pass) throw new BadRequestException()
      user.password = this.saltService.password(modifyData.new_password)
      user.tokens = []
      changes++
    }

    if (modifyData.avatar && modifyData.avatar !== user.avatar) {
      if (modifyData.avatar === '0') user.avatar = ''
      else {
        const file = await this.filesService.getFileInfo(modifyData.avatar)
        if (!file || file.type !== FileType.AVATAR)
          throw new BadRequestException()
        user.avatar = file.url
      }
      changes++
    }

    if (modifyData.banner && modifyData.banner !== user.banner) {
      if (modifyData.banner === '0') user.banner = ''
      else {
        const file = await this.filesService.getFileInfo(modifyData.banner)
        if (!file || file.type !== FileType.BANNER)
          throw new BadRequestException()
        user.banner = file.url
      }
      changes++
    }

    if (
      modifyData.status &&
      modifyData.status !== user.status &&
      modifyData.status.replaceAll(' ', '') !== ''
    ) {
      user.status = modifyData.status.replaceAll(/(\s){2,}/gm, ' ')
      changes++
    }

    if (
      modifyData.description &&
      modifyData.description !== user.description &&
      modifyData.description.replaceAll(' ', '') !== ''
    ) {
      user.description = modifyData.description.replaceAll(/(\s){2,}/gm, ' ')
      changes++
    }

    if (modifyData.presence && modifyData.presence !== user.presence) {
      user.presence = modifyData.presence
      changes++
    }

    if (
      tagChanges &&
      (await this.userModel.exists({
        username: user.username,
        discriminator: user.discriminator,
      }))
    )
      throw new BadRequestException()

    if (!changes) throw new BadRequestException()

    await user.save()

    const modifiedUser = UserResponseValidate(user.toObject())

    modifiedUser.connected = !!(
      (await this.onlineManager.get(user.id)) && user.presence !== 4
    )
    if (!modifiedUser.connected) modifiedUser.presence = 4

    const { email, ...cleanedUser } = modifiedUser

    const data = {
      event: 'user.patched',
      data: cleanedUser,
    }
    this.eventEmitter.emit('user.patched', data, userId)

    return modifiedUser
  }

  async getGuilds(userId, sortData): Promise<Guild[]> {
    const guilds = await this.guildModel
      .find({ 'members.id': userId })
      .select('-_id id name icon owner_id')
      .lean()
    const guild_ids: string[] = []
    guilds.map((g) => {
      guild_ids.push(g.id)
      g.unread = false
      return g
    })
    const channels = await this.channelModel.find({
      deleted: false,
      guild_id: { $in: guild_ids },
    })
    const updated_guilds: string[] = []
    channels.forEach((ch) => {
      if (BigInt(ch.last_message_id) > BigInt(ch.read_states[userId] || 0)) {
        if (!updated_guilds.includes(ch.guild_id)) {
          guilds[guilds.findIndex((g) => g.id === ch.guild_id)].unread = true
          updated_guilds.push(ch.guild_id)
        }
      }
    })
    return guilds
  }

  async leaveGuild(userId, guildId): Promise<void> {
    if (!(await this.guildsService.isMember(guildId, userId)))
      throw new NotFoundException()

    const membersStr: string = await this.onlineManager.get(guildId)
    if (membersStr) {
      let members: string[] = JSON.parse(membersStr)
      const index = members.indexOf(userId)
      if (index >= 0) {
        members = members.filter((m) => m !== userId)
        await this.onlineManager.set(guildId, JSON.stringify(members))
      }
    }

    const guildChannel = await (
      await this.guildModel.findOne({ id: guildId }, 'default_channel')
    ).toObject()
    if (guildChannel.default_channel !== '')
      await this.channelsService.createMessage(
        userId,
        guildChannel.default_channel,
        {},
        { type: MessageType.LEAVE },
      )

    const guild = await this.guildModel.updateOne(
      { id: guildId, owner_id: { $ne: userId }, 'members.id': userId },
      { $pull: { members: { id: userId } } },
    )
    if (!guild) throw new NotFoundException()

    await this.roleModel.updateMany(
      { guild_id: guildId, members: userId },
      { $pull: { members: userId } },
    )

    const data = {
      event: 'guild.user_left',
      data: {
        id: userId,
        guild: guildId,
      },
    }
    this.eventEmitter.emit('guild.user_left', data, guildId)

    return
  }

  async getChannels(userId): Promise<ChannelResponse[]> {
    return (
      await this.channelModel.find({
        recipients: { $in: userId },
        deleted: false,
      })
    ).map(ChannelResponseValidate)
  }

  async createChannel(
    userId,
    channelData: CreateUserChannelDto,
  ): Promise<ChannelResponse> {
    const recipients = [...new Set(channelData.recipient_ids)]
    if (recipients.length !== 1 && recipients.length < 2)
      throw new BadRequestException()
    const channel = new this.channelModel()
    channel.id = new UniqueID(config.snowflake).getUniqueID()
    channel.owner_id = userId
    channel.type =
      recipients.length === 1 ? ChannelType.DM : ChannelType.GROUP_DM

    if (channelData.name && channel.type === ChannelType.GROUP_DM) {
      if (channelData.name.replaceAll(' ', '') === '')
        channel.name = 'new channel'

      channel.name = channelData.name.replaceAll(/(\s){2,}/gm, ' ')
    }

    if (
      channel.type === ChannelType.DM &&
      (await this.channelModel.exists({
        type: ChannelType.DM,
        recipients: recipients[0],
      }))
    )
      throw new ConflictException()

    const user_servers = await this.getUserServers(userId)
    const goodRecipients: string[] = []
    for (const recipient of recipients) {
      const recipient_servers = await this.getUserServers(recipient, true)
      const mutual = user_servers.filter((id) => recipient_servers.includes(id))
      if (mutual.length) {
        goodRecipients.push(recipient)
      }
    }

    if (
      !goodRecipients.length ||
      (channel.type === ChannelType.GROUP_DM && goodRecipients.length < 2)
    )
      throw new BadRequestException()

    channel.recipients = goodRecipients
    channel.recipients.unshift(userId)
    await channel.save()
    const cleanedChannel = ChannelResponseValidate(channel.toObject())

    const members: string[] = []
    for (const recipient of channel.recipients) {
      if (await this.onlineManager.get(recipient)) members.push(recipient)
    }
    if (members.length)
      await this.onlineManager.set(channel.id, JSON.stringify(members))

    const data = {
      event: 'channel.created',
      data: cleanedChannel,
    }
    this.eventEmitter.emit('channel.created', data, channel.id)

    return cleanedChannel
  }

  async deleteChannel(userId: string, channelId: string): Promise<void> {
    const channel = await this.channelModel.findOne({
      id: channelId,
      owner_id: userId,
      deleted: false,
    })
    if (!channel) throw new NotFoundException()
    this.channelModel.updateOne({ id: channelId }, { $set: { deleted: true } })

    const data = {
      event: 'channel.deleted',
      data: { id: channelId },
    }
    this.eventEmitter.emit('channel.deleted', data, channelId)

    return
  }

  async addEmojiPack(packId: string, userId: string): Promise<void> {
    const user = await this.userModel.findOne({ id: userId })
    if (user.emoji_packs_ids.includes(packId)) throw new ConflictException()

    const pack = (await this.emojiPackModel.findOne({ id: packId })).toObject()
    if (
      !user.emoji_packs_ids.includes(packId) &&
      pack.owner_id !== userId &&
      (pack.access.disallowedUsers?.includes(userId) ||
        (!pack.access.open_for_new_users &&
          !pack.access.allowedUsers?.includes(userId)))
    )
      throw new ForbiddenException()
    user.emoji_packs_ids.push(pack.id)
    user.markModified('emoji_packs_ids')
    await user.save()
    return
  }

  async deleteEmojiPack(packId: string, userId: string): Promise<void> {
    const user = await this.userModel.findOne({ id: userId })
    if (!user.emoji_packs_ids.includes(packId)) throw new NotFoundException()

    user.emoji_packs_ids.splice(user.emoji_packs_ids.indexOf(packId), 1)
    user.markModified('emoji_packs_ids')
    await user.save()
    return
  }

  private async getUserServers(userId, allowDms?) {
    const array: string[] = []
    const servers = (
      await this.guildModel.find({ 'members.id': userId }, 'id members.$')
    ).map((server) =>
      allowDms
        ? server.members[0].allow_dms
          ? array.push(server.id)
          : false
        : array.push(server.id),
    )
    return array
  }
}
