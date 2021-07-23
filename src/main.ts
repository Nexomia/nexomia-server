import { config } from './app.config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const Fingerprint = require('express-fingerprint');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: process.env.NODE_ENV === 'prod' ? false : true })
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe())
  app.use(Fingerprint())
  await app.listen(config.port)
  console.log('started')
}
bootstrap()
