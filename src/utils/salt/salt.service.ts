import * as crypto from 'crypto'
import { Injectable } from '@nestjs/common'
import { config } from './../../app.config'

@Injectable()
export class SaltService {
  password(password) {
    return crypto
      .createHash('md5')
      .update(password + config.salt)
      .digest('hex')
  }
}
