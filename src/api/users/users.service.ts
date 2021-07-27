import { Role, RoleDocument } from './../guilds/schemas/role.schema';
import { ChannelType } from './../channels/schemas/channel.schema';
import { config } from './../../app.config';
import { GuildDocument } from './../guilds/schemas/guild.schema';
import { ModifyUserDto } from './dto/modify-user.dto';
import { Model } from 'mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Channel, ChannelDocument } from '../channels/schemas/channel.schema';
import { Guild } from '../guilds/schemas/guild.schema';
import { UniqueID } from 'nodejs-snowflake';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Guild.name) private guildModel: Model<GuildDocument>,
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>
  ) {}

  async getUser(userId, me): Promise<User> {
    const user: User = await this.userModel.findOne(
      { id: userId }
    )
    .select('-_id id username discriminator avatar banner verified flags premium_type public_flags email')
    .lean()
    if (!user) throw new NotFoundException()
    if (me) return user
    else {
      const { email, ...cleanedUser } = user
      return cleanedUser
    }

  }
  
  async patchUser(userId, modifyData: ModifyUserDto): Promise<User> {
    const modifiedUser: User = await this.userModel.updateOne(
      { id: userId },
      { modifyData }
    )
    .select('-_id id username discriminator avatar banner verified flags premium_type public_flags email')
    .lean()
    if (!modifiedUser) throw new NotFoundException()
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
    return
  }

  async getChannels(userId): Promise<Channel[]> {
    return await this.channelModel.find({ owner_id: userId }).select('-_id').lean()
  }

  async createChannel(userId, channelData): Promise<Channel> {
    const channel = new this.channelModel()
    channel.id = new UniqueID(config.snowflake).getUniqueID()
    channel.owner_id = userId
    channel.type = ChannelType.DM
    channel.recipients.push(userId, channelData.recipernt_id)
    await channel.save()
    const { _id, ...cleanedChannel } = channel.toObject()
    return cleanedChannel
  }
}
  