import { AccessToken } from './../../interfaces/access-token.interface';
import { InvitesService } from './invites.service';
import { Controller, Get, Param } from '@nestjs/common';
import { DUser } from 'src/decorators/user.decorator';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get(':inviteId')
  async get(@Param('inviteId') id: string) {
    return await this.invitesService.getInvite(id)
  }

  @Get(':inviteId/accept')
  async accept(@Param('inviteId') id: string, @DUser() user: AccessToken) {
    return await this.invitesService.accept(id, user.id)
  }
}
