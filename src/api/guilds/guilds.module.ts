import { Role, RoleSchema } from './schemas/role.schema';
import { User, UserSchema } from './../users/schemas/user.schema';
import { Channel, ChannelSchema } from './../channels/schemas/channel.schema';
import { Guild, GuildSchema } from './schemas/guild.schema';
import { Emoji, EmojiSchema } from './../emojis/schemas/emoji.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule, Module } from "@nestjs/common";
import { GuildsService } from './guilds.service';
import { GuildsController } from './guilds.controller';
import { Parser } from 'src/utils/parser/parser.utils';

@Module({
  imports:[
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
  exports: [GuildsService, MongooseModule],
  providers: [GuildsService, Parser],
  controllers: [GuildsController]
})

export class GuildsModule {}
