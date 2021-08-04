import { ChannelsModule } from './../channels/channels.module';
import { GuildsModule } from './../guilds/guilds.module';
import { Parser } from 'src/utils/parser/parser.utils';
import { Role, RoleSchema } from './../guilds/schemas/role.schema';
import { Invite, InviteSchema } from './schemas/invite.schema';
import { Guild, GuildSchema } from './../guilds/schemas/guild.schema';
import { CacheModule, Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [
    GuildsModule,
    ChannelsModule,
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
    MongooseModule.forFeature([
      { name: Guild.name, schema: GuildSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: Role.name, schema: RoleSchema },
    ])
  ],
  controllers: [InvitesController],
  providers: [InvitesService, Parser],
})
export class InvitesModule {}
