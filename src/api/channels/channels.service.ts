import {
  BadRequestException,
  CACHE_MANAGER,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectModel } from '@nestjs/mongoose'
import { Cache } from 'cache-manager'
import { Model } from 'mongoose'
import { UniqueID } from 'nodejs-snowflake'
import { ParserUtils } from 'utils/parser/parser.utils'
import emojiRegex from 'emoji-regex'
import { EmojiResponseValidate } from './../emojis/responses/emoji.response'
import {
  EmojiPack,
  EmojiPackDocument,
  EmojiPackType,
} from './../emojis/schemas/emojiPack.schema'
import { config } from './../../app.config'
import { Emoji, EmojiDocument } from './../emojis/schemas/emoji.schema'
import { File, FileType, FileDocument } from './../files/schemas/file.schema'
import { GuildsService } from './../guilds/guilds.service'
import { ComputedPermissions } from './../guilds/schemas/role.schema'
import { Invite, InviteDocument } from './../invites/schemas/invite.schema'
import { UserResponse } from './../users/responses/user.response'
import { User, UserDocument } from './../users/schemas/user.schema'
import { CreateInviteDto } from './dto/create-invite.dto'
import { CreateMessageDto } from './dto/create-message.dto'
import { EditMessageDto } from './dto/edit-message.dto'
import { GetChannelMessagesDto } from './dto/get-channel-messages.dto'
import {
  ChannelResponse,
  ChannelResponseValidate,
} from './responses/channel.response'
import {
  MessageAttachment,
  MessageAttachmentValidate,
  MessageResponse,
  MessageResponseValidate,
  MessageUserValidate,
} from './responses/message.response'
import { Channel, ChannelDocument, ChannelType } from './schemas/channel.schema'
import { Message, MessageDocument, MessageType } from './schemas/message.schema'

@Injectable()
export class ChannelsService {
  constructor(
    @InjectModel(Channel.name) private channelModel: Model<ChannelDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Invite.name) private inviteModel: Model<InviteDocument>,
    @InjectModel(EmojiPack.name)
    private emojiPackModel: Model<EmojiPackDocument>,
    @InjectModel(Emoji.name) private emojiModel: Model<EmojiDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    @Inject(CACHE_MANAGER) private onlineManager: Cache,
    private guildService: GuildsService,
    private parser: ParserUtils,
    private eventEmitter: EventEmitter2,
    private guildsService: GuildsService,
  ) {}

  async getChannel(channelId: string): Promise<ChannelResponse> {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new NotFoundException()
    return ChannelResponseValidate(channel)
  }
  async deleteChannel(channelId: string, userId: string): Promise<void> {
    const channel = await this.getExistsChannel(channelId)
    if (!channel) throw new NotFoundException()

    // 0 and 1 - DM channels
    if (channel.type > 1) {
      if (!this.guildsService.isMember(channel.guild_id, userId))
        throw new ForbiddenException()
      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.MANAGE_CHANNELS)
        )
      )
        throw new ForbiddenException()
    } else {
      if (channel.owner_id !== userId) throw new ForbiddenException()
    }

    // потом надо аудиты запилить
    const data = {
      event: 'guild.channel_deleted',
      data: { id: channelId },
    }
    channel.deleted = true
    await channel.save()

    await this.messageModel.updateMany(
      { channel_id: channelId, deleted: false },
      { $set: { deleted: true } },
    )
    this.eventEmitter.emit('guild.channel_deleted', data, channel.guild_id)
    return
  }

  async getChannelMessages(
    channelId,
    filters: GetChannelMessagesDto,
    userId,
    one?,
  ): Promise<MessageResponse[] | MessageResponse> {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new BadRequestException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()
      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.READ_MESSAGES)
        )
      )
        throw new ForbiddenException()
    }

    const data: AgreggatedMessage[] = await this.messageModel.aggregate([
      {
        $match: filters.ids
          ? {
              id: { $in: filters.ids },
              channel_id: channelId,
              deleted: false,
            }
          : {
              channel_id: channelId,
              created: {
                $gt: parseInt(filters?.after) || 0,
                $lt: parseInt(filters?.before) || Date.now(),
              },
              deleted: false,
            },
      },
      { $sort: { created: -1 } },
      { $skip: parseInt(filters?.offset) || 0 },
      { $limit: parseInt(filters?.count) || 50 },
      {
        $lookup: {
          from: 'messages',
          localField: 'forwarded_ids',
          foreignField: 'id',
          as: 'forwarded_compiled',
        },
      },
      {
        $lookup: {
          from: 'files',
          localField: 'attachment_ids',
          foreignField: 'id',
          as: 'attachments_compiled',
        },
      },
      {
        $addFields: {
          fwd_atch_ids: {
            $map: {
              input: '$forwarded_compiled',
              as: 'fwd',
              in: '$$fwd.attachment_ids',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: 'id',
          as: 'userObject',
        },
      },
      {
        $unwind: '$userObject',
      },
      {
        $addFields: {
          f_ids: {
            $map: {
              input: '$forwarded_compiled',
              as: 'fwd',
              in: '$$fwd.author',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'f_ids',
          foreignField: 'id',
          as: 'forwarded_compiled_users',
        },
      },
      {
        $lookup: {
          from: 'emojis',
          localField: 'reaction_ids',
          foreignField: 'id',
          as: 'emojis_compiled',
        },
      },
    ])
    let att_ids = []
    data.map((mess) => {
      if (mess.fwd_atch_ids.length) {
        att_ids = att_ids.concat(mess.fwd_atch_ids[0])
      }
    })
    const compiled_atts = await this.fileModel.find({ id: { $in: att_ids } })
    data.map((mess) => {
      if (mess.fwd_atch_ids.length) {
        mess.forwarded_compiled_attachments = []
        for (const aid of mess.fwd_atch_ids[0]) {
          const attIndex = compiled_atts.findIndex((att) => att.id == aid)
          mess.forwarded_compiled_attachments.push(compiled_atts[attIndex])
        }
      }
    })
    if (!data.length && one) throw new NotFoundException()
    if (one && filters?.ids.length === 1) return this.parseMessage(data[0])

    const ready = data
      .map(this.parseMessage)
      .sort((a, b) => (a.created > b.created ? 1 : -1))

    return ready
  }

  async createMessage(
    userId: string,
    channelId: string,
    messageDto: CreateMessageDto,
    systemData?: any,
  ): Promise<MessageResponse> {
    if (messageDto.content && messageDto.content.replaceAll(' ', '') === '')
      throw new BadRequestException()

    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new BadRequestException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()
      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.WRITE_MESSAGES)
        ) &&
        !systemData?.type
      )
        throw new ForbiddenException()
    }

    const sf = new UniqueID(config.snowflake)
    const message = new this.messageModel()
    message.id = sf.getUniqueID()
    message.created = sf.getTimestampFromID(message.id)
    message.author = userId
    message.channel_id = channelId
    message.type = systemData?.type || 0

    if (channel.guild_id) message.guild_id = channel.guild_id

    if (messageDto.allow_forwarding)
      message.allow_forwarding = messageDto.allow_forwarding

    if (
      !(
        messageDto.content ||
        messageDto.forwarded_messages.length ||
        messageDto.sticker ||
        messageDto.attachments.length ||
        systemData?.type
      ) &&
      messageDto.content == ''
    )
      throw new BadRequestException()

    if (!messageDto.sticker)
      message.content = messageDto?.content.replaceAll(/(\s){2,}/gm, ' ')

    let forwarded_messages: Message[]
    const forwarded_messages_users_ids: string[] = []
    let forwarded_messages_attachment_ids: string[] = []
    if (messageDto.forwarded_messages) {
      forwarded_messages = await this.messageModel.aggregate([
        {
          $match: {
            id: { $in: messageDto.forwarded_messages },
            allow_forwarding: true,
            deleted: false,
          },
        },
        { $sort: { id: 1 } },
      ])
      if (forwarded_messages) {
        for (const msg of forwarded_messages) {
          if (channel.guild_id) {
            const perms2 = await this.parser.computePermissions(
              msg.guild_id,
              userId,
              msg.channel_id,
            )
            if (
              msg.guild_id !== channel.guild_id &&
              !(
                (perms2 & ComputedPermissions.FORWARD_MESSAGES_FROM_SERVER) |
                ComputedPermissions.OWNER |
                ComputedPermissions.ADMINISTRATOR
              )
            )
              throw new BadRequestException()
          }
          message.forwarded_ids.push(msg.id)
          message.forwarded_revs.push(msg.edit_history?.length || 0)
          forwarded_messages_users_ids.push(msg.author)
          forwarded_messages_attachment_ids = forwarded_messages_attachment_ids.concat(
            msg.attachment_ids,
          )
        }
      }
    }
    let attachments: FileDocument[]
    if (messageDto.attachments) {
      attachments = await this.fileModel.find({
        id: messageDto.attachments,
        type: FileType.ATTACHMENT,
        owner_id: userId,
      })
      for (const att of attachments) message.attachment_ids.push(att.id)
    }
    await message.save()
    const message2 = <MessageResponse>(
      await this.getChannelMessages(
        message.channel_id,
        { ids: [message.id] },
        userId,
        true,
      )
    )
    const data = {
      event: 'message.created',
      data: message2,
    }
    this.eventEmitter.emit('message.created', data, channel?.guild_id)
    return message2
  }

  // async crosspostMessage(channelId, messageId) {}

  async createReaction(
    channelId: string,
    messageId: string,
    emojiId: string,
    userId: string,
  ): Promise<void> {
    const user = (await this.userModel.findOne({ id: userId })).toObject()
    const unicodeEmojiTest = emojiId.match(emojiRegex())
    let reaction: string
    let emoji
    if (unicodeEmojiTest?.length === 1) {
      reaction = <string>unicodeEmojiTest[0][0]
    } else {
      emoji = (await this.emojiModel.findOne({ id: emojiId })).toObject()
      if (!user.emoji_packs_ids.includes(emoji.pack_id))
        throw new ForbiddenException()
      const pack = (
        await this.emojiPackModel.findOne({ id: emoji.pack_id })
      ).toObject()
      if (pack.type === EmojiPackType.STICKER) throw new BadRequestException()
      reaction = emoji.id
    }
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new BadRequestException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()

      if (channel.type > 2) {
        const perms = await this.parser.computePermissions(
          channel.guild_id,
          userId,
          channelId,
        )
        if (
          !(
            perms &
            (ComputedPermissions.OWNER |
              ComputedPermissions.ADMINISTRATOR |
              ComputedPermissions.ADD_REACTIONS)
          )
        )
          throw new ForbiddenException()

        if (
          !(
            (perms & ComputedPermissions.OWNER) |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.ADD_EXTERNAL_REACTIONS
          )
        )
          throw new ForbiddenException()
      }
    }

    const message = await this.messageModel.findOne({
      id: messageId,
      channel_id: channelId,
    })
    const reactionIndex = message.reactions.findIndex(
      (react) => react.emoji_id == reaction,
    )
    if (reactionIndex + 1) {
      if (
        message.reactions[reactionIndex] &&
        message.reactions[reactionIndex].users.length === 10
      )
        throw new ForbiddenException()
      if (message.reactions[reactionIndex].users?.includes(userId))
        throw new ForbiddenException()
      message.reactions[reactionIndex].users.push(userId)
    } else {
      message.reaction_ids.push(reaction)
      message.reactions.push({ emoji_id: reaction, users: [userId] })
    }
    message.markModified('reactions')
    await message.save()

    const data = {
      event: 'message.reaction_added',
      data: {
        emoji_id: reaction,
        user_id: userId,
        message_id: messageId,
        channel_id: channelId,
        emoji,
      },
    }
    this.eventEmitter.emit('message.reaction_added', data, channel?.guild_id)

    return
  }

  async deleteReaction(
    channelId: string,
    messageId: string,
    emojiId: string,
    userId: string,
  ): Promise<void> {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new BadRequestException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()
    }

    const message = await this.messageModel.findOne({
      id: messageId,
      channel_id: channelId,
      'reactions.emoji_id': emojiId,
    })
    if (!message) throw new BadRequestException()

    const reactionIndex = message.reactions.findIndex(
      (reaction) => reaction.emoji_id == emojiId,
    )
    const userIndex = message.reactions[reactionIndex].users.indexOf(userId)
    message.reactions[reactionIndex].users.splice(userIndex, 1)
    if (!message.reactions[reactionIndex].users.length) {
      message.reactions.splice(reactionIndex, 1)
      message.reaction_ids.splice(message.reaction_ids.indexOf(emojiId), 1)
    }
    message.markModified('reactions')
    await message.save()

    const data = {
      event: 'message.reaction_deleted',
      data: {
        emoji_id: emojiId,
        user_id: userId,
        message_id: messageId,
        channel_id: channelId,
      },
    }
    this.eventEmitter.emit('message.reaction_deleted', data, channel?.guild_id)

    return
  }

  // async getReactions(channelId, messageId, emojiId) {}

  // async deleteReactions(channelId, messageId) {}

  // async deleteReactionsForEmoji(channelId, messageId) {}

  async editMessage(
    channelId: string,
    messageId: string,
    messageDto: EditMessageDto,
    userId: string,
  ) {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new NotFoundException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()

      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.WRITE_MESSAGES)
        )
      )
        throw new ForbiddenException()
    }

    let changes = 0

    const message = await this.messageModel.findOne({
      id: messageId,
      author: userId,
      deleted: false,
    })
    if (!message) throw new NotFoundException()

    const cachedMessage = message.toObject()
    if (messageDto.content && messageDto.content !== message.content) {
      message.content = messageDto.content
      changes++
    }
    let forwarded_messages: Message[]
    if (
      messageDto.forwarded_messages &&
      messageDto.forwarded_messages.length !== message.forwarded_ids?.length
    ) {
      forwarded_messages = await this.messageModel.aggregate([
        {
          $match: {
            id: { $in: messageDto.forwarded_messages },
            allow_forwarding: true,
            deleted: false,
          },
        },
        { $sort: { id: 1 } },
      ])
      if (forwarded_messages) {
        message.forwarded_ids = []
        message.forwarded_revs = []
        for (const msg of forwarded_messages) {
          if (msg.guild_id) {
            const perms2 = await this.parser.computePermissions(
              msg.guild_id,
              userId,
              msg.channel_id,
            )
            if (
              msg.guild_id !== channel.guild_id &&
              !(
                (perms2 & ComputedPermissions.FORWARD_MESSAGES_FROM_SERVER) |
                ComputedPermissions.OWNER |
                ComputedPermissions.ADMINISTRATOR
              )
            )
              throw new BadRequestException()
          }
          message.forwarded_ids.push(msg.id)
          message.forwarded_revs.push(msg.edit_history?.length || 0)
          changes++
        }
      }
    }
    if (!changes) throw new BadRequestException()

    message.edited = true
    message.edit_time = Date.now()
    message.edit_history.push(cachedMessage)
    await message.save()
    const message2 = await this.getChannelMessages(
      message.channel_id,
      { ids: [message.id] },
      userId,
      true,
    )

    const data = {
      event: 'message.edited',
      data: message2,
    }
    this.eventEmitter.emit('message.edited', data, channel?.guild_id)
    return message2
  }

  async deleteMessage(channelId, messageId, userId): Promise<void> {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new NotFoundException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()
    }

    const message = await this.messageModel.findOne(
      { id: messageId },
      '-_id author',
    )

    if (message.author === userId) {
      await this.messageModel.updateOne(
        { id: messageId, channel_id: channelId },
        { $set: { deleted: true } },
      )

      await this.channelModel.updateOne(
        { id: channelId },
        { $pull: { pinned_messages_ids: messageId } },
      )
    } else if (
      channel.type === ChannelType.GUILD_TEXT ||
      channel.type === ChannelType.GUILD_PUBLIC_THREAD
    ) {
      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.MANAGE_MESSAGES)
        )
      )
        throw new ForbiddenException()

      await this.messageModel.updateOne(
        { id: messageId, channel_id: channelId },
        { $set: { deleted: true } },
      )

      await this.channelModel.updateOne(
        { id: channelId },
        { $pull: { pinned_messages_ids: messageId } },
      )
    } else throw new ForbiddenException()

    const data = {
      event: 'message.deleted',
      data: {
        id: messageId,
        channel_id: channelId,
        author: message.author,
        deleted_by: userId,
      },
    }
    this.eventEmitter.emit('message.deleted', data, channel?.guild_id)

    return
  }

  async deleteMessages(
    channelId: string,
    messageIds: string[],
    userId: string,
  ) {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new NotFoundException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()
    }

    const messages = await this.messageModel.find({
      id: messageIds,
      author: userId,
    })
    if (messageIds.length === messages.length) {
      await this.messageModel.updateMany(
        { id: messageIds, channel_id: channelId },
        { $set: { deleted: true } },
      )
    } else if (
      channel.type === ChannelType.GUILD_TEXT ||
      channel.type === ChannelType.GUILD_PUBLIC_THREAD
    ) {
      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.BULK_DELETE)
        )
      )
        throw new ForbiddenException()
      await this.messageModel.updateMany(
        { id: messageIds, channel_id: channelId },
        { $set: { deleted: true } },
      )

      await this.channelModel.updateOne(
        { id: channelId },
        { $pull: { pinned_messages_ids: { $in: messageIds } } },
      )
    }

    const data = {
      event: 'message.bulk_deleted',
      data: {
        id: messageIds,
        channel_id: channelId,
        deleted_by: userId,
      },
    }
    this.eventEmitter.emit('message.bulk_deleted', data, channel?.guild_id)
    return
  }

  // async editPermissions(channelId, overwriteId) {}

  async getInvites(channelId: string) {
    const invites = await this.inviteModel.find(
      { channel_id: channelId },
      '-_id',
    )
    return invites
  }

  async createInvite(
    channelId: string,
    inviteDto: CreateInviteDto,
    userId,
  ): Promise<Invite> {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new BadRequestException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    )
      throw new BadRequestException()
    if (!(await this.guildService.isMember(channel.guild_id, userId)))
      throw new ForbiddenException()

    const perms = await this.parser.computePermissions(
      channel.guild_id,
      userId,
      channelId,
    )
    if (
      !(
        perms &
        (ComputedPermissions.OWNER |
          ComputedPermissions.ADMINISTRATOR |
          ComputedPermissions.CREATE_INVITES)
      )
    )
      throw new ForbiddenException()

    const invite = new this.inviteModel()
    if (inviteDto.max_age === 0) invite.code = this.inviteCodeGenerator(12)
    // forever invite requires more symbols for non-repeating combination
    else invite.code = this.inviteCodeGenerator(6)
    invite.channel_id = channelId
    invite.guild_id = channel.guild_id
    if (inviteDto.max_uses) invite.max_uses = inviteDto.max_uses
    if (inviteDto.temporary) invite.temporary = inviteDto.temporary
    await invite.save()
    return invite
  }

  // async followChannel(channelId: string, followDto: FollowChannelDto) {}

  async typing(channelId, userId) {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new BadRequestException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()
      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.WRITE_MESSAGES)
        )
      )
        throw new ForbiddenException()
    }

    const data = {
      event: 'channel.typing',
      data: {
        user_id: userId,
        channel_id: channelId,
      },
    }
    this.eventEmitter.emit('channel.typing', data, channel?.guild_id)
    return
  }

  async pinMessage(channelId, messageId, userId): Promise<void> {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new NotFoundException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()

      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.MANAGE_MESSAGES)
        )
      )
        throw new ForbiddenException()
    }
    const msgChannelId = await this.messageModel.exists({
      id: messageId,
      channel_id: channelId,
      type: { $lt: 3 },
    })
    if (!msgChannelId) throw new BadRequestException()

    const msgPinned = await this.channelModel.exists({
      id: channelId,
      pinned_messages_ids: messageId,
    })
    if (msgPinned) throw new BadRequestException()

    await this.channelModel.updateOne(
      { id: channelId },
      { $push: { pinned_messages_ids: messageId } },
    )

    const data = {
      event: 'message.pinned',
      data: {
        id: messageId,
        channel_id: channelId,
      },
    }
    this.eventEmitter.emit('message.pinned', data, channel?.guild_id)
    this.createMessage(userId, channelId, {}, { type: MessageType.PIN })
    return
  }

  async deletePinnedMessage(channelId, messageId, userId): Promise<void> {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new NotFoundException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()

      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.MANAGE_MESSAGES)
        )
      )
        throw new ForbiddenException()
    }

    await this.channelModel.updateOne(
      { id: channelId },
      { $pull: { pinned_messages_ids: messageId } },
    )

    const data = {
      event: 'message.unpinned',
      data: {
        id: messageId,
        channel_id: channelId,
      },
    }
    this.eventEmitter.emit('message.unpinned', data, channel?.guild_id)

    return
  }

  async getPinnedMessages(channelId, userId) {
    const channel = (await this.getExistsChannel(channelId)).toObject()
    if (!channel) throw new NotFoundException()
    if (
      channel.type === ChannelType.DM ||
      channel.type === ChannelType.GROUP_DM
    ) {
      if (!channel.recipients.includes(userId)) throw new ForbiddenException()
    } else {
      if (!(await this.guildService.isMember(channel.guild_id, userId)))
        throw new ForbiddenException()

      const perms = await this.parser.computePermissions(
        channel.guild_id,
        userId,
        channelId,
      )
      if (
        !(
          perms &
          (ComputedPermissions.OWNER |
            ComputedPermissions.ADMINISTRATOR |
            ComputedPermissions.READ_MESSAGES)
        )
      )
        throw new ForbiddenException()
    }

    const pinnedMessages = (
      await this.channelModel.findOne({ id: channelId }, 'pinned_messages_ids')
    ).toObject().pinned_messages_ids
    const messages = <MessageResponse[]>(
      await this.getChannelMessages(
        channelId,
        { ids: pinnedMessages, count: pinnedMessages.length.toString() },
        userId,
        false,
      )
    )
    const sortedMessages: MessageResponse[] = []
    messages.map((msg) => {
      sortedMessages[pinnedMessages.indexOf(msg.id)] = msg
    })
    return sortedMessages.filter(Boolean)
  }

  // async addRecipient(channelId, userId) {}

  // async removeRecipient(channelId, userId) {}

  private inviteCodeGenerator(length: number): string {
    const alpabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let code = ''
    for (let i = 0; i < length; i++)
      code += alpabet[(Math.random() * (alpabet.length - 1)).toFixed()]
    return code
  }

  private parseMessage = (message: AgreggatedMessage) => {
    message.user = MessageUserValidate(message.userObject)
    message.forwarded_messages = []
    if (message.forwarded_ids.length) {
      for (const i in message.forwarded_compiled) {
        message.forwarded_compiled[i] =
          <ExtendedMessage>(
            message.forwarded_compiled[i].edit_history[
              message.forwarded_revs[i]
            ]
          ) || message.forwarded_compiled[i]
        message.forwarded_compiled[i].user = MessageUserValidate(
          message.forwarded_compiled_users[
            message.forwarded_compiled_users.findIndex(
              (user) => user.id === message.forwarded_compiled[i].author,
            )
          ],
        )

        message.forwarded_compiled[i].attachments = []
        if (message.forwarded_compiled_attachments.length) {
          console.log(message.forwarded_compiled_attachments)
          message.forwarded_compiled_attachments.map((att) => {
            att.url = `https://cdn.nx.wtf/${att.id}/${this.parser.encodeURI(
              att.name,
            )}`
            if (att?.data?.width)
              att.data.preview_url = `https://cdn.nx.wtf/${
                att.id
              }/${this.parser.encodeURI(att.data.name)}`
            message.forwarded_compiled[i].attachments.push(
              MessageAttachmentValidate(att),
            )
          })
        }

        message.forwarded_messages.push(
          MessageResponseValidate(message.forwarded_compiled[i]),
        )
      }
    }
    message.attachments = []
    if (message.attachment_ids?.length) {
      for (const att of message.attachments_compiled) {
        att.url = `https://cdn.nx.wtf/${att.id}/${this.parser.encodeURI(
          att.name,
        )}`
        if (att?.data?.width)
          att.data.preview_url = `https://cdn.nx.wtf/${
            att.id
          }/${this.parser.encodeURI(att.data.name)}`
        message.attachments.push(MessageAttachmentValidate(att))
      }
    }
    if (message.reaction_ids && message.reaction_ids.length > 0) {
      message.reactions.forEach((reaction, index) => {
        const emojiIndex = message.emojis_compiled.findIndex(
          (em) => em.id === reaction.emoji_id,
        )
        if (!reaction.emoji_id.match(emojiRegex())) {
          message.emojis_compiled[
            emojiIndex
          ].url = `https://cdn.nx.wtf/${message.emojis_compiled[emojiIndex].id}/emoji.webp`
          message.reactions[index].emoji = EmojiResponseValidate(
            message.emojis_compiled[emojiIndex],
          )
        }
      })
    }
    return MessageResponseValidate(message)
  }

  isMember = async (channelId, userId) => {
    return await this.channelModel.exists({ id: channelId, recipients: userId })
  }
  getExistsChannel = async (channelId): Promise<ChannelDocument> => {
    return this.channelModel.findOne({ id: channelId, deleted: false })
  }
}
class AgrMessage {
  fwd_atch_ids: string[]
  user: UserResponse
  userObject: User
  forwarded_compiled_users: UserDocument[]
  forwarded_messages: MessageResponse[]
  forwarded_compiled: ExtendedMessage[]
  attachments: MessageAttachment[]
  attachments_compiled: FileDocument[]
  forwarded_compiled_attachments: FileDocument[]
  emojis_compiled: EmojiDocument[]
}

class extMessage {
  user: UserResponse
  attachments: MessageAttachment[]
}

type ExtendedMessage = extMessage & Message

type AgreggatedMessage = AgrMessage & Message
