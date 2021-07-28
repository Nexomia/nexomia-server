import { Invite } from './../invites/schemas/invite.schema';
import { Message } from './schemas/message.schema';
import { Channel } from './schemas/channel.schema';
import { AccessToken } from './../../interfaces/access-token.interface';
import { GetChannelMessagesDto } from './dto/get-channel-messages.dto';
import { AddDMRecipientDto } from './dto/add-dm-recipient.dto';
import { FollowChannelDto } from './dto/follow-channel.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { OverwritePermissionsDto } from './dto/overwrite-permissions.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ChannelsService } from './channels.service';
import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { DUser } from 'src/decorators/user.decorator';

@Controller('channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get(':channelId')
  async get(@Param('channelId') cid): Promise<Channel> {
    return await this.channelsService.getChannel(cid)
  }

  @Delete(':channelId')
  async delete(@Param('channelId') cid) {
    return await this.channelsService.deleteChannel(cid)
  }

  @Get(':channelId/messages')
  async messages(@Param('channelId') cid, getChannelMessagesDto: GetChannelMessagesDto, @DUser() user: AccessToken): Promise<Message[]> {
    return await this.channelsService.getChannelMessages(cid, getChannelMessagesDto, user.id)
  }

  @Get(':channelId/messages/:messageId')
  async message(@Param() params, @DUser() user: AccessToken): Promise<Message> {
    return await this.channelsService.getChannelMessage(params.channelId, params.messageId, user.id)
  }

  @Post(':channelId/messages')
  async createMessage(@Param('channelId') cid, @Body() createMessageDto: CreateMessageDto, @DUser() user: AccessToken): Promise<Message> {
    return await this.channelsService.createMessage(user.id, cid, createMessageDto)
  }

  @Post(':channelId/messages/:messageId/crosspost')
  async crosspost(@Param() params) {
    return await this.channelsService.crosspostMessage(params.channelId, params.messegeId)
  }

  @Put(':channelId/messages/:messageId/reactions/:emojiId/@me')
  async createReaction(@Param() params, @DUser() user: AccessToken): Promise<void> {
    return await this.channelsService.createReaction(params.channelId, params.messageId, params.emojiId, user.id)
  }

  @Delete(':channelId/messages/:messageId/reactions/:emojiId/:userId')
  async deleteReaction(@Param() params, @DUser() user: AccessToken): Promise<void> {
    if (params.userId === '@me') params.userId = user.id
    return await this.channelsService.deleteReaction(params.channelId, params.messageId, params.emojiId, params.userId)
  }

  @Get(':channelId/messages/:messageId/reactions/:emojiId')
  async getReactions(@Param() params) {
    return await this.channelsService.getReactions(params.channelId, params.messegeId, params.emojiId)
  }

  @Delete(':channelId/messages/:messageId/reactions')
  async deleteReactions(@Param() params): Promise<void> {
    return await this.channelsService.deleteReactions(params.channelId, params.messegeId)
  }

  @Delete(':channelId/messages/:messageId/reactions/:emojiId')
  async deleteReactionsForEmoji(@Param() params): Promise<void> {
    return await this.channelsService.deleteReactionsForEmoji(params.channelId, params.messegeId)
  }

  @Patch(':channelId/messages/:messageId')
  async editMessage(@Param() params, @Body() editMessageDto: EditMessageDto) {
    return await this.channelsService.editMessage(params.channelId, params.messegeId, editMessageDto)
  }

  @Delete(':channelId/messages/:messageId')
  async deleteMessage(@Param() params) {
    return await this.channelsService.deleteMessage(params.channelId, params.messegeId)
  }

  @Post(':channelId/messages/bulk-delete')
  async deleteMessages(@Param() params, @Body() bulkDeleteDto: BulkDeleteDto) {
    return await this.channelsService.deleteMessages(params.channelId, bulkDeleteDto)
  }

  @Put(':channelId/permissions/:overwriteId')
  async editPermissions(@Param() params, @Body() overwritePermissionsDto: OverwritePermissionsDto) {
    return await this.channelsService.editPermissions(params.channelId, overwritePermissionsDto)
  }

  @Get(':channelId/invites')
  async getInvites(@Param('channelId') cid): Promise<Invite[]> {
    return await this.channelsService.getInvites(cid)
  }

  @Post(':channelId/invites')
  async creaateInvite(@Param('channelId') cid, @Body() createInviteDto: CreateInviteDto, @DUser() user: AccessToken): Promise<Invite> {
    return await this.channelsService.creaateInvite(cid, createInviteDto, user.id)
  }

  @Post(':channelId/followers')
  async followChannel(@Param('channelId') cid, @Body() followChannelDto: FollowChannelDto) {
    return await this.channelsService.followChannel(cid, followChannelDto)
  }

  @Post(':channelId/typing')
  async typing(@Param('channelId') cid) {
    return await this.channelsService.typing(cid)
  }

  @Put(':channelId/pins/:messageId')
  async pinMessage(@Param() params, @DUser() user: AccessToken): Promise<void> {
    return await this.channelsService.pinMessage(params.channelId, params.messegeId, user.id)
  }

  @Delete(':channelId/pins/:messageId')
  async deletePinnedMessage(@Param() params, @DUser() user: AccessToken): Promise<void> {
    return await this.channelsService.deletePinnedMessage(params.channelId, params.messegeId, user.id)
  }

  @Put(':channelId/recipients/:userId')
  async addRecipient(@Param() params, AddDMRecipientDto: AddDMRecipientDto) {
    return await this.channelsService.addRecipient(params.channelId, params.userId)
  }

  @Delete(':channelId/recipients/:userId')
  async removeRecipient(@Param() params) {
    return await this.channelsService.removeRecipient(params.channelId, params.userId)
  }
//Патом треды воткнуть
}
