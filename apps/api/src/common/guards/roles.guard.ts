import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
/** @Roles(CEO, ADMIN) — 사용자가 해당 Role을 하나라도 가지면 통과. 세부 Scope는 ScopeService에서 검사. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest().user;
    if (!user) return false;
    const mine: Role[] = (user.roles ?? []).map((r: any) => r.role);
    return required.some((r) => mine.includes(r));
  }
}
