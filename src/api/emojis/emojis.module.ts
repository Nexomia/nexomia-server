import { MongooseModule } from '@nestjs/mongoose'
import { Module } from '@nestjs/common'
import { User, UserSchema } from './../users/schemas/user.schema'
import { Guild, GuildSchema } from './../guilds/schemas/guild.schema'
import { ParserUtils } from './../../utils/parser/parser.utils'
import { ParserModule } from './../../utils/parser/parser.module'
import { Emoji, EmojiSchema } from './schemas/emoji.schema'
import { FilesModule } from './../files/files.module'
import { EmojisService } from './emojis.service'
import { EmojisController } from './emojis.controller'
import { EmojiPack, EmojiPackSchema } from './schemas/emojiPack.schema'

@Module({
  imports: [
    FilesModule,
    ParserModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Guild.name, schema: GuildSchema },
      { name: Emoji.name, schema: EmojiSchema },
      { name: EmojiPack.name, schema: EmojiPackSchema },
    ]),
  ],
  exports: [EmojisModule, MongooseModule],
  providers: [EmojisService, ParserUtils],
  controllers: [EmojisController],
})
export class EmojisModule {}
