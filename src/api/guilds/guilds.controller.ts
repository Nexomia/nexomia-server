import { Channel } from './../channels/schemas/channel.schema';
import { Guild } from './schemas/guild.schema';
import { AccessToken } from './../../interfaces/access-token.interface';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateGuildDto } from './dto/create-guild.dto';
import { GuildsService, ExtendedMember } from './guilds.service';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DUser } from 'src/decorators/user.decorator';

@Controller('guilds')
export class GuildsController {
  constructor(
    private guildsService: GuildsService
  ) {}

  @Get(':guildId')
  async getGuild(@Param('guildId') guildId, @DUser() user): Promise<Guild> {
    return this.guildsService.getGuild(guildId, user.id)
  }

  @Post()
  async create(@Body() createGuildDto: CreateGuildDto, @DUser() user: AccessToken): Promise<Guild> {
    return this.guildsService.create(createGuildDto, user.id)
  }

  @Get(':guildId/channels')
  async getChannels(@Param('guildId') guildId): Promise<Channel[]> {
    return this.guildsService.getChannels(guildId)
  }

  @Post(':guildId/channels')
  async createChannel(@Body() createChannelDto: CreateChannelDto, @Param('guildId') guildId, @DUser() user: AccessToken): Promise<Channel> {
    return this.guildsService.createChannel(guildId, createChannelDto, user.id)
  }

  @Get(':guildId/members')
  async getMembers(@Param('guildId') guildId, @DUser() user: AccessToken): Promise<ExtendedMember[]> {
    return this.guildsService.getMembers(guildId, user.id)
  }
}
