import { JwtService } from 'utils/jwt/jwt.service'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { User, UserSchema } from '../users/schemas/user.schema'
import { EmailService } from './../../utils/email/email.service'
import { SaltService } from './../../utils/salt/salt.service'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [AuthService, SaltService, EmailService, JwtService],
  controllers: [AuthController],
})
export class AuthModule {}
