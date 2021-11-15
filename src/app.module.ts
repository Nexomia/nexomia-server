import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { MongooseModule } from '@nestjs/mongoose'
import { EmojisModule } from './api/emojis/emojis.module'
import { AuthModule } from './api/auth/auth.module'
import { ChannelsModule } from './api/channels/channels.module'
import { FilesModule } from './api/files/files.module'
import { GuildsModule } from './api/guilds/guilds.module'
import { InvitesModule } from './api/invites/invites.module'
import { UsersModule } from './api/users/users.module'
import { config } from './app.config'
import { AuthMiddleware } from './middlewares/auth.middleware'
import { JwtService } from './utils/jwt/jwt.service'
import { WsModule } from './ws/ws.module'

@Module({
  imports: [
    UsersModule,
    AuthModule,
    GuildsModule,
    ChannelsModule,
    InvitesModule,
    WsModule,
    FilesModule,
    EmojisModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: config.db,
      }),
    }),
  ],
  controllers: [],
  providers: [JwtService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL })
  }
}
