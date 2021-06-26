import { User, UserDocument } from './../../api/users/schemas/user.schema';
import { config } from './../../app.config';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { AccessToken } from 'src/interfaces/access-token.interface';

@Injectable()
export class JwtService {
  async createTokens(userId, rt?, rights?, fp?, expires?) {
    const accessToken = jwt.sign(
      {
        id: userId,
        rights: rights || [],
      },
      config.jwt.secret,
      { expiresIn: `${expires || config.jwt.accessTokenExpires}` },
    )
    let refreshToken: string | null
    if (rt) {
      refreshToken = jwt.sign({ userId, fp }, config.jwt.refreshTokenSecret, {
        expiresIn: config.jwt.refreshTokenExpires,
      })
    }
    return { accessToken, refreshToken }
  }

  decodeEmailToken(token) {
    try {
      return <EmailToken>jwt.verify(token, config.jwt.secret)
    } catch (err) {
      throw new UnauthorizedException()
    }
  }

  async decodeAccessToken(token) {
    try {
      return <AccessToken>jwt.verify(token, config.jwt.secret)
    } catch (err) {
      throw new UnauthorizedException()
    }
  }

  async createCustomToken(data: object, expires) {
    const token = jwt.sign(data, config.jwt.secret, {
      expiresIn: `${expires || config.jwt.accessTokenExpires}`,
    })
    return token
  }
}

class EmailToken {
  uid: string;
}
