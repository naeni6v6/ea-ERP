import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: process.env.JWT_SECRET || 'dev-secret' });
  }
  /** 토큰의 role/scope를 신뢰하지 않고 매 요청 DB에서 재조회 → 권한 변경 즉시 반영 */
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const u = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { roleScopes: true } });
    if (!u || !u.isActive) throw new UnauthorizedException();
    return { id: u.id, companyId: u.companyId, email: u.email, name: u.name, roles: u.roleScopes.map((r) => ({ role: r.role, scopeType: r.scopeType, businessTypeId: r.businessTypeId, departmentId: r.departmentId, projectId: r.projectId })) };
  }
}
