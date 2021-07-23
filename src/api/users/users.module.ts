import { Role, RoleSchema } from './../guilds/schemas/role.schema';
import { Guild, GuildSchema } from './../guilds/schemas/guild.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { Channel, ChannelSchema } from '../channels/schemas/channel.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Guild.name, schema: GuildSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: Role.name, schema: RoleSchema }
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
