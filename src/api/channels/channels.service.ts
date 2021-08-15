
import { Emoji, EmojiDocument } from './../emojis/schemas/emoji.schema';
import { ComputedPermissions } from './../guilds/schemas/role.schema';
import { Parser } from 'src/utils/parser/parser.utils';
import { GuildsService } from './../guilds/guilds.service';
import { config } from './../../app.config';
import { Invite, InviteDocument } from './../invites/schemas/invite.schema';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { Channel, ChannelDocument, ChannelType } from './schemas/channel.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Message, MessageDocument, MessageType } from './schemas/message.schema';
import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException, ForbiddenException, Inject, CACHE_MANAGER } from '@nestjs/common';
import { Model } from 'mongoose';
import { UniqueID } from 'nodejs-snowflake';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(Emoji.name) private emojiModel: Model<EmojiDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private guildService: GuildsService,
    private parser: Parser,
    private eventEmitter: EventEmitter2
  ) {}

  async getChannel(channelId): Promise<Channel> {
    const channel = await this.channelModel.findOne({ id: channelId }).select('-_id').lean()
    if (!channel) throw new NotFoundException()
    return channel
  }

  async deleteChannel(channelId) {}

  async getChannelMessages(channelId, filters, userId): Promise<Message[]> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()
    const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
    if (!(perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.READ_MESSAGES
    ))) throw new ForbiddenException()

    const data = await this.messageModel.aggregate([
    { 
      $match: {
        channel_id: channelId,
        created: { $gt: parseInt(filters?.after) || 0, $lt: parseInt(filters?.before) || Date.now() },
        deleted: false 
      }
    },
    { $sort: { created: -1 } },
    { $skip: parseInt(filters?.offset) || 0 },
    { $limit: parseInt(filters?.count) || 50 },
    { 
      $graphLookup: {
        from: 'messages',
        startWith: '$resentsIds',
        connectFromField: 'resentsIds',
        connectToField: 'id',
        as: 'resentsCompiled',
        maxDepth: 0,
      },
    },
    { $unset: ['_id', 'deleted', '__v'] }
  ])
  const ready = data.map(msg => {
    if (msg.resentsCompiled.length) {
      msg.resentsCompiled.map((resent, i) => {
        resent.resents = resent.resentsIds
        if (resent.changed.length != msg.resentsRevs[i]) {
          resent.content = resent.changed[msg.resentsRevs[i]].text
          resent.attachments = resent.changed[msg.resentsRevs[i]].attachments
          resent.resents = resent.changed[msg.resentsRevs[i]].resentsIds
          resent.mentions = resent.changed[msg.resentsRevs[i]].mentions
        }
        delete resent.changed
        delete resent.resentsIds
        delete resent.resentsRevs
        delete resent['_id']
        return resent
      })
      msg.resentsCompiled.sort((a, b) => (a.created > b.created) ? 1 : -1)
    }
    msg.resents = msg.resentsIds
    delete msg.changed
    delete msg.resentsIds
    delete msg.resentsRevs
    return msg
  }).sort((a, b) => (a.created > b.created) ? 1 : -1)
  return ready
  }

  async getChannelMessage(channelId, messageId, userId): Promise<Message> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
    if (!(perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.READ_MESSAGES
    ))) throw new ForbiddenException()

    const data = await this.messageModel.aggregate([
      { 
        $match: {
          id: messageId,
          deleted: false 
        }
      },
      { 
        $graphLookup: {
          from: 'messages',
          startWith: '$resentsIds',
          connectFromField: 'resentsIds',
          connectToField: 'id',
          as: 'resentsCompiled',
          maxDepth: 0,
        },
      },
      { $unset: ['_id', 'deleted', '__v'] }
    ])
    const ready = data.map(msg => {
      if (msg.resentsCompiled.length) {
        msg.resentsCompiled.map((resent, i) => {
          resent.resents = resent.resentsIds
          if (resent.changed.length != msg.resentsRevs[i]) {
            resent = resent.changed[msg.resentsRevs[i]]
          }
          delete resent.changed
          delete resent.resentsIds
          delete resent.resentsRevs
          delete resent['_id']
          return resent
        })
        msg.resentsCompiled.sort((a, b) => (a.created > b.created) ? 1 : -1)
      }
      msg.resents = msg.resentsIds
      delete msg.changed
      delete msg.resentsIds
      delete msg.resentsRevs
      return msg
    })
    return ready[0]
  }

  async createMessage(userId: string, channelId: string, messageDto: CreateMessageDto, systemData?: any): Promise<any> /* will fix later */ {
    
    const channel = await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()
    const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
    if (!(perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.WRITE_MESSAGES
    ))
    && !systemData?.type
    ) throw new ForbiddenException()

    const sf = new UniqueID(config.snowflake)
    const message = new this.messageModel()
    message.id = sf.getUniqueID()
    message.created = sf.getTimestampFromID(message.id)
    message.author = userId
    message.channel_id = channelId
    if (
      messageDto.content 
      || 
      (messageDto.resents || messageDto.sticker || messageDto.attachments)
      || systemData?.type
    )
      message.content = messageDto.content
    else throw new BadRequestException()

    if (systemData?.type)
      message.type = systemData.type  
    if (messageDto.sticker && perms &
      ComputedPermissions.ATTACH_STICKERS
    ) message.sticker
    // if (messageDto.embed)
    // if (nmessageDto.resents)
    // if (messageDto.attachments)
    await message.save()
    const { _id, deleted, edit_history, resentRevs, resentIds, ...cleanedMessage } = message.toObject()

    const data = {
      event: 'message.created',
      data: cleanedMessage
    }
    this.eventEmitter.emit(
      'message.created',
      data, 
      channel?.guild_id
    )
    return cleanedMessage
  }

  async crosspostMessage(channelId, messageId) {}

  async createReaction(channelId: string, messageId: string, emojiId: string, userId: string): Promise<void> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    if (channel.type > 2) {
      const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
      if (!(perms & (
        ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.ADD_REACTIONS
      ))) throw new ForbiddenException()
      
      if (!(perms & 
        ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.ADD_EXTERNAL_REACTIONS) 
        && !await this.emojiModel.exists({ id: emojiId, owner_id: channel.guild_id }
      )) throw new ForbiddenException()
    }

    const message = await this.messageModel.findOne({ id: messageId, channel_id: channelId })
    const reactionIndex = message.reactions.findIndex(reaction => reaction.emoji_id == emojiId)
    if (reactionIndex + 1) {
      if (message.reactions[reactionIndex] && message.reactions[reactionIndex].users.length === 10) throw new ForbiddenException()
      if (message.reactions[reactionIndex].users?.includes(userId)) throw new ForbiddenException()
      message.reactions[reactionIndex].users.push(userId)
    } else {
      message.reactions.push({ emoji_id: emojiId, users: [ userId ] })
    }
    message.markModified('reactions')
    await message.save()

    const data = {
      event: 'message.reaction_added',
      data: {
        emoji_id: emojiId,
        user_id: userId,
        message_id: messageId,
        channel_id: channelId
      }
    }
    this.eventEmitter.emit(
      'message.reaction_added',
      data, 
      channel?.guild_id
    )

    return
  
  }

  async deleteReaction(channelId: string, messageId: string, emojiId: string, userId: string): Promise<void> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    const message = await this.messageModel.findOne({ id: messageId, channel_id: channelId, 'reactions.emoji_id': emojiId })
    if (!message) throw new BadRequestException()
    
    const reactionIndex = message.reactions.findIndex(reaction => reaction.emoji_id == emojiId)
    const userIndex = message.reactions[reactionIndex].users.indexOf(userId)
    message.reactions[reactionIndex].users.splice(userIndex, 1)
    if (!message.reactions[reactionIndex].users.length) message.reactions.splice(reactionIndex, 1)
    message.markModified('reactions')
    await message.save()

    const data = {
      event: 'message.reaction_deleted',
      data: {
        emoji_id: emojiId,
        user_id: userId,
        message_id: messageId,
        channel_id: channelId
      }
    }
    this.eventEmitter.emit(
      'message.reaction_deleted',
      data, 
      channel?.guild_id
    )

    return
  }

  async getReactions(channelId, messageId, emojiId) {}

  async deleteReactions(channelId, messageId) {}

  async deleteReactionsForEmoji(channelId, messageId) {}

  async editMessage(channelId, messageId, message) {}

  async deleteMessage(channelId, messageId, userId): Promise<void> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    const message = await this.messageModel.findOne({ id: messageId }, '-_id author')

    if (message.author === userId) {
      await this.messageModel.updateOne(
        { id: messageId, channel_id: channelId },
        { $set: { deleted: true } }
      )
    } else if (channel.type === ChannelType.GUILD_TEXT || channel.type === ChannelType.GUILD_PUBLIC_THREAD) {
      const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
      if (!(perms & (
        ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.MANAGE_MESSAGES
      ))) throw new ForbiddenException()

      await this.messageModel.updateOne(
        { id: messageId, channel_id: channelId },
        { $set: { deleted: true } }
      )
    } else throw new ForbiddenException()

    const data = {
      event: 'message.deleted',
      data: {
        id: messageId,
        channel_id: channelId,
        author: message.author,
        deleted_by: userId
      }
    }
    this.eventEmitter.emit(
      'message.deleted',
      data,
      channel?.guild_id
    )

    return
  }

  async deleteMessages(channelId: string, messageIds: string[], userId: string) {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    const messages = await this.messageModel.find({ id: messageIds, author: userId })
    if (messageIds.length === messages.length) {
      await this.messageModel.updateMany(
        { id: messageIds, channel_id: channelId },
        { $set: { deleted: true } }
      )
    } else {
      const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
      if (!(perms & (
        ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.BULK_DELETE
      ))) throw new ForbiddenException()
      await this.messageModel.updateMany(
        { id: messageIds, channel_id: channelId },
        { $set: { deleted: true } }
      )
    }

    const data = {
      event: 'message.bulk_deleted',
      data: {
        id: messageIds,
        channel_id: channelId,
        deleted_by: userId
      }
    }
    this.eventEmitter.emit(
      'message.bulk_deleted',
      data,
      channel?.guild_id
    )
    return
  }

  async editPermissions(channelId, overwriteId) {}

  async getInvites(channelId) {
    const invites = await this.inviteModel.find(
      { channel_id: channelId },
      '-_id'
    )
    return invites
  }

  async creaateInvite(channelId: string, inviteDto: CreateInviteDto, userId): Promise<Invite> {

    const channel = await this.channelModel.findOne({ id: channelId }).lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM) throw new BadRequestException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
    if (!(perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.CREATE_INVITES
    ))) throw new ForbiddenException()

    const invite = new this.inviteModel()
    if (inviteDto.max_age === 0) invite.code = this.inviteCodeGenerator(12) // forever invite requires more symbols for non-repeating combination
    else invite.code = this.inviteCodeGenerator(6)
    invite.channel_id = channelId
    invite.guild_id = channel.guild_id
    if (inviteDto.max_uses) invite.max_uses = inviteDto.max_uses
    if (inviteDto.temporary) invite.temporary = inviteDto.temporary
    await invite.save()
    return invite
  }

  async followChannel(channelId, followDto) {}

  async typing(channelId, userId) {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()
    const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
    if (!(perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.WRITE_MESSAGES
    ))) throw new ForbiddenException()

    const data = {
      event: 'channel.typing',
      data: {
        user_id: userId,
        channel_id: channelId,
      }
    }
    this.eventEmitter.emit(
      'channel.typing',
      data, 
      channel?.guild_id
    )
    return
  }

  async pinMessage(channelId, messageId, userId): Promise<void> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
    if (!(perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.MANAGE_MESSAGES
    ))) throw new ForbiddenException()
    const msgChannelId = await this.messageModel.exists({ id: messageId, channel_id: channelId })
    if (!msgChannelId) throw new BadRequestException()
    await this.channelModel.updateOne(
      { id: channelId },
      { $push: { pinned_messages_ids: messageId } }
    )

    const data = {
      event: 'message.pinned',
      data: {
        id: messageId,
        channel_id: channelId,
      }
    }
    this.eventEmitter.emit(
      'message.pinned',
      data, 
      channel?.guild_id
    )
    this.createMessage(userId, channelId, {}, { type: MessageType.PIN })
    return
  }

  async deletePinnedMessage(channelId, messageId, userId): Promise<void> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type, recipients, guild_id').lean()
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM)
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    if (!await this.guildService.isMember(channel.guild_id, userId)) throw new ForbiddenException()

    const perms = await this.parser.computePermissions(channel.guild_id, userId, channelId)
    if (!(perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.MANAGE_MESSAGES
    ))) throw new ForbiddenException()

    await this.channelModel.updateOne(
      { id: channelId },
      { $pull: { pinned_messages_ids: messageId } }
    )

    const data = {
      event: 'message.unpinned',
      data: {
        id: messageId,
        channel_id: channelId,
      }
    }
    this.eventEmitter.emit(
      'message.unpinned',
      data, 
      channel?.guild_id
    )

    return
  }

  async addRecipient(channelId, userId) {}

  async removeRecipient(channelId, userId) {}

  private inviteCodeGenerator(length: number): string {
    const alpabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let code = ''
    for (let i = 0; i < length; i++)
      code += alpabet[(Math.random() * alpabet.length).toFixed()]
    return code
  }

  async isMember(channelId, userId) {
    return await this.channelModel.exists({ id: channelId, recipients: userId })
  }
}
