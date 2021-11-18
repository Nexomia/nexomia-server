import crypto from 'crypto'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { InjectModel } from '@nestjs/mongoose'
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common'
import { Model } from 'mongoose'
import { JwtService } from 'utils/jwt/jwt.service'
import { UniqueID } from 'nodejs-snowflake'
import { User, UserDocument } from '../users/schemas/user.schema'
import { RefreshToken } from './../users/schemas/user.schema'
import { Fingerprint } from './../../interfaces/fingerprint.interface'
import { config } from './../../app.config'
import { EmailService } from './../../utils/email/email.service'
import { RegAuthDto } from './dto/reg-auth.dto'
import { SaltService } from './../../utils/salt/salt.service'
import { LoginUserDto } from './dto/login-auth.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private saltService: SaltService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private eventEmitter: EventEmitter2,
  ) {}

  async login(
    loginUserDto: LoginUserDto,
    fingerprint: Fingerprint,
    ip: string,
  ) {
    const user = await this.userModel.findOne({
      email: loginUserDto.login,
      password: this.saltService.password(loginUserDto.password),
    })
    if (!user) throw new NotFoundException()
    const tokens = await this.jwtService.createTokens(
      user.id,
      true,
      [],
      fingerprint,
    )
    const refreshToken: RefreshToken = {
      token: tokens.refreshToken,
      ip: ip || '::1',
      fingerprint,
      created: Date.now(),
    }
    user.tokens.push(refreshToken)
    await user.save()
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    }
  }

  async register(regAuthDto: RegAuthDto) {
    const user = new this.userModel()
    user.id = new UniqueID(config.snowflake).getUniqueID()
    user.username = regAuthDto.username
    user.discriminator = crypto.randomBytes(2).toString('hex')
    user.email = regAuthDto.email
    user.password = this.saltService.password(regAuthDto.password)
    return user
      .save()
      .then(async (createdUser: UserDocument) => {
        const token = await this.jwtService.createCustomToken(
          { uid: createdUser.id },
          config.jwt.emailTokenExpires,
        )
        this.emailService.sendEmailConfirmation(createdUser.email, token)
      })
      .catch((error) => {
        console.log(error)
        if (error.keyPattern.email) throw new BadRequestException()
      })
  }

  async confirmEmail(code) {
    const decrypted = this.jwtService.decodeEmailToken(code)
    if (!decrypted) throw new UnauthorizedException()
    await this.userModel.updateOne(
      { id: decrypted.uid },
      { $set: { verified: true } },
    )
    return
  }

  async getNewAccessToken(refreshToken: string, fp: Fingerprint, session_id?) {
    const user = await this.userModel.findOne({ 'tokens.token': refreshToken })
    if (!user) throw new UnauthorizedException()
    const tokenInfo: RefreshToken = user.tokens.find(
      (token) => token.token == refreshToken,
    )
    const tokenIndex = user.tokens.findIndex(
      (token) => token.token == refreshToken,
    )
    if (
      !tokenInfo ||
      tokenInfo.fingerprint.components.useragent.browser.family !==
        fp.components.useragent.browser.family ||
      tokenInfo.fingerprint.components.useragent.os.family !==
        fp.components.useragent.os.family
    )
      throw new UnauthorizedException()

    const tokens = await this.jwtService.createTokens(user.id, true, [], true)
    user.tokens[tokenIndex].token = tokens.refreshToken
    user.markModified('tokens')
    await user.save()
    if (session_id) {
      const data = {
        event: 'ROOT.client_token_update',
        data: {
          session_id,
          token: tokens.accessToken,
        },
      }
      this.eventEmitter.emit('ROOT.client_token_update', data)
    }
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    }
  }
}
