import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// BigInt(원 단위 금액)를 JSON 문자열로 직렬화. 프론트는 문자열/BigInt로 다루고 float 연산을 하지 않는다.
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

/**
 * 허용 Origin — CORS_ORIGINS(쉼표 구분)로 지정한다.
 * 예전에는 origin:true 로 요청 Origin을 그대로 반사해서 아무 사이트나 이 API를 부를 수 있었다.
 */
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function bootstrap() {
  process.env.TZ = process.env.TZ || 'Asia/Seoul';
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, cb) => {
      // 서버 간 호출·curl 등 Origin이 없는 요청은 CORS 대상이 아니므로 통과
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS 거부: ${origin}`));
    },
    credentials: true,
    maxAge: 600,
  });

  // 최소한의 보안 헤더 — 응답이 브라우저에서 어떻게 다뤄질지 고정한다
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY'); // 클릭재킹 방지
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.removeHeader('X-Powered-By');
    next();
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT || 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `모션브릿지 ERP API: http://localhost:${port}/api · 허용 Origin: ${allowedOrigins.join(', ')}`,
  );
}
bootstrap();
