import { config } from './../../app.config';
import { Injectable } from '@nestjs/common';
import * as crypto from "crypto";

@Injectable()
export class SaltService {
  password(password) {
    return crypto.createHash('md5').update(password + config.salt).digest('hex')
  }
}
