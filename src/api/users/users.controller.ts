import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common'
import { DUser } from '../../decorators/user.decorator'
import { UserResponse } from './responses/user.response'
import { ChannelResponse } from './../channels/responses/channel.response'
import { Guild } from './../guilds/schemas/guild.schema'
import { AccessToken } from './../../interfaces/access-token.interface'
import { GetUserGuildsDto } from './dto/get-guilds.dto'
import { ModifyUserDto } from './dto/modify-user.dto'
import { UsersService } from './users.service'

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  //User Data
  @Get(':id')
  async get(
    @Param('id') id,
    @DUser() user: AccessToken,
  ): Promise<UserResponse> {
    let me = false
    if (id === '@me' || id === user.id) {
      id = user.id
      me = true
    }
    return await this.usersService.getUser(id, me)
  }

  @Patch('@me')
  async patch(
    @Body() modifyUserDto: ModifyUserDto,
    @DUser() user: AccessToken,
  ): Promise<UserResponse> {
    return await this.usersService.patchUser(user.id, modifyUserDto)
  }

  //User Guilds
  @Get('@me/guilds')
  async guilds(
    @Body() getUserGuildsDto: GetUserGuildsDto,
    @DUser() user: AccessToken,
  ): Promise<Guild[]> {
    return await this.usersService.getGuilds(user.id, getUserGuildsDto)
  }

  //Leave Guild
  @Delete('@me/guilds/:id')
  async leaveGuild(
    @Param('id') guildId,
    @DUser() user: AccessToken,
  ): Promise<void> {
    return await this.usersService.leaveGuild(user.id, guildId)
  }

  //User DMs
  @Get('@me/channels')
  async channels(@DUser() user: AccessToken): Promise<ChannelResponse[]> {
    return await this.usersService.getChannels(user.id)
  }

  @Post('@me/channels')
  async create(
    @DUser() user: AccessToken,
    @Body() createChannelDto,
  ): Promise<ChannelResponse> {
    return await this.usersService.createChannel(user.id, createChannelDto)
  }

  @Put('@me/emojiPacks/:emojiPackId')
  async addEmojiPack(
    @Param('emojiPackId') emojiPackId: string,
    @DUser() user: AccessToken,
  ): Promise<void> {
    return await this.usersService.addEmojiPack(emojiPackId, user.id)
  }

  @Delete('@me/emojiPacks/:emojiPackId')
  async deleteEmojiPack(
    @Param('emojiPackId') emojiPackId: string,
    @DUser() user: AccessToken,
  ): Promise<void> {
    return await this.usersService.deleteEmojiPack(emojiPackId, user.id)
  }
}
