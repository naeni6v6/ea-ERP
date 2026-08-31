import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
export interface AuthUser {
  id: string; companyId: string; email: string; name: string; department?: string | null;
  roles: { role: Role; scopeType: string; businessTypeId?: string | null; departmentId?: string | null; projectId?: string | null }[];
}
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);
