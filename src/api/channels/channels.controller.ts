import { ChannelResponse } from './responses/channel.response';
import { MessageResponse } from './responses/message.response';
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
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { DUser } from 'src/decorators/user.decorator';

@Controller('channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get(':channelId')
  async get(@Param('channelId') channelId): Promise<ChannelResponse> {
    return await this.channelsService.getChannel(channelId)
  }

  @Delete(':channelId')
  async delete(@Param('channelId') channelId) {
    return await this.channelsService.deleteChannel(channelId)
  }

  @Get(':channelId/messages')
  async messages(@Param('channelId') channelId, @Query() getChannelMessagesDto: GetChannelMessagesDto, @DUser() user: AccessToken): Promise<MessageResponse[] | MessageResponse> {
    return await this.channelsService.getChannelMessages(channelId, getChannelMessagesDto, user.id)
  }

  @Get(':channelId/messages/:messageId')
  async message(@Param() params, @DUser() user: AccessToken): Promise<MessageResponse | MessageResponse[]> {
    return await this.channelsService.getChannelMessages(params.channelId, { ids: [ params.messageId ] }, user.id, true)
  }

  @Post(':channelId/messages')
  async createMessage(@Param('channelId') channelId, @Body() createMessageDto: CreateMessageDto, @DUser() user: AccessToken): Promise<MessageResponse> {
    return await this.channelsService.createMessage(user.id, channelId, createMessageDto)
  }

  @Post(':channelId/messages/:messageId/crosspost')
  async crosspost(@Param() params) {
    return await this.channelsService.crosspostMessage(params.channelId, params.messageId)
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
    return await this.channelsService.getReactions(params.channelId, params.messageId, params.emojiId)
  }

  @Delete(':channelId/messages/:messageId/reactions')
  async deleteReactions(@Param() params): Promise<void> {
    return await this.channelsService.deleteReactions(params.channelId, params.messageId)
  }

  @Delete(':channelId/messages/:messageId/reactions/:emojiId')
  async deleteReactionsForEmoji(@Param() params): Promise<void> {
    return await this.channelsService.deleteReactionsForEmoji(params.channelId, params.messageId)
  }

  @Patch(':channelId/messages/:messageId')
  async editMessage(@Param() params, @Body() editMessageDto: EditMessageDto, @DUser() user: AccessToken) {
    return await this.channelsService.editMessage(params.channelId, params.messageId, editMessageDto, user.id)
  }

  @Delete(':channelId/messages/:messageId')
  async deleteMessage(@Param() params, @DUser() user: AccessToken) {
    console.log(params)
    return await this.channelsService.deleteMessage(params.channelId, params.messageId, user.id)
  }

  @Post(':channelId/messages/bulk-delete')
  async deleteMessages(@Param() params, @Body() bulkDeleteDto: BulkDeleteDto, @DUser() user: AccessToken) {
    return await this.channelsService.deleteMessages(params.channelId, bulkDeleteDto.messages, user.id)
  }

  @Put(':channelId/permissions/:overwriteId')
  async editPermissions(@Param() params, @Body() overwritePermissionsDto: OverwritePermissionsDto) {
    return await this.channelsService.editPermissions(params.channelId, overwritePermissionsDto)
  }

  @Get(':channelId/invites')
  async getInvites(@Param('channelId') channelId): Promise<Invite[]> {
    return await this.channelsService.getInvites(channelId)
  }

  @Post(':channelId/invites')
  async creaateInvite(@Param('channelId') channelId, @Body() createInviteDto: CreateInviteDto, @DUser() user: AccessToken): Promise<Invite> {
    return await this.channelsService.creaateInvite(channelId, createInviteDto, user.id)
  }

  @Post(':channelId/followers')
  async followChannel(@Param('channelId') channelId, @Body() followChannelDto: FollowChannelDto) {
    return await this.channelsService.followChannel(channelId, followChannelDto)
  }

  @Post(':channelId/typing')
  async typing(@Param('channelId') channelId, @DUser() user: AccessToken) {
    return await this.channelsService.typing(channelId, user.id)
  }

  @Put(':channelId/pins/:messageId')
  async pinMessage(@Param() params, @DUser() user: AccessToken): Promise<void> {
    return await this.channelsService.pinMessage(params.channelId, params.messageId, user.id)
  }

  @Delete(':channelId/pins/:messageId')
  async deletePinnedMessage(@Param() params, @DUser() user: AccessToken): Promise<void> {
    return await this.channelsService.deletePinnedMessage(params.channelId, params.messageId, user.id)
  }

  @Get(':channelId/pins')
  async getPinnedMessages(@Param('channelId') channelId, @DUser() user: AccessToken): Promise<MessageResponse[]> {
    return await this.channelsService.getPinnedMessages(channelId, user.id)
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
