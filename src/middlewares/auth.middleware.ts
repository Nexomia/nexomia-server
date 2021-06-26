import { JwtService } from '../utils/jwt/jwt.service';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}
  async use(req: Request, res: Response, next: NextFunction) {
    if (!req.baseUrl.includes('/auth/'))
      req.user = await this.jwtService.decodeAccessToken(req.headers['authorization'])
    next()
  }
}
