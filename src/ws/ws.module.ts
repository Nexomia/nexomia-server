import { JwtService } from 'utils/jwt/jwt.service'
import { CacheModule, Module } from '@nestjs/common'
import { ParserUtils } from './../utils/parser/parser.utils'
import { ParserModule } from './../utils/parser/parser.module'
import { AppGateway } from './app.gateway'
import { UsersModule } from './../api/users/users.module'

@Module({
  imports: [
    ParserModule,
    UsersModule,
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
  ],
  controllers: [],
  providers: [AppGateway, JwtService, ParserUtils],
})
export class WsModule {}
