import { FilesModule } from './api/files/files.module';
import { WsModule } from './ws/ws.module';
import { UsersService } from './api/users/users.service';
import { AppGateway } from './ws/app.gateway';
import { InvitesModule } from './api/invites/invites.module';
import { ChannelsModule } from './api/channels/channels.module';
import { GuildsModule } from './api/guilds/guilds.module';
import { JwtService } from './utils/jwt/jwt.service';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { AuthModule } from './api/auth/auth.module';
import { UsersModule } from './api/users/users.module';
import { CacheModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from './app.config';
import { EventEmitterModule } from '@nestjs/event-emitter';


@Module({
  imports: [
    UsersModule,
    AuthModule,
    GuildsModule,
    ChannelsModule,
    InvitesModule,
    WsModule,
    FilesModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    MongooseModule.forRoot(config.db)
  ],
  controllers: [],
  providers: [ JwtService ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
