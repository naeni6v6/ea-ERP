import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { JournalService } from './journal.service';
@Module({ controllers: [LedgerController], providers: [JournalService], exports: [JournalService] })
export class LedgerModule {}
