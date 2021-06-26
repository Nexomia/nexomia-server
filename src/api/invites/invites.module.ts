import { Role, RoleSchema } from './../guilds/schemas/role.schema';
import { UserSchema } from './../users/schemas/user.schema';
import { Invite, InviteSchema } from './schemas/invite.schema';
import { Channel, ChannelSchema } from './../channels/schemas/channel.schema';
import { Guild, GuildSchema } from './../guilds/schemas/guild.schema';
import { Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { User } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Guild.name, schema: GuildSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema }
    ])
  ],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
