import { PatchGuildDto } from './dto/patch-guild.dto';
import { ComputedPermissions } from './schemas/role.schema';
import { Parser } from 'src/utils/parser/parser.utils';
import { RoleDto } from './dto/role.dto';
import { Channel } from './../channels/schemas/channel.schema';
import { Guild } from './schemas/guild.schema';
import { AccessToken } from './../../interfaces/access-token.interface';
import { CreateChannelDto } from './dto/create-channel.dto';
import { CreateGuildDto } from './dto/create-guild.dto';
import { GuildsService, ExtendedMember } from './guilds.service';
import { Body, Controller, Get, Param, Patch, Post, ForbiddenException } from '@nestjs/common';
import { DUser } from 'src/decorators/user.decorator';

@Controller('guilds')
export class GuildsController {
  constructor(
    private guildsService: GuildsService,
    private parser: Parser
  ) {}

  @Get(':guildId')
  async getGuild(@Param('guildId') guildId, @DUser() user): Promise<Guild> {
    if (!this.guildsService.isMember(guildId, user.id)) throw new ForbiddenException()
    return await this.guildsService.getGuild(guildId, user.id)
  }

  @Post()
  async create(@Body() createGuildDto: CreateGuildDto, @DUser() user: AccessToken): Promise<Guild> {
    return this.guildsService.create(createGuildDto, user.id)
  }

  @Get(':guildId/channels')
  async getChannels(@Param('guildId') guildId, @Body() user: AccessToken): Promise<Channel[]> {
    if (!this.guildsService.isMember(guildId, user.id)) throw new ForbiddenException()
    return this.guildsService.getChannels(guildId)
  }

  @Post(':guildId/channels')
  async createChannel(@Body() createChannelDto: CreateChannelDto, @Param('guildId') guildId, @DUser() user: AccessToken): Promise<Channel> {
    if (!this.guildsService.isMember(guildId, user.id)) throw new ForbiddenException()
    return this.guildsService.createChannel(guildId, createChannelDto)
  }

  @Get(':guildId/members')
  async getMembers(@Param('guildId') guildId, @DUser() user: AccessToken): Promise<ExtendedMember[]> {
    if (!this.guildsService.isMember(guildId, user.id)) throw new ForbiddenException()
    return this.guildsService.getMembers(guildId, user.id)
  }

  @Get(':guildId/roles')
  async getRoles(@Param('guildId') guildId: string, @DUser() user: AccessToken) {
    if (!this.guildsService.isMember(guildId, user.id)) throw new ForbiddenException()
    return await this.guildsService.getRoles(guildId)
  }

  @Get(':guildId/roles/:roleId')
  async getRole(@Param() params, @DUser() user: AccessToken) {
    if (!this.guildsService.isMember(params.guildId, user.id)) throw new ForbiddenException()
    return await this.guildsService.getRole(params.guildId, params.roleId, user.id)
  }

  @Post(':guildId/roles')
  async createRole(@Param('guildId') guildId: string, @Body() createRoleDto: RoleDto, @DUser() user: AccessToken) {
    if (!this.guildsService.isMember(guildId, user.id)) throw new ForbiddenException()
    const perms = await this.parser.computePermissions(guildId, user.id)
    if (perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.MANAGE_ROLES
      )
    ) return await this.guildsService.createRole(guildId, createRoleDto)
    else throw new ForbiddenException()
  }

  @Patch(':guildId/roles/:roleId')
  async patchRole(@Param() params, @Body() patchRoleDto: RoleDto, @DUser() user: AccessToken) {
    if (!this.guildsService.isMember(params.guildId, user.id)) throw new ForbiddenException()
    const perms = await this.parser.computePermissions(params.guildId, user.id)
    if (perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.MANAGE_ROLES
      )
    ) return await this.guildsService.patchRole(params.guildId, params.roleId, patchRoleDto)
    else throw new ForbiddenException()
  }

  @Patch(':guildId')
  async patchGuild(@Param() params, @Body() patchGuildDto: PatchGuildDto, @DUser() user: AccessToken) {
    if (!this.guildsService.isMember(params.guildId, user.id)) throw new ForbiddenException()
    const perms = await this.parser.computePermissions(params.guildId, user.id)
    if (perms & (
      ComputedPermissions.OWNER |
      ComputedPermissions.ADMINISTRATOR |
      ComputedPermissions.MANAGE_GUILD
      )
    ) return await this.guildsService.patchGuild(params.guildId, patchGuildDto)
    else throw new ForbiddenException()
  }
}
