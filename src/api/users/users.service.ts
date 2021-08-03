import { EventEmitter2 } from '@nestjs/event-emitter';
import { Role, RoleDocument } from './../guilds/schemas/role.schema';
import { ChannelType } from './../channels/schemas/channel.schema';
import { config } from './../../app.config';
import { GuildDocument } from './../guilds/schemas/guild.schema';
import { ModifyUserDto } from './dto/modify-user.dto';
import { Model } from 'mongoose';
import { Injectable, NotFoundException, CACHE_MANAGER, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Channel, ChannelDocument } from '../channels/schemas/channel.schema';
import { Guild } from '../guilds/schemas/guild.schema';
import { UniqueID } from 'nodejs-snowflake';
import { Cache } from 'cache-manager';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private eventEmitter: EventEmitter2,
  ) {}

  async getUser(userId, me): Promise<User> {
    const user: User = await this.userModel.findOne(
      { id: userId }
    )
    .select('-_id id username discriminator avatar banner verified premium_type public_flags email')
    .lean()
    if (!user) throw new NotFoundException()
    if (me) return user
    else {
      const { email, verified, ...cleanedUser } = user
      return cleanedUser
    }

  }
  
  async patchUser(userId, modifyData: ModifyUserDto): Promise<User> {
    const modifiedUser: User = await this.userModel.updateOne(
      { id: userId },
      { modifyData }
    )
    .select('-_id id username discriminator avatar banner verified premium_type public_flags email')
    .lean()
    if (!modifiedUser) throw new NotFoundException()

    const data = {
      event: 'user.patched',
      data: modifiedUser
    }
    this.eventEmitter.emit(
      'user.patched',
      data, 
      userId
    )

    return modifiedUser
  }

  async getGuilds(userId, sortData): Promise<Guild[]> {
    return await this.guildModel.find({ 'members.id': userId }).select('-_id id name icon').lean()
  }

  async leaveGuild(userId, guildId): Promise<void> {
    const guild = await this.guildModel.updateOne(
      { id: guildId, owner_id: { $ne: userId }, 'members.id': userId },
      { $pull: { members: { id: userId } } }
    )
    if (!guild) throw new NotFoundException()
    await this.roleModel.updateMany(
      { guild_id: guildId, members: userId },
      { $pull: { members: userId } }
    )

    let membersStr: string = await this.onlineManager.get(guildId)
    if (membersStr) {
      let members: string[] = JSON.parse(membersStr)
      const index = members.indexOf(userId)
      if (index >= 0)
        members.splice(index, 1)
        await this.onlineManager.set(guildId, JSON.stringify(members))
    }

    const data = {
      event: 'guild.user_left',
      data: {
        id: userId
      }
    }
    this.eventEmitter.emit(
      'guild.user_left',
      data,
      guildId
    )

    return
  }

  async getChannels(userId): Promise<Channel[]> {
    return await this.channelModel.find({ 'recipients': { $in: userId } }).select('-_id').lean()
  }

  async createChannel(userId, channelData): Promise<Channel> {
    const channel = new this.channelModel()
    channel.id = new UniqueID(config.snowflake).getUniqueID()
    channel.owner_id = userId
    channel.type = ChannelType.DM
    channel.recipients.push(userId, channelData.recipernt_id)
    await channel.save()
    const { _id, ...cleanedChannel } = channel.toObject()

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
}
  