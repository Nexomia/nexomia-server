import { JwtService } from '../utils/jwt/jwt.service';
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}
  async use(req: Request, res: Response, next: NextFunction) {
    if (
      !req.baseUrl.includes('/auth/') &&
      !(
        req.baseUrl.includes('/files/') &&
        req.baseUrl.split('/files/')[1].split('/')[1] // я знаю, что это пиздец, мне потом нужно будет перенастроить мидлварь просто
      )
    ) {
      req.user = await this.jwtService.decodeAccessToken(req.headers['authorization'])
      if (!req.user) throw new UnauthorizedException()
    }
    next()
  }
}
