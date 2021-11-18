import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common'
import { DFingerprint } from '../../decorators/fingerprint.decorator'
import { Fingerprint } from './../../interfaces/fingerprint.interface'
import { AuthService } from './auth.service'
import { LoginUserDto } from './dto/login-auth.dto'
import { RegAuthDto } from './dto/reg-auth.dto'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/login')
  async login(
    @Body() loginAuthDto: LoginUserDto,
    @DFingerprint() fp: Fingerprint,
    @Headers('X-Forwarded-For') ip: string,
  ) {
    return await this.authService.login(loginAuthDto, fp, ip)
  }

  @Post('/register')
  async register(@Body() regAuthDto: RegAuthDto) {
    return await this.authService.register(regAuthDto)
  }

  @Get('/emailConfirmation')
  async confirmEmail(@Query('code') code) {
    return await this.authService.confirmEmail(code)
  }
  @Get('/token')
  async getNewToken(
    @Headers('refreshToken') refreshToken: string,
    @Headers('session_id') session_id: string,
    @DFingerprint() fingerprint: Fingerprint,
  ) {
    return await this.authService.getNewAccessToken(
      refreshToken,
      fingerprint,
      session_id,
    )
  }
}
