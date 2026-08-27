import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { TreasuryModule } from '../treasury/treasury.module';
@Module({ imports: [TreasuryModule], controllers: [MetricsController], providers: [MetricsService] })
export class MetricsModule {}
