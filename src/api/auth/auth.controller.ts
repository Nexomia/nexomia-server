import { Fingerprint } from './../../interfaces/fingerprint.interface';
import { DFingerprint } from '../../decorators/fingerprint.decorator';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-auth.dto';
import { Body, Controller, Get, Header, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { RegAuthDto } from './dto/reg-auth.dto';

@Controller('auth')
export class AuthController {
constructor(private authService: AuthService) {}

  @Post('/login')
  async login(@Body() loginAuthDto: LoginUserDto, @DFingerprint() fp: Fingerprint, @Headers('X-Forwarded-For') ip: string) {
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
  async getNewToken(@Headers('refreshToken') refreshToken: string, @DFingerprint() fingerprint: Fingerprint) {
    return await this.authService.getNewAccessToken(refreshToken, fingerprint)
  }
}
