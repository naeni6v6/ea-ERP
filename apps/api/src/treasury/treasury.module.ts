import { Module } from '@nestjs/common';
import { TreasuryController } from './treasury.controller';
import { TreasuryService } from './treasury.service';
import { PopbillService } from './popbill.service';
@Module({ controllers: [TreasuryController], providers: [TreasuryService, PopbillService], exports: [TreasuryService] })
export class TreasuryModule {}
