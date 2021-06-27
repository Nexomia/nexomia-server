import { Invite } from './schemas/invite.schema';
import { AccessToken } from './../../interfaces/access-token.interface';
import { InvitesService, InviteInfo } from './invites.service';
import { Controller, Get, Param } from '@nestjs/common';
import { DUser } from 'src/decorators/user.decorator';
import { Guild } from '../guilds/schemas/guild.schema';

@Controller('invites')
export class InvitesController {
  constructor(private invitesService: InvitesService) {}

  @Get(':inviteId')
  async get(@Param('inviteId') id: string): Promise<InviteInfo> {
    return await this.invitesService.getInvite(id)
  }

  @Get(':inviteId/accept')
  async accept(@Param('inviteId') id: string, @DUser() user: AccessToken): Promise<Guild> {
    return await this.invitesService.accept(id, user.id)
  }
}
