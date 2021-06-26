import { AccessToken } from './../../interfaces/access-token.interface';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateGuildDto } from './dto/create-guild.dto';
import { GuildsService } from './guilds.service';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DUser } from 'src/decorators/user.decorator';

@Controller('guilds')
export class GuildsController {
  constructor(
    private guildsService: GuildsService
  ) {}

  @Get(':guildId')
  async getGuild(@Param('guildId') guildId, @DUser() user) {
    return this.guildsService.getGuild(guildId, user.id)
  }

  @Post()
  async create(@Body() createGuildDto: CreateGuildDto, @DUser() user: AccessToken) {
    return this.guildsService.create(createGuildDto, user.id)
  }

  @Get(':guildId/channels')
  async getChannels(@Param('guildId') guildId) {
    return this.guildsService.getChannels(guildId)
  }

  @Post(':guildId/channels')
  async createChannel(@Body() createChannelDto: CreateChannelDto, @Param('guildId') guildId, @DUser() user: AccessToken) {
    return this.guildsService.createChannel(guildId, createChannelDto, user.id)
  }

  @Get(':guildId/members')
  async getMembers(@Param('guildId') guildId, @DUser() user: AccessToken) {
    return this.guildsService.getMembers(guildId, user.id)
  }
}
