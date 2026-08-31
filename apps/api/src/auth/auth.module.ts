import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { requiredSecret } from '../common/env';
@Module({
  imports: [
    PassportModule,
    // secret은 모듈 생성 시점에 읽어야 .env 로딩(ConfigModule) 이후가 보장된다
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: requiredSecret('JWT_SECRET'),
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '12h' },
      }),
    }),
  ],
  controllers: [AuthController], providers: [AuthService, JwtStrategy], exports: [AuthService],
})
export class AuthModule {}
