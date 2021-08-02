import { Channel, ChannelSchema } from './../api/channels/schemas/channel.schema';
import { Role, RoleSchema } from './../api/guilds/schemas/role.schema';
import { UserSchema } from './../api/users/schemas/user.schema';
import { User } from 'src/api/users/schemas/user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './../api/users/users.service';
import { AppGateway } from './app.gateway';
import { JwtService } from 'src/utils/jwt/jwt.service';
import { CacheModule, Module } from '@nestjs/common';
import { Guild, GuildSchema } from 'src/api/guilds/schemas/guild.schema';
import { Parser } from 'src/utils/parser/parser.utils';

@Module({
  imports: [
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
    MongooseModule.forFeature([
      { name: Guild.name, schema: GuildSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema }
    ]),
  ],
  controllers: [],
  providers: [ JwtService, AppGateway, UsersService, Parser ],
})
export class WsModule {}
