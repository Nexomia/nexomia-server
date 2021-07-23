import { Channel } from './../channels/schemas/channel.schema';
import { Guild } from './../guilds/schemas/guild.schema';
import { User } from 'src/api/users/schemas/user.schema';
import { AccessToken } from './../../interfaces/access-token.interface';
import { GetUserGuildsDto } from './dto/get-guilds.dto';
import { ModifyUserDto } from './dto/modify-user.dto';
import { DUser } from '../../decorators/user.decorator';
import { UsersService } from './users.service';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  //User Data
  @Get(':id')
  async get(@Param('id') id, @DUser() user: AccessToken): Promise<User> {
    let me: boolean = false
    if (id === '@me') {
      id = user.id
      me = true
    }
    return await this.usersService.getUser(id, me)
  }

  @Patch('@me')
  async patch(@Body() modifyUserDto: ModifyUserDto, @DUser() user: AccessToken): Promise<User> {
    return await this.usersService.patchUser(user.id, modifyUserDto)
  }

  //User Guilds
  @Get('@me/guilds')
  async guilds(@Body() getUserGuildsDto: GetUserGuildsDto, @DUser() user: AccessToken): Promise<Guild[]> {
    return await this.usersService.getGuilds(user.id, getUserGuildsDto)
  }

  //Leave Guild
  @Delete('@me/guilds/:id')
  async leaveGuild(@Param('id') guildId, @DUser() user: AccessToken): Promise<void> {
    return await this.usersService.leaveGuild(user.id, guildId)
  }

  //User DMs
  @Get('@me/channels')
  async channels(@DUser() user: AccessToken): Promise<Channel[]> {
    return await this.usersService.getChannels(user.id)
  }

  @Post('@me/channels')
  create(@DUser() user: AccessToken, @Body() createChannelDto): Promise<Channel> {
    return this.usersService.createChannel(user.id, createChannelDto)
  }
}
