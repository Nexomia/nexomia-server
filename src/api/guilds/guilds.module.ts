import { MongooseModule } from '@nestjs/mongoose'
import { CacheModule, Module } from '@nestjs/common'
import { Parser } from 'utils/parser/parser.utils'
import { Invite, InviteSchema } from '../invites/schemas/invite.schema'
import { FilesModule } from './../files/files.module'
import { File, FileSchema } from './../files/schemas/file.schema'
import { Role, RoleSchema } from './schemas/role.schema'
import { User, UserSchema } from './../users/schemas/user.schema'
import { Channel, ChannelSchema } from './../channels/schemas/channel.schema'
import { Guild, GuildSchema } from './schemas/guild.schema'
import { GuildsService } from './guilds.service'
import { GuildsController } from './guilds.controller'

@Module({
  imports: [
    FilesModule,
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
    MongooseModule.forFeature([
      { name: Guild.name, schema: GuildSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: File.name, schema: FileSchema },
    ]),
  ],
  exports: [GuildsService, MongooseModule],
  providers: [GuildsService, Parser],
  controllers: [GuildsController],
})
export class GuildsModule {}
