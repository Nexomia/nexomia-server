import { CreateUserChannelDto } from './dto/create-user-channel.dto';
import { File, FileDocument, FileType } from './../files/schemas/file.schema';
import { SaltService } from './../../utils/salt/salt.service';
import { ChannelResponse, ChannelResponseValidate } from './../channels/responses/channel.response';
import { GuildsService } from './../guilds/guilds.service';
import { ChannelsService } from './../channels/channels.service';
import { MessageType } from './../channels/schemas/message.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role, RoleDocument } from './../guilds/schemas/role.schema';
import { ChannelType } from './../channels/schemas/channel.schema';
import { config } from './../../app.config';
import { GuildDocument } from './../guilds/schemas/guild.schema';
import { ModifyUserDto } from './dto/modify-user.dto';
import { Model } from 'mongoose';
import { Injectable, NotFoundException, CACHE_MANAGER, Inject, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Channel, ChannelDocument } from '../channels/schemas/channel.schema';
import { Guild } from '../guilds/schemas/guild.schema';
import { UniqueID } from 'nodejs-snowflake';
import { Cache } from 'cache-manager';
import { UserResponse, UserResponseValidate } from './responses/user.response';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private eventEmitter: EventEmitter2,
    private channelsService: ChannelsService,
    private guildsService: GuildsService,
    private saltService: SaltService
  ) {}

  async getUser(userId, me): Promise<UserResponse> {
    const user: User = (await this.userModel.findOne(
      { id: userId }
    )).toObject()
    if (!user) throw new NotFoundException()
    user.connected = !!(await this.onlineManager.get(user.id) && user.presence !== 4)
    if (!user.connected) user.presence = 4
    const cleanedUser = UserResponseValidate(user)
    if (me) return cleanedUser
    else {
      const { email, verified, ...cleanedUser2 } = cleanedUser
      return cleanedUser2
    }

  }
  
  async patchUser(userId, modifyData: ModifyUserDto): Promise<UserResponse> {
    const user: UserDocument = await this.userModel.findOne({ id: userId })
    if (!user) throw new NotFoundException()

    const pass = this.saltService.password(modifyData.password) === user.password

    let changes = 0
    let tagChanges = 0

    if (modifyData.username && (modifyData.username !== user.username)) {
      if (!pass) throw new BadRequestException()
      user.username = modifyData.username
      changes++
      tagChanges++
    }
    
    if (modifyData.discriminator && modifyData.description !== user.discriminator) {
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
        const file = (await this.fileModel.findOne({ id: modifyData.avatar, type: FileType.AVATAR, owner_id: userId }))
        if (!file) throw new BadRequestException()
        user.avatar = `http://${config.domain}/api/files/${file.id}/${this.fixedEncodeURIComponent(file.name)}`
      }
      changes++
    }

    if (modifyData.banner && modifyData.banner !== user.banner) {
      if (modifyData.banner === '0') user.banner = ''
      else { 
        const file = await this.fileModel.findOne({ id: modifyData.banner, type: FileType.BANNER, owner_id: userId })
        if (!file) throw new BadRequestException()
        user.banner = `http://${config.domain}/api/files/${file.id}/${this.fixedEncodeURIComponent(file.name)}`
      }
      changes++
    }

    if (modifyData.status && modifyData.status !== user.status) {
      user.status = modifyData.status
      changes++
    }

    if (modifyData.description && modifyData.description !== user.description) {
      user.description = modifyData.description
      changes++
    }
    
    if (modifyData.presence && (modifyData.presence !== user.presence)) {
      user.presence = modifyData.presence
      changes++
    }

    if (tagChanges && await this.userModel.exists({ username: user.username, discriminator: user.discriminator })) throw new BadRequestException()

    if (!changes) throw new BadRequestException()

    await user.save()

    let modifiedUser = UserResponseValidate(user.toObject())

    modifiedUser.connected = !!(await this.onlineManager.get(user.id) && user.presence !== 4)
    if (!modifiedUser.connected) modifiedUser.presence = 4
    
    const { verified, email, ...cleanedUser } = modifiedUser

    const data = {
      event: 'user.patched',
      data: cleanedUser
    }
    this.eventEmitter.emit(
      'user.patched',
      data, 
      userId
    )

    return modifiedUser
  }

  async getGuilds(userId, sortData): Promise<Guild[]> {
    return await this.guildModel.find({ 'members.id': userId }).select('-_id id name icon owner_id').lean()
  }

  async leaveGuild(userId, guildId): Promise<void> {
    if (!await this.guildsService.isMember(guildId, userId)) throw new NotFoundException()

    let membersStr: string = await this.onlineManager.get(guildId)
    if (membersStr) {
      let members: string[] = JSON.parse(membersStr)
      const index = members.indexOf(userId)
      if (index >= 0) {
        members = members.filter(m => m !== userId )
        await this.onlineManager.set(guildId, JSON.stringify(members))
      }
    }

    const guildChannel = await (await this.guildModel.findOne({ id: guildId }, 'default_channel')).toObject()
      if (guildChannel.default_channel !== '')
        await this.channelsService.createMessage(userId, guildChannel.default_channel, {}, { type: MessageType.LEAVE })

    const guild = await this.guildModel.updateOne(
      { id: guildId, owner_id: { $ne: userId }, 'members.id': userId },
      { $pull: { members: { id: userId } } }
    )
    if (!guild) throw new NotFoundException()

    await this.roleModel.updateMany(
      { guild_id: guildId, members: userId },
      { $pull: { members: userId } }
    )

    const data = {
      event: 'guild.user_left',
      data: {
        id: userId,
        guild: guildId
      }
    }
    this.eventEmitter.emit(
      'guild.user_left',
      data,
      guildId
    )

    return
  }

  async getChannels(userId): Promise<ChannelResponse[]> {
    return (await this.channelModel.find({ 'recipients': { $in: userId } })).map(ChannelResponseValidate)
  }

  async createChannel(userId, channelData: CreateUserChannelDto): Promise<ChannelResponse> {
    const recipients = [  ...new Set(channelData.recipient_ids) ]
    if (recipients.length !== 1 && recipients.length < 2) throw new BadRequestException()
    const channel = new this.channelModel()
    channel.id = new UniqueID(config.snowflake).getUniqueID()
    channel.owner_id = userId
    channel.type = recipients.length === 1 ? ChannelType.DM : ChannelType.GROUP_DM

    if (channelData.name && channel.type === ChannelType.GROUP_DM)
      channel.name = channelData.name

    if (
      channel.type === ChannelType.DM
      &&
      await this.channelModel.exists({ type: ChannelType.DM, recipients: recipients[0] })
    ) throw new ConflictException()
    
    const user_servers = await this.getUserServers(userId)
    let goodRecipients: string[] = []
    for (const recipient of recipients) {
      const recipient_servers = await this.getUserServers(recipient, true)
      const mutual = user_servers.filter((id) => recipient_servers.includes(id))
      if (mutual.length) {
        goodRecipients.push(recipient)
      }
    }

    if (!goodRecipients.length || (channel.type === ChannelType.GROUP_DM && goodRecipients.length < 2)) 
      throw new BadRequestException()

    channel.recipients = goodRecipients
    channel.recipients.unshift(userId)
    await channel.save()
    const cleanedChannel = ChannelResponseValidate(channel.toObject())

    let members: string[] = []
    for (const recipient of channel.recipients) {
    if (await this.onlineManager.get(recipient))
      members.push(recipient)
    }
    if (members.length)
      await this.onlineManager.set(channel.id, JSON.stringify(members))

    const data = {
      event: 'channel.created',
      data: cleanedChannel
    }
    this.eventEmitter.emit(
      'channel.created',
      data,
      channel.id
    )

    return cleanedChannel
  }

  private fixedEncodeURIComponent (str) {
    return encodeURIComponent(str)
      .replace(/['()]/g, escape)
      .replace(/\*/g, '%2A')
      .replace(/%(?:7C|60|5E)/g, unescape)
  }

  private async getUserServers(userId, allowDms?) {
    let array: string[] = []
    const servers = (await this.guildModel.find({ 'members.id': userId }, 'id members.$')).map(server => 
      allowDms ? 
        server.members[0].allow_dms ?
          array.push(server.id) :
          false :
        array.push(server.id)
    )
    return array
  }
}
