import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Role × Scope → 유효 접근 집합.
 * 프론트에서 버튼을 숨기는 것과 별개로, 모든 조회/변경 쿼리는 이 서비스가 만든 where 조건을 통과해야 한다.
 */
export interface EffectiveScope {
  isCeo: boolean;
  isAdmin: boolean;
  /** ADMIN/EMPLOYEE 가 접근 가능한 부서 id 집합 (COMPANY scope면 all) */
  departmentIds: string[] | 'ALL';
  businessTypeIds: string[] | 'ALL';
  /** 직접 부여받았거나 참여 중인 프로젝트 */
  projectIds: string[] | 'ALL';
}

@Injectable()
export class ScopeService {
  constructor(private prisma: PrismaService) {}

  async resolve(user: AuthUser): Promise<EffectiveScope> {
    const roles = user.roles ?? [];
    const isCeo = roles.some((r) => r.role === Role.CEO);
    if (isCeo) return { isCeo: true, isAdmin: true, departmentIds: 'ALL', businessTypeIds: 'ALL', projectIds: 'ALL' };
    const isAdmin = roles.some((r) => r.role === Role.ADMIN);
    const companyWide = roles.some((r) => r.scopeType === 'COMPANY');
    const departmentIds = new Set<string>();
    const businessTypeIds = new Set<string>();
    const projectIds = new Set<string>();
    for (const r of roles) {
      if (r.departmentId) departmentIds.add(r.departmentId);
      if (r.businessTypeId) businessTypeIds.add(r.businessTypeId);
      if (r.projectId) projectIds.add(r.projectId);
    }
    // 소속 부서 + 참여 프로젝트는 기본 포함
    const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { departmentId: true, memberships: { select: { projectId: true } } } });
    if (me?.departmentId) departmentIds.add(me.departmentId);
    me?.memberships.forEach((m) => projectIds.add(m.projectId));
    // 부서/사업유형 scope로 접근 가능한 프로젝트 확장
    if (departmentIds.size || businessTypeIds.size) {
      const ps = await this.prisma.project.findMany({
        where: {
          companyId: user.companyId, deletedAt: null,
          OR: [
            ...(departmentIds.size ? [{ departments: { some: { departmentId: { in: [...departmentIds] } } } }] : []),
            ...(businessTypeIds.size ? [{ businessTypeId: { in: [...businessTypeIds] } }] : []),
          ],
        }, select: { id: true },
      });
      ps.forEach((p) => projectIds.add(p.id));
    }
    return {
      isCeo: false, isAdmin,
      departmentIds: companyWide ? 'ALL' : [...departmentIds],
      businessTypeIds: companyWide ? 'ALL' : [...businessTypeIds],
      projectIds: companyWide ? 'ALL' : [...projectIds],
    };
  }

  /** 프로젝트 조회 where */
  projectWhere(s: EffectiveScope): Prisma.ProjectWhereInput {
    if (s.projectIds === 'ALL') return {};
    return { id: { in: s.projectIds } };
  }

  /** 분개라인 조회 where — 부서/프로젝트/사업유형 중 하나라도 접근 범위에 있으면 조회 */
  lineWhere(s: EffectiveScope): Prisma.JournalLineWhereInput {
    if (s.isCeo || s.departmentIds === 'ALL') return {};
    const or: Prisma.JournalLineWhereInput[] = [];
    if (s.departmentIds.length) or.push({ departmentId: { in: s.departmentIds } });
    if (s.projectIds !== 'ALL' && s.projectIds.length) or.push({ projectId: { in: s.projectIds } });
    if (s.businessTypeIds !== 'ALL' && s.businessTypeIds.length) or.push({ businessTypeId: { in: s.businessTypeIds } });
    return or.length ? { OR: or } : { id: '__none__' };
  }

  async assertProject(user: AuthUser, projectId: string) {
    const s = await this.resolve(user);
    if (s.projectIds !== 'ALL' && !s.projectIds.includes(projectId)) throw new ForbiddenException('프로젝트 접근 권한이 없습니다');
    return s;
  }
  async assertDepartment(user: AuthUser, departmentId: string) {
    const s = await this.resolve(user);
    if (s.departmentIds !== 'ALL' && !s.departmentIds.includes(departmentId)) throw new ForbiddenException('부서 접근 권한이 없습니다');
    return s;
  }
  /** 회사 전체 자금(총잔액·유보금·가용현금)은 CEO 전용 (Q5 기본 정책) */
  assertTreasury(user: AuthUser) {
    if (!user.roles?.some((r) => r.role === Role.CEO)) throw new ForbiddenException('자금 정보는 대표만 조회할 수 있습니다');
  }
  /** 손익 조회는 CEO / ADMIN (ADMIN은 자기 scope로 자동 필터) */
  assertPnl(user: AuthUser) {
    if (!user.roles?.some((r) => r.role === Role.CEO || r.role === Role.ADMIN)) throw new ForbiddenException('손익 정보 조회 권한이 없습니다');
  }
}
