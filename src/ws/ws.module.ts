import { JwtService } from 'utils/jwt/jwt.service'
import { CacheModule, Module } from '@nestjs/common'
import { Parser } from 'utils/parser/parser.utils'
import { AppGateway } from './app.gateway'
import { UsersModule } from './../api/users/users.module'

@Module({
  imports: [
    UsersModule,
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
  ],
  controllers: [],
  providers: [AppGateway, JwtService, Parser],
})
export class WsModule {}
