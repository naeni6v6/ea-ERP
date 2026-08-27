import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GroupBy, MetricsService } from './metrics.service';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ScopeService } from '../common/scope/scope.service';

const sel = (q: any) => ({ businessTypeId: q.businessTypeId || undefined, departmentId: q.departmentId || undefined, projectId: q.projectId || undefined });

@Controller('metrics')
export class MetricsController {
  constructor(private m: MetricsService, private scope: ScopeService) {}
  /** 대표/관리자/직원 공통 진입점 — Role에 따라 응답 필드가 달라짐 */
  @Get('dashboard') dashboard(@CurrentUser() u: AuthUser, @Query() q: any) { return this.m.dashboard(u, sel(q), q.preset, q.from, q.to); }
  @Get('pnl') @Roles(Role.CEO, Role.ADMIN) pnl(@CurrentUser() u: AuthUser, @Query() q: any) { this.scope.assertPnl(u); return this.m.pnl(u, sel(q), q.preset, q.from, q.to, q.yoy === '1'); }
  @Get('pnl/breakdown') @Roles(Role.CEO, Role.ADMIN) breakdown(@CurrentUser() u: AuthUser, @Query() q: any) { return this.m.pnlBreakdown(u, sel(q), (q.groupBy as GroupBy) ?? 'businessType', q.preset, q.from, q.to); }
  @Get('treasury') @Roles(Role.CEO) treasury(@CurrentUser() u: AuthUser) { return this.m.treasuryKpi(u); }
  @Get('projects') projects(@CurrentUser() u: AuthUser, @Query() q: any) { return this.m.projectsKpi(u, sel(q)); }
  @Get('projects/finance') @Roles(Role.CEO, Role.ADMIN) projectsFinance(@CurrentUser() u: AuthUser) { return this.m.projectsFinance(u); }
}
