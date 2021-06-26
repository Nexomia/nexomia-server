import { Role, RoleSchema } from './schemas/role.schema';
import { User, UserSchema } from './../users/schemas/user.schema';
import { Channel, ChannelSchema } from './../channels/schemas/channel.schema';
import { Guild, GuildSchema } from './schemas/guild.schema';
import { Emoji, EmojiSchema } from './../emojis/schemas/emoji.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { Module } from "@nestjs/common";
import { GuildsService } from './guilds.service';
import { GuildsController } from './guilds.controller';

@Module({
  imports:[
    MongooseModule.forFeature([
      { name: Emoji.name, schema: EmojiSchema },
      { name: Guild.name, schema: GuildSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema }
    ]),
  ],
  providers: [GuildsService],
  controllers: [GuildsController]
})

export class GuildsModule {}
