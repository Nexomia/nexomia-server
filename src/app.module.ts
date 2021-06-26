import { InvitesModule } from './api/invites/invites.module';
import { ChannelsModule } from './api/channels/channels.module';
import { GuildsModule } from './api/guilds/guilds.module';
import { JwtService } from './utils/jwt/jwt.service';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { AuthModule } from './api/auth/auth.module';
import { UsersModule } from './api/users/users.module';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from './app.config';


@Module({
  imports: [
    UsersModule,
    AuthModule,
    GuildsModule,
    ChannelsModule,
    InvitesModule,
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
