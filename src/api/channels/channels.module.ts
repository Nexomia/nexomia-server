import { User, UserSchema } from './../users/schemas/user.schema';
import { Invite, InviteSchema } from './../invites/schemas/invite.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import { Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { Channel, ChannelSchema } from './schemas/channel.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Channel.name, schema: ChannelSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: User.name, schema: UserSchema }
    ]),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService]
})

export class ChannelsModule {}
