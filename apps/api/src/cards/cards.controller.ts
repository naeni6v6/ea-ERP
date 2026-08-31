import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CardsService } from './cards.service';
import { GowidService } from './gowid.service';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BulkIdsDto, CardDto, CardExpenseCreateDto, DeriveDto, DimsUpdateDto, MemoDto, PurposeDto, RejectDto, UpdateCardDto } from './cards.dto';

/**
 * 법인카드. Role 제한이 없는 엔드포인트는 서비스에서 소지자 기준으로 범위를 좁힌다.
 * (EMPLOYEE = 자기 카드 지출 조회·명목 입력만 가능)
 */
@Controller('cards')
export class CardsController {
  constructor(private svc: CardsService, private gowid: GowidService) {}

  /** 고위드 지출 동기화 — API Key 설정 후 사용 가능. body: {from?, to?} (YYYY-MM-DD, 기본 최근 31일) */
  @Post('sync-gowid') @Roles(Role.CEO)
  syncGowid(@CurrentUser() u: AuthUser, @Body() d: { from?: string; to?: string }) { return this.gowid.syncExpenses(u, d ?? {}); }
  @Get('sync-gowid/status') gowidStatus() { return { configured: this.gowid.configured }; }

  // 지출 (구체 경로를 :id보다 먼저 선언)
  @Get('expenses') listExpenses(@CurrentUser() u: AuthUser, @Query() q: any) {
    return this.svc.listExpenses(u, { ...q, take: q.take ? Number(q.take) : undefined });
  }
  @Post('expenses') createExpense(@CurrentUser() u: AuthUser, @Body() d: CardExpenseCreateDto) { return this.svc.createExpense(u, d); }
  @Post('expenses/confirm-bulk') @Roles(Role.CEO) confirmBulk(@CurrentUser() u: AuthUser, @Body() d: BulkIdsDto) { return this.svc.confirmBulk(u, d.ids); }
  @Patch('expenses/:id/purpose') setPurpose(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: PurposeDto) { return this.svc.setPurpose(u, id, d.purposeText, d.memo); }
  @Patch('expenses/:id/memo') setMemo(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: MemoDto) { return this.svc.setMemo(u, id, d.memo); }
  @Patch('expenses/:id/dims') @Roles(Role.CEO, Role.ADMIN) setDims(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: DimsUpdateDto) { return this.svc.setDims(u, id, d); }
  @Post('expenses/:id/confirm') @Roles(Role.CEO) confirm(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.confirm(u, id); }
  @Post('expenses/:id/reject') @Roles(Role.CEO) reject(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: RejectDto) { return this.svc.reject(u, id, d.reason); }
  @Post('expenses/:id/exclude') @Roles(Role.CEO, Role.ADMIN) exclude(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('reason') reason?: string) { return this.svc.exclude(u, id, reason); }
  @Post('expenses/:id/restore') @Roles(Role.CEO, Role.ADMIN) restore(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.restore(u, id); }

  // 카드 마스터
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.listCards(u); }
  @Post() @Roles(Role.CEO) create(@CurrentUser() u: AuthUser, @Body() d: CardDto) { return this.svc.createCard(u, d); }
  @Patch(':id') @Roles(Role.CEO) update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: UpdateCardDto) { return this.svc.updateCard(u, id, d); }
  @Post(':id/derive-from-bank') @Roles(Role.CEO) derive(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: DeriveDto) { return this.svc.deriveFromBank(u, id, d); }
}
