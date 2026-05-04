import './instrument'; // Sentry MUST be imported first
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  // ADR-011: cookie parser must run before JwtStrategy so SSE clients can
  // authenticate via HttpOnly `ya_sid` cookie (EventSource cannot send
  // Authorization headers). Existing Bearer-token API callers are unaffected.
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.NODE_ENV === 'development' ? true : false,
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);

  await app.listen(port);
}

bootstrap();
