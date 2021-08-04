import { UsersModule } from './../api/users/users.module';
import { AppGateway } from './app.gateway';
import { JwtService } from 'src/utils/jwt/jwt.service';
import { CacheModule, Module } from '@nestjs/common';
import { Parser } from 'src/utils/parser/parser.utils';

@Module({
  imports: [
    UsersModule,
    CacheModule.register({
      ttl: 60 * 60 * 24 * 365,
    }),
  ],
  controllers: [],
  providers: [ AppGateway, JwtService, Parser ],
})
export class WsModule {}
