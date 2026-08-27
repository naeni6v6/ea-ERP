import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { GowidService } from './gowid.service';

@Module({ imports: [LedgerModule], controllers: [CardsController], providers: [CardsService, GowidService], exports: [CardsService] })
export class CardsModule {}
// GOWID_API_KEY 등 .env 변경 시 이 파일을 저장하면 watch가 서버를 재시작한다
