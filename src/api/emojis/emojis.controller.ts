import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Put,
} from '@nestjs/common'
import { DUser } from 'decorators/user.decorator'
import { EditEmojiDto } from './dto/edit-emoji.dto'
import { EditEmojiPackDto } from './dto/edit-emojiPack.dto'
import { AddEmojiDto } from './dto/add-emoji.dto'
import { EmojisService } from './emojis.service'
import { AccessToken } from './../../interfaces/access-token.interface'
import { CreateEmojiPackDto } from './dto/emojiPack-create.dto'

@Controller('emojis')
export class EmojisController {
  constructor(private emojisService: EmojisService) {}

  @Post()
  async createPack(
    @Body() createDto: CreateEmojiPackDto,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.createPack(user.id, createDto)
  }

  @Get(':packId')
  async getPack(
    @Param('packId') packId: string,
    @Query('include_emojis') includeEmojis: boolean,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.getPack(packId, includeEmojis, user.id)
  }

  @Patch(':packId')
  async editPack(
    @Param('packId') packId: string,
    @Body() dto: EditEmojiPackDto,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.editPack(packId, dto, user.id)
  }

  @Delete(':packId')
  async deletePack(
    @Param('packId') packId: string,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.removePack(packId, user.id)
  }

  @Put(':packId/whiteList/:userId')
  async addWhiteListUser(@Param() params, @DUser() user: AccessToken) {
    return await this.emojisService.addWhiteListUser(
      params.packId,
      params.userId,
      user.id,
    )
  }

  @Delete(':packId/whiteList/:userId')
  async removeWhiteListUser(@Param() params, @DUser() user: AccessToken) {
    return await this.emojisService.removeWhiteListUser(
      params.packId,
      params.userId,
      user.id,
    )
  }

  @Get(':packId/whiteList')
  async getblackListUsers(
    @Param('packId') packId: string,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.getBlackListUsers(packId, user.id)
  }

  @Put(':packId/whiteList/:userId')
  async addBlackListUser(@Param() params, @DUser() user: AccessToken) {
    return await this.emojisService.addBlackListUser(
      params.packId,
      params.userId,
      user.id,
    )
  }

  @Delete(':packId/whiteList/:userId')
  async removeBlackListUser(@Param() params, @DUser() user: AccessToken) {
    return await this.emojisService.removeBlackListUser(
      params.packId,
      params.userId,
      user.id,
    )
  }

  @Get(':packId/whiteList')
  async getWhiteListUsers(
    @Param('packId') packId: string,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.getWhiteListUsers(packId, user.id)
  }

  @Get(':packId/emoji/:emojiId')
  async getEmoji(@Param() params) {
    return await this.emojisService.getEmoji(params.packId, params.emojiId)
  }

  @Post(':packId/emoji')
  async addEmoji(
    @Param('packId') packId: string,
    @Body() dto: AddEmojiDto,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.addEmoji(packId, dto, user.id)
  }

  @Patch(':packId/emoji/:emojiId')
  async editEmoji(
    @Param() params,
    @Body() dto: EditEmojiDto,
    @DUser() user: AccessToken,
  ) {
    return await this.emojisService.editEmoji(
      params.packId,
      params.emojiId,
      dto,
      user.id,
    )
  }

  @Delete(':packId/emoji/:emojiId')
  async removeEmoji(@Param() params, @DUser() user: AccessToken) {
    return await this.emojisService.removeEmoji(
      params.packId,
      params.emojiId,
      user.id,
    )
  }
}
