import { GetChannelMessagesDto } from './dto/get-channel-messages.dto';
import { MessageResponse, MessageResponseValidate } from './responses/message.response';
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
import { BadRequestException, Injectable, NotFoundException, ForbiddenException, Inject, CACHE_MANAGER } from '@nestjs/common';
import { Model } from 'mongoose';
import { UniqueID } from 'nodejs-snowflake';
import { EventEmitter2 } from '@nestjs/event-emitter';
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

  async getChannelMessages(channelId, filters: GetChannelMessagesDto, userId): Promise<MessageResponse[]> {
    const channel = await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id').lean()
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
      $match: filters.ids 
      ? {
         id: { $in: filters.ids },
         channel_id: channelId,
         deleted: false 
        }

      : {
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
        startWith: '$forwarded_ids',
        connectFromField: 'forwarded_ids',
        connectToField: 'id',
        as: 'forwarded_compiled',
        maxDepth: 0,
      },
    },
    { $unset: ['_id', 'deleted', '__v'] }
  ])
  const ready = data.map(msg => {
    return this.messageParser(msg)
  }).sort((a, b) => (a.created > b.created) ? 1 : -1)
  return ready
  }

  async getChannelMessage(channelId, messageId, userId): Promise<MessageResponse> {
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

    const data = (await this.messageModel.aggregate([
      { 
        $match: {
          id: messageId,
          deleted: false 
        }
      },
      { 
        $graphLookup: {
          from: 'messages',
          startWith: '$forwarded_ids',
          connectFromField: 'forwarded_ids',
          connectToField: 'id',
          as: 'forwarded_compiled',
          maxDepth: 0,
        },
      },
      { $unset: ['_id', 'deleted', '__v'] }
    ]))[0]
    const message = this.messageParser(data)
    return message
  }
  async createMessage(userId: string, channelId: string, messageDto: CreateMessageDto, systemData?: any): Promise<MessageResponse> {
    console.log(messageDto)
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
    message.type = systemData?.type || 0

    if (channel.guild_id)
      message.guild_id = channel.guild_id
    
    if (
      !(
        messageDto.content 
        || 
        (messageDto.forwarded_messages || messageDto.sticker || messageDto.attachments)
        || systemData?.type
      )
    ) throw new BadRequestException()

    if (!messageDto.sticker)
      message.content = messageDto?.content
 
    let forwarded_messages: Message[]
    if (messageDto.forwarded_messages) {
      forwarded_messages = await this.messageModel.aggregate([
        { $match: { id: { $in: messageDto.forwarded_messages }, allow_forwarding: true, deleted: false } },
        { $sort: { id: 1 } }
      ])
      if (forwarded_messages) {
        for (const msg of forwarded_messages) {
          const perms2 = await this.parser.computePermissions(msg.guild_id, userId, msg.channel_id)
          if (
            msg.guild_id !== channel.guild_id &&
            !(perms2 & 
              ComputedPermissions.FORWARD_MESSAGES_FROM_SERVER |
              ComputedPermissions.OWNER |
              ComputedPermissions.ADMINISTRATOR
            )
          ) throw new BadRequestException()
          message.forwarded_ids.push(msg.id)
          message.forwarded_revs.push(msg.edit_history?.length || 0)
        }
      }
    }
    // if (messageDto.attachments)
    await message.save()
    const message2 = <AgreggatedMessage>Object.assign(message.toObject(), { forwarded_compiled: forwarded_messages })
    const cleanedMessage = this.messageParser(message2)
    console.log(cleanedMessage)
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
    const channel = await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id').lean()
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
    const channel = await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id').lean()
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
    const channel = await (await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id')).toObject()
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
    const channel = await (await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id')).toObject()
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
    const channel = await (await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id')).toObject()
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
    const channel = await (await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id')).toObject()
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
    const channel = await (await this.channelModel.findOne({ id: channelId }, 'type recipients guild_id')).toObject()
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

  async getPinnedMessages(channelId, userId) {
    const messages = await (await this.channelModel.findOne({ id: channelId }, 'pinned_messages_ids')).toObject().pinned_messages_ids
    return await this.getChannelMessages(channelId, { ids: messages, count: messages.length.toString() }, userId)
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



  private messageParser(message: AgreggatedMessage) {
    message.forwarded_messages = []
    if (message.forwarded_ids.length) {
     for (const i in message.forwarded_compiled) {
      message.forwarded_messages.push(MessageResponseValidate(message.forwarded_compiled[i].edit_history[message.forwarded_revs[i]] || message.forwarded_compiled[i]))
     }
    }
    return MessageResponseValidate(message)
  }

  async isMember(channelId, userId) {
    return await this.channelModel.exists({ id: channelId, recipients: userId })
  }
}
class AgreggatedMessage extends Message {
  forwarded_compiled: Message[]
  forwarded_messages: MessageResponse[]
}