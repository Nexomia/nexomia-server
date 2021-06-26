import { EmailService } from './../../utils/email/email.service';
import { JwtService } from 'src/utils/jwt/jwt.service';
import { SaltService } from './../../utils/salt/salt.service';
import { AuthController } from './auth.controller';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([ { name: User.name, schema: UserSchema } ]),
  ],
  providers: [AuthService, SaltService, EmailService, JwtService],
  controllers: [AuthController],
})
export class AuthModule {}
