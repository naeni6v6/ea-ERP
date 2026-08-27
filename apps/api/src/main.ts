import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// BigInt(원 단위 금액)를 JSON 문자열로 직렬화. 프론트는 문자열/BigInt로 다루고 float 연산을 하지 않는다.
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

async function bootstrap() {
  process.env.TZ = process.env.TZ || 'Asia/Seoul';
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  console.log(`모션브릿지 ERP API: http://localhost:${port}/api`);
}
bootstrap();
