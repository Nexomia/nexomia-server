import { Guild } from 'api/guilds/schemas/guild.schema'
import { User } from 'api/users/schemas/user.schema'
import { MongooseModule } from '@nestjs/mongoose'
import { Module } from '@nestjs/common'
import { ParserUtils } from './parser.utils'
import { UserSchema } from './../../api/users/schemas/user.schema'
import { GuildSchema } from './../../api/guilds/schemas/guild.schema'
import { Role, RoleSchema } from './../../api/guilds/schemas/role.schema'
import {
  Channel,
  ChannelSchema,
} from './../../api/channels/schemas/channel.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Guild.name, schema: GuildSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Channel.name, schema: ChannelSchema },
    ]),
  ],
  exports: [ParserModule, MongooseModule],
  providers: [ParserUtils],
})
export class ParserModule {}
