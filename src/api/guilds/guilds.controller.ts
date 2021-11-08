import { ParserUtils } from 'utils/parser/parser.utils'
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ForbiddenException,
  Delete,
  Put,
} from '@nestjs/common'
import { DUser } from 'decorators/user.decorator'
import { GuildResponse } from './responses/guild.response'
import { ChannelResponse } from './../channels/responses/channel.response'
import { PatchGuildDto } from './dto/patch-guild.dto'
import { ComputedPermissions } from './schemas/role.schema'
import { RoleDto } from './dto/role.dto'
import { Guild } from './schemas/guild.schema'
import { AccessToken } from './../../interfaces/access-token.interface'
import { CreateChannelDto } from './dto/create-channel.dto'
import { CreateGuildDto } from './dto/create-guild.dto'
import { GuildsService, ExtendedMember } from './guilds.service'

@Controller('guilds')
export class GuildsController {
  constructor(
    private guildsService: GuildsService,
    private parser: ParserUtils,
  ) {}

  @Get(':guildId')
  async getGuild(@Param('guildId') guildId, @DUser() user): Promise<Guild> {
    if (!this.guildsService.isMember(guildId, user.id))
      throw new ForbiddenException()
    return await this.guildsService.getGuild(guildId, user.id)
  }

  @Post()
  async create(
    @Body() createGuildDto: CreateGuildDto,
    @DUser() user: AccessToken,
  ): Promise<GuildResponse> {
    return this.guildsService.create(createGuildDto, user.id)
  }

  @Get(':guildId/channels')
  async getChannels(
    @Param('guildId') guildId,
    @DUser() user: AccessToken,
  ): Promise<ChannelResponse[]> {
    if (!this.guildsService.isMember(guildId, user.id))
      throw new ForbiddenException()
    return this.guildsService.getChannels(guildId)
  }

  @Post(':guildId/channels')
  async createChannel(
    @Body() createChannelDto: CreateChannelDto,
    @Param('guildId') guildId,
    @DUser() user: AccessToken,
  ): Promise<ChannelResponse> {
    if (!this.guildsService.isMember(guildId, user.id))
      throw new ForbiddenException()
    const perms = await this.parser.computePermissions(guildId, user.id)
    if (
      perms &
      (ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.MANAGE_CHANNELS)
    )
      return this.guildsService.createChannel(guildId, createChannelDto)
    else throw new ForbiddenException()
  }

  @Get(':guildId/members')
  async getMembers(
    @Param('guildId') guildId,
    @DUser() user: AccessToken,
  ): Promise<ExtendedMember[]> {
    if (!this.guildsService.isMember(guildId, user.id))
      throw new ForbiddenException()
    return this.guildsService.getMembers(guildId, user.id)
  }

  @Get(':guildId/members/:memberId')
  async getMember(
    @Param() params,
    @DUser() user: AccessToken,
  ): Promise<ExtendedMember> {
    if (!this.guildsService.isMember(params.guildId, user.id))
      throw new ForbiddenException()
    return this.guildsService.getMember(params.guildId, params.memberId)
  }

  @Get(':guildId/roles')
  async getRoles(
    @Param('guildId') guildId: string,
    @DUser() user: AccessToken,
  ) {
    if (!this.guildsService.isMember(guildId, user.id))
      throw new ForbiddenException()
    return await this.guildsService.getRoles(guildId)
  }

  @Get(':guildId/roles/:roleId')
  async getRole(@Param() params, @DUser() user: AccessToken) {
    if (!this.guildsService.isMember(params.guildId, user.id))
      throw new ForbiddenException()
    return await this.guildsService.getRole(
      params.guildId,
      params.roleId,
      user.id,
    )
  }

  @Get(':guildId/invites')
  async getInvites(
    @Param('guildId') guildId: string,
    // @DUser() user: AccessToken,
  ) {
    return await this.guildsService.getInvites(guildId)
  }

  @Post(':guildId/roles')
  async createRole(
    @Param('guildId') guildId: string,
    @Body() createRoleDto: RoleDto,
    @DUser() user: AccessToken,
  ) {
    if (!this.guildsService.isMember(guildId, user.id))
      throw new ForbiddenException()
    const perms = await this.parser.computePermissions(guildId, user.id)
    if (
      perms &
      (ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.MANAGE_ROLES)
    )
      return await this.guildsService.createRole(
        guildId,
        createRoleDto,
        user.id,
      )
    else throw new ForbiddenException()
  }
  @Post(':guildId/roles/:roleId')
  async deleteRole(@Param() params, @DUser() user: AccessToken): Promise<void> {
    return await this.guildsService.deleteRole(
      params.guildId,
      params.roleId,
      user.id,
    )
  }

  @Patch(':guildId/roles/:roleId')
  async patchRole(
    @Param() params,
    @Body() patchRoleDto: RoleDto,
    @DUser() user: AccessToken,
  ) {
    if (!this.guildsService.isMember(params.guildId, user.id))
      throw new ForbiddenException()
    const perms = await this.parser.computePermissions(params.guildId, user.id)
    if (
      perms &
      (ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.MANAGE_ROLES)
    )
      return await this.guildsService.patchRole(
        params.guildId,
        params.roleId,
        patchRoleDto,
      )
    else throw new ForbiddenException()
  }

  @Patch(':guildId')
  async patchGuild(
    @Param() params,
    @Body() patchGuildDto: PatchGuildDto,
    @DUser() user: AccessToken,
  ) {
    if (!this.guildsService.isMember(params.guildId, user.id))
      throw new ForbiddenException()
    const perms = await this.parser.computePermissions(params.guildId, user.id)
    if (
      perms &
      (ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.MANAGE_GUILD)
    )
      return await this.guildsService.patchGuild(
        params.guildId,
        patchGuildDto,
        user.id,
      )
    else throw new ForbiddenException()
  }

  @Put(':guildId/emojiPacks/:emojiPackId')
  async addEmojiPack(
    @Param('emojiPackId') params,
    @DUser() user: AccessToken,
  ): Promise<void> {
    if (!this.guildsService.isMember(params.guildId, user.id))
      throw new ForbiddenException()
    const perms = await this.parser.computePermissions(params.guildId, user.id)
    if (
      perms &
      (ComputedPermissions.OWNER |
        ComputedPermissions.ADMINISTRATOR |
        ComputedPermissions.MANAGE_GUILD)
    )
      return await this.guildsService.addEmojiPack(
        params.emojiPackId,
        params.guildId,
      )
  }

  @Delete(':guildId/emojiPacks/:emojiPackId')
  async deleteEmojiPack(@Param() params): Promise<void> {
    return await this.guildsService.deleteEmojiPack(
      params.emojiPackId,
      params.guildId,
    )
  }
}
