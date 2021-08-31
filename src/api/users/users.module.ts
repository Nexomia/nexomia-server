import { SaltService } from './../../utils/salt/salt.service';
import { GuildsModule } from './../guilds/guilds.module';
import { ChannelsModule } from './../channels/channels.module';
import { Role, RoleSchema } from './../guilds/schemas/role.schema';
import { Guild, GuildSchema } from './../guilds/schemas/guild.schema';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { CacheModule, Module } from "@nestjs/common";
import { MongooseModule } from '@nestjs/mongoose';
import { Channel, ChannelSchema } from '../channels/schemas/channel.schema';
import { File, FileSchema } from '../files/schemas/file.schema';

@Module({
  imports: [
    ChannelsModule,
    GuildsModule,
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Guild.name, schema: GuildSchema },
      { name: Channel.name, schema: ChannelSchema },
      { name: Role.name, schema: RoleSchema },
      { name: File.name, schema: FileSchema },
    ]),
  ],
  exports: [UsersService, MongooseModule],
  providers: [UsersService, SaltService],
  controllers: [UsersController],
})
export class UsersModule {}
