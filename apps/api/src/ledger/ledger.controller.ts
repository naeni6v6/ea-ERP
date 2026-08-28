import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from './journal.service';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { AccountDto, CreateEntryDto, ENTRY_TYPES, PartnerDto } from './ledger.dto';

@Controller()
export class LedgerController {
  constructor(private journal: JournalService, private prisma: PrismaService) {}

  @Get('accounts') accounts(@CurrentUser() u: AuthUser) { return this.prisma.account.findMany({ where: { companyId: u.companyId }, orderBy: { sortOrder: 'asc' } }); }
  @Post('accounts') @Roles(Role.CEO) createAccount(@CurrentUser() u: AuthUser, @Body() d: AccountDto) { return this.prisma.account.create({ data: { ...d, companyId: u.companyId } }); }
  @Patch('accounts/:id') @Roles(Role.CEO) updateAccount(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() d: Partial<AccountDto>) { return this.prisma.account.update({ where: { id, companyId: u.companyId }, data: d }); }

  @Get('partners') partners(@CurrentUser() u: AuthUser) { return this.prisma.partner.findMany({ where: { companyId: u.companyId, isActive: true }, orderBy: { name: 'asc' } }); }
  @Post('partners') @Roles(Role.CEO, Role.ADMIN) createPartner(@CurrentUser() u: AuthUser, @Body() d: PartnerDto) { return this.prisma.partner.create({ data: { ...d, companyId: u.companyId } }); }

  @Get('journal/entry-types') entryTypes() {
    return ENTRY_TYPES.map((t) => ({ type: t, label: ({ SALES: '매출 발생(미수)', CASH_SALES: '매출 즉시입금', RECEIPT_AR: '매출채권 회수', EXPENSE: '비용 발생(미지급)', CASH_EXPENSE: '비용 즉시출금', PAYMENT_AP: '미지급금 지급', PREPAID: '선급비용 지급', PREPAID_AMORTIZE: '선급비용 상각', CONTRACT_PREPAY: '선결제 수령(계약부채)', CONTRACT_RECOGNIZE: '계약부채 매출인식', OTHER_INCOME: '기타 입금', TRANSFER: '계좌 이체', MANUAL: '직접 분개' } as any)[t] }));
  }
  @Get('journal') @Roles(Role.CEO, Role.ADMIN)
  list(@CurrentUser() u: AuthUser, @Query() q: any) { return this.journal.list(u, { ...q, take: q.take ? Number(q.take) : undefined, skip: q.skip ? Number(q.skip) : undefined }); }
  @Post('journal') @Roles(Role.CEO, Role.ADMIN) create(@CurrentUser() u: AuthUser, @Body() d: CreateEntryDto) { return this.journal.create(u, d); }
  @Get('journal/:id') @Roles(Role.CEO, Role.ADMIN) get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.journal.get(u, id); }
  @Post('journal/:id/void') @Roles(Role.CEO, Role.ADMIN) void(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('reason') reason: string) { return this.journal.void(u, id, reason); }

  /** 거래처 지정/변경 — 분개 자체는 불변, 거래처 라벨만 보완한다 */
  @Patch('journal/:id/partner') @Roles(Role.CEO, Role.ADMIN)
  async setPartner(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body('partnerId') partnerId?: string | null) {
    const e = await this.prisma.journalEntry.findFirst({ where: { id, companyId: u.companyId } });
    if (!e) throw new NotFoundException();
    return this.prisma.journalEntry.update({ where: { id }, data: { partnerId: partnerId || null }, include: { partner: { select: { name: true } } } });
  }
}
