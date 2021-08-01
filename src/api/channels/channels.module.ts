import { Emoji, EmojiSchema } from './../emojis/schemas/emoji.schema';
import { Parser } from 'src/utils/parser/parser.utils';
import { Role, RoleSchema } from './../guilds/schemas/role.schema';
import { GuildsService } from './../guilds/guilds.service';
import { User, UserSchema } from './../users/schemas/user.schema';
import { Invite, InviteSchema } from './../invites/schemas/invite.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { Channel, ChannelSchema } from './schemas/channel.schema';
import { Guild, GuildSchema } from '../guilds/schemas/guild.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Guild.name, schema: GuildSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: User.name, schema: UserSchema },
      { name: Emoji.name, schema: EmojiSchema }
    ]),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService, GuildsService, Parser]
})

export class ChannelsModule {}
