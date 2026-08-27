import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { Roles } from '../decorators/roles.decorator';
import { AuthUser, CurrentUser } from '../decorators/current-user.decorator';
@Controller('audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}
  @Get() @Roles(Role.CEO)
  list(@CurrentUser() u: AuthUser, @Query('entity') entity?: string, @Query('entityId') entityId?: string, @Query('take') take?: string) {
    return this.audit.list(u.companyId, { entity, entityId, take: take ? Number(take) : undefined });
  }
}
