import { WsAdapter } from '@nestjs/platform-ws'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import Fingerprint from 'express-fingerprint'
import { AppModule } from './app.module'
import { config, loadConfig } from './app.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: process.env.NODE_ENV !== 'prod',
  })
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  app.use(Fingerprint())
  app.useWebSocketAdapter(new WsAdapter(app))
  await app.listen(config.port)
  console.log('started')
}

loadConfig().then(bootstrap)
