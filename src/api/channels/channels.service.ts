import { config } from './../../app.config';
import { Invite, InviteDocument } from './../invites/schemas/invite.schema';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { Channel, ChannelDocument } from './schemas/channel.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { BadRequestException, Injectable, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { Model } from 'mongoose';
import { UniqueID } from 'nodejs-snowflake';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
  ) {}

  async getChannel(channelId) {
    const channel = await this.channelModel.findOne({ id: channelId }).select('-_id').lean()
    if (!channel) throw new NotFoundException()
    return channel
  }

  async deleteChannel(channelId) {}

  async getChannelMessages(channelId, filters) {
    const data = await this.messageModel.aggregate([
    { 
      $match: {
        channel_id: channelId,
        created: { $gt: filters?.after || 0 },
        deleted: false 
      }
    },
    { $skip: filters?.offset || 0 },
    { $sort: { created: -1 } },
    { $limit: filters?.count || 50 },
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
  console.log(data)
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

  async getChannelMessage(channelId, messageId) {
    console.log(channelId, messageId)
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
    console.log(data)
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
    })
    return ready[0]
  }

  async createMessage(userId: string, channelId: string, messageDto: CreateMessageDto) {
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
    )
      message.content = messageDto.content
    else throw new BadRequestException()

    if (messageDto.sticker) message.sticker
    // if (messageDto.embed)
    // if (nmessageDto.resents)
    // if (messageDto.attachments)
  return message.save()
    .then(msg => {
      // тут надо будет по сокету отправлять мессаг
      delete msg['_id']
      delete msg['deleted']
      return msg
    })
    .catch(error => { throw new InternalServerErrorException() })
  }

  async crosspostMessage(channelId, messageId) {}

  async createReaction(channelId: string, messageId: string, emojiId: string, userId: string) {
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
    return
  
  }

  async deleteReaction(channelId: string, messageId: string, emojiId: string, userId: string) {
    const message = await this.messageModel.findOne({ id: messageId, channel_id: channelId, 'reactions.emoji_id': emojiId })
    if (!message) throw new BadRequestException()
    
    const reactionIndex = message.reactions.findIndex(reaction => reaction.emoji_id == emojiId)
    const userIndex = message.reactions[reactionIndex].users.indexOf(userId)
    message.reactions[reactionIndex].users.splice(userIndex, 1)
    if (!message.reactions[reactionIndex].users.length) message.reactions.splice(reactionIndex, 1)
    message.markModified('reactions')
    await message.save()
    return
  }

  async getReactions(channelId, messageId, emojiId) {}

  async deleteReactions(channelId, messageId) {}

  async deleteReactionsForEmoji(channelId, messageId) {}

  async editMessage(channelId, messageId, message) {}

  async deleteMessage(channelId, messageId) {
    await this.messageModel.updateOne(
      { id: messageId, channel_id: channelId },
      { $set: { deleted: true } }
    )
    return
  }

  async deleteMessages(channelId, messageIds) {
    await this.messageModel.updateMany(
      { id: messageIds, channel_id: channelId },
      { $set: { deleted: true } }
    )
    return
  }

  async editPermissions(channelId, overwriteId) {}

  async getInvites(channelId) {
    const invites = await this.inviteModel.find(
      { channel_id: channelId },
      '-_id -__v'
    )
    return invites
  }

  async creaateInvite(channelId: string, inviteDto: CreateInviteDto) {
    const channel = await this.channelModel.findOne({ id: channelId }).lean()
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

  async typing(channelId) {}

  async pinMessage(channelId, messageId) {
    const msgChannelId = await this.messageModel.findOne({ id: messageId, channel_id: channelId }).lean('id')
    if (!msgChannelId) throw new BadRequestException()
    await this.channelModel.updateOne(
      { id: channelId },
      { $push: { pinned_messages_ids: messageId } }
    )
    return
  }

  async deletePinnedMessage(channelId, messageId) {
    await this.channelModel.updateOne(
      { id: channelId },
      { $pull: { pinned_messages_ids: messageId } }
    )
    return
  }

  async addRecipient(channelId, userId) {}

  async removeRecipient(channelId, userId) {}

  private inviteCodeGenerator(length: number) {
    const alpabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let code = ''
    for (let i = 0; i < length; i++)
      code += alpabet[(Math.random() * alpabet.length).toFixed()]
    return code
  }
}
