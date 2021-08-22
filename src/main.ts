import { WsAdapter } from '@nestjs/platform-ws';
import { config } from './app.config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
const Fingerprint = require('express-fingerprint');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: process.env.NODE_ENV === 'prod' ? false : true }) 
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  app.use(Fingerprint())
  app.useWebSocketAdapter(new WsAdapter(app))
  await app.listen(config.port)
  console.log('started')
}
bootstrap()
