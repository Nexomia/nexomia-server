import { Parser } from 'utils/parser/parser.utils'
import { CacheModule, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { GuildsModule } from './../guilds/guilds.module'
import { Emoji, EmojiSchema } from './../emojis/schemas/emoji.schema'
import { Invite, InviteSchema } from './../invites/schemas/invite.schema'
import { Message, MessageSchema } from './schemas/message.schema'
import { ChannelsController } from './channels.controller'
import { ChannelsService } from './channels.service'
import { Channel, ChannelSchema } from './schemas/channel.schema'

@Module({
  imports: [
    GuildsModule,
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
    MongooseModule.forFeature([
      { name: Channel.name, schema: ChannelSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: Emoji.name, schema: EmojiSchema },
    ]),
  ],
  exports: [ChannelsService, MongooseModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, Parser],
})
export class ChannelsModule {}
