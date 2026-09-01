import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TreasuryService } from './treasury.service';
import { PopbillService } from './popbill.service';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BankAccountDto, ImportDto, PlannedDto, PlannedIncomeDto, ReserveDto, ReserveMoveDto, UpdateBankAccountDto, UpdatePlannedDto, UpdatePlannedIncomeDto, UpdateReserveDto } from './treasury.dto';

/** 회사 전체 자금 정보는 CEO 전용 (Q5 기본 정책). 필요 시 ADMIN에 계좌 단위 scope를 부여하도록 확장. */
@Controller('treasury')
@Roles(Role.CEO)
export class TreasuryController {
  constructor(private svc: TreasuryService, private popbill: PopbillService) {}
  @Get('bank-accounts') balances(@CurrentUser() u: AuthUser) { return this.svc.balances(u.companyId); }
  @Post('bank-accounts') createAcc(@CurrentUser() u: AuthUser, @Body() d: BankAccountDto) { return this.svc.createAccount(u, d); }
  @Patch('bank-accounts/:id') updateAcc(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateBankAccountDto) { return this.svc.updateAccount(u, id, d); }

  @Get('bank-transactions') txns(@CurrentUser() u: AuthUser, @Query() q: any) { return this.svc.listTransactions(u.companyId, { ...q, take: q.take ? Number(q.take) : undefined }); }
  @Post('bank-transactions/import') import(@CurrentUser() u: AuthUser, @Body() d: ImportDto) { return this.svc.importRows(u, d); }
  @Post('bank-transactions/:id/ignore') ignore(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('reason') reason?: string) { return this.svc.ignoreTransaction(u, id, reason); }

  // ── 팝빌 계좌조회 연동 ──
  @Get('popbill/status') popbillStatus() { return this.popbill.status(); }
  /** 팝빌에 등록된 계좌 목록 — 우리 계좌에 기관코드·계좌번호를 매핑할 때 참고 */
  @Get('popbill/accounts') popbillAccounts() { return this.popbill.listPopbillAccounts(); }
  /** 팝빌 계좌 등록·관리 페이지 URL (은행 인증은 팝빌 화면에서 직접) */
  @Get('popbill/manage-url') popbillManageUrl() { return this.popbill.manageUrl(); }
  @Post('popbill/sync') popbillSyncAll(@CurrentUser() u: AuthUser, @Body() b: { from?: string; to?: string }) { return this.popbill.syncAll(u, b?.from, b?.to); }
  @Post('bank-accounts/:id/popbill-sync') popbillSync(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: { from?: string; to?: string }) { return this.popbill.syncAccount(u, id, b?.from, b?.to); }

  @Get('reserves') reserves(@CurrentUser() u: AuthUser) { return this.svc.listReserves(u.companyId); }
  @Post('reserves') createReserve(@CurrentUser() u: AuthUser, @Body() d: ReserveDto) { return this.svc.createReserve(u, d); }
  @Post('reserves/:id/move') moveReserve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: ReserveMoveDto) { return this.svc.moveReserve(u, id, d); }
  @Patch('reserves/:id') updateReserve(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateReserveDto) { return this.svc.updateReserve(u, id, d); }

  // 입금 예정(들어올 돈) — 자금 달력에서 잔금일 기준 등록
  @Get('planned-incomes') plannedIncomes(@CurrentUser() u: AuthUser, @Query() q: any) { return this.svc.listPlannedIncome(u.companyId, q); }
  @Post('planned-incomes') createPlannedIncome(@CurrentUser() u: AuthUser, @Body() d: PlannedIncomeDto) { return this.svc.createPlannedIncome(u, d); }
  @Patch('planned-incomes/:id') updatePlannedIncome(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdatePlannedIncomeDto) { return this.svc.updatePlannedIncome(u, id, d); }

  @Get('planned-payments') planned(@CurrentUser() u: AuthUser, @Query() q: any) { return this.svc.listPlanned(u.companyId, q); }
  @Post('planned-payments') createPlanned(@CurrentUser() u: AuthUser, @Body() d: PlannedDto) { return this.svc.createPlanned(u, d); }
  @Patch('planned-payments/:id') updatePlanned(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdatePlannedDto) { return this.svc.updatePlanned(u, id, d); }
}
