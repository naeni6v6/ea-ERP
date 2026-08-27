import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ScopeModule } from './common/scope/scope.module';
import { AuditModule } from './common/audit/audit.module';
import { OrgModule } from './org/org.module';
import { ProjectsModule } from './projects/projects.module';
import { LedgerModule } from './ledger/ledger.module';
import { TreasuryModule } from './treasury/treasury.module';
import { CardsModule } from './cards/cards.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule, ScopeModule, AuditModule, AuthModule,
    OrgModule, ProjectsModule, LedgerModule, TreasuryModule, CardsModule, MetricsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1) 인증: 모든 엔드포인트 기본 보호 (@Public 제외)
    { provide: APP_GUARD, useClass: RolesGuard },   // 2) Role 검사: @Roles(...)
  ],
})
export class AppModule {}
