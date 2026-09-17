import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { toDateOnly, todaySeoul } from '../common/dates';
import { BusinessTypeDto, CodeValueDto, CreateUserDto, DepartmentDto, RoleScopeDto, UpdateUserDto } from './org.dto';

/** 권한 서열 — 숫자가 작을수록 높다 */
const ROLE_RANK: Record<Role, number> = { CEO: 0, ADMIN: 1, EMPLOYEE: 2 };

/** 이메일 unique 위반을 400대 메시지로 바꾼다 */
function emailTaken(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('이미 사용 중인 이메일입니다');
  throw e;
}

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  // 오늘의 공지 — 날짜당 1건. content 비우면 삭제
  todayNotice(cid: string) {
    return this.prisma.notice.findUnique({ where: { companyId_noticeDate: { companyId: cid, noticeDate: toDateOnly(todaySeoul()) } } });
  }
  async setTodayNotice(actor: AuthUser, content: string) {
    const noticeDate = toDateOnly(todaySeoul());
    const key = { companyId_noticeDate: { companyId: actor.companyId, noticeDate } };
    const v = content.trim();
    if (!v) {
      await this.prisma.notice.deleteMany({ where: { companyId: actor.companyId, noticeDate } });
      await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'Notice', entityId: todaySeoul(), action: 'DELETE' });
      return null;
    }
    const n = await this.prisma.notice.upsert({
      where: key,
      create: { companyId: actor.companyId, noticeDate, content: v },
      update: { content: v },
    });
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'Notice', entityId: n.id, action: 'UPSERT', after: { content: v } });
    return n;
  }

  // 사업유형
  listBusinessTypes(cid: string) { return this.prisma.businessType.findMany({ where: { companyId: cid }, orderBy: { sortOrder: 'asc' } }); }
  createBusinessType(cid: string, d: BusinessTypeDto) { return this.prisma.businessType.create({ data: { ...d, companyId: cid } }); }
  updateBusinessType(cid: string, id: string, d: Partial<BusinessTypeDto>) { return this.prisma.businessType.update({ where: { id, companyId: cid }, data: d }); }

  // 부서
  listDepartments(cid: string) { return this.prisma.department.findMany({ where: { companyId: cid }, orderBy: { sortOrder: 'asc' } }); }
  createDepartment(cid: string, d: DepartmentDto) { return this.prisma.department.create({ data: { ...d, companyId: cid } }); }
  updateDepartment(cid: string, id: string, d: Partial<DepartmentDto>) { return this.prisma.department.update({ where: { id, companyId: cid }, data: d }); }

  // 사용자
  /**
   * 권한은 대표 > 관리자 > 직원 3단계. 조회 범위는 역할에서 정해진다:
   *  대표·관리자 = 회사 전체, 직원 = 소속 부서(부서 미지정이면 기존 기본값대로 회사 전체).
   * 참여 프로젝트는 ScopeService 가 멤버십으로 따로 열어 준다.
   */
  private scopesFor(role: Role, departmentId: string | null) {
    if (role === 'EMPLOYEE' && departmentId) return [{ role, scopeType: 'DEPARTMENT' as const, departmentId }];
    return [{ role, scopeType: 'COMPANY' as const, departmentId: null }];
  }
  /** 여러 scope 가 섞여 있던 예전 계정은 가장 높은 역할로 본다 */
  private topRole(scopes: { role: Role }[]): Role {
    return scopes.reduce<Role>((top, s) => (ROLE_RANK[s.role] < ROLE_RANK[top] ? s.role : top), 'EMPLOYEE');
  }
  private readonly userSelect = {
    id: true, email: true, name: true, isActive: true, department: true, roleScopes: true,
    _count: { select: { tasks: { where: { isDone: false, deletedAt: null, project: { deletedAt: null } } } } },
  } satisfies Prisma.UserSelect;
  private toRow(u: Prisma.UserGetPayload<{ select: OrgService['userSelect'] }>) {
    const { _count, ...rest } = u;
    return { ...rest, role: this.topRole(u.roleScopes), openTaskCount: _count.tasks };
  }
  private async assertDepartment(cid: string, departmentId: string | null | undefined) {
    if (!departmentId) return;
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, companyId: cid } });
    if (!dept) throw new BadRequestException('소속 부서를 찾을 수 없습니다');
  }
  /** 활성 대표가 한 명도 남지 않게 되는 변경은 막는다 (설정 화면에 아무도 못 들어가게 됨) */
  private async assertKeepsCeo(cid: string, userId: string) {
    const others = await this.prisma.user.count({ where: { companyId: cid, id: { not: userId }, isActive: true, roleScopes: { some: { role: 'CEO' } } } });
    if (others === 0) throw new BadRequestException('대표 권한을 가진 활성 계정이 최소 1명은 있어야 합니다');
  }

  /** 대표 → 관리자 → 직원, 같은 권한 안에서는 이름순 */
  async listUsers(cid: string) {
    const users = await this.prisma.user.findMany({ where: { companyId: cid }, select: this.userSelect });
    return users.map((u) => this.toRow(u)).sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.name.localeCompare(b.name, 'ko'));
  }
  async createUser(actor: AuthUser, d: CreateUserDto) {
    await this.assertDepartment(actor.companyId, d.departmentId);
    const role = d.role ?? 'EMPLOYEE';
    const u = await this.prisma.user.create({ data: { companyId: actor.companyId, email: d.email, name: d.name, departmentId: d.departmentId ?? null, passwordHash: await bcrypt.hash(d.password, 10) } }).catch(emailTaken);
    await this.prisma.userRoleScope.createMany({ data: this.scopesFor(role, d.departmentId ?? null).map((s) => ({ ...s, userId: u.id })) });
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'User', entityId: u.id, action: 'CREATE', after: { email: u.email, name: u.name, role } });
    return this.getUser(actor.companyId, u.id);
  }
  async getUser(cid: string, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, companyId: cid }, select: this.userSelect });
    if (!u) throw new NotFoundException(); return this.toRow(u);
  }
  async updateUser(actor: AuthUser, id: string, d: UpdateUserDto) {
    const before = await this.getUser(actor.companyId, id);
    await this.assertDepartment(actor.companyId, d.departmentId);
    if (d.role && d.role !== 'CEO' && before.role === 'CEO') {
      if (id === actor.id) throw new BadRequestException('본인의 대표 권한은 내릴 수 없습니다');
      await this.assertKeepsCeo(actor.companyId, id);
    }
    if (d.isActive === false) {
      if (id === actor.id) throw new BadRequestException('본인 계정은 비활성화할 수 없습니다');
      if (before.role === 'CEO') await this.assertKeepsCeo(actor.companyId, id);
    }
    const data: Prisma.UserUncheckedUpdateInput = { name: d.name, email: d.email, departmentId: d.departmentId, isActive: d.isActive };
    if (d.password) data.passwordHash = await bcrypt.hash(d.password, 10);
    const departmentId = d.departmentId !== undefined ? d.departmentId : (before.department?.id ?? null);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data }).catch(emailTaken);
      // 권한을 보냈으면 3단계 규칙으로 scope 를 다시 맞춘다 — 직원은 부서가 바뀌면 조회 범위도 따라간다
      if (d.role) {
        await tx.userRoleScope.deleteMany({ where: { userId: id } });
        await tx.userRoleScope.createMany({ data: this.scopesFor(d.role, departmentId).map((s) => ({ ...s, userId: id })) });
      }
    });
    const after = await this.getUser(actor.companyId, id);
    const action = d.role && d.role !== before.role ? 'PERMISSION_CHANGE' : 'UPDATE';
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'User', entityId: id, action, before, after });
    return after;
  }
  /** 퇴사 — 로그인 차단 · 로그인 토큰 폐기 · 진행 중 업무 담당 해제. 완료 업무와 지난 기록의 담당자는 그대로 둔다 */
  async retireUser(actor: AuthUser, id: string) {
    const before = await this.getUser(actor.companyId, id);
    if (id === actor.id) throw new BadRequestException('본인 계정은 퇴사 처리할 수 없습니다');
    if (before.role === 'CEO') await this.assertKeepsCeo(actor.companyId, id);
    const [, unassigned] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { isActive: false } }),
      this.prisma.task.updateMany({ where: { assigneeId: id, isDone: false, deletedAt: null }, data: { assigneeId: null } }),
      this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'User', entityId: id, action: 'RETIRE', before, after: { isActive: false, unassignedTasks: unassigned.count } });
    return { ...(await this.getUser(actor.companyId, id)), unassignedTasks: unassigned.count };
  }
  async reinstateUser(actor: AuthUser, id: string) {
    await this.getUser(actor.companyId, id);
    await this.prisma.user.update({ where: { id }, data: { isActive: true } });
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'User', entityId: id, action: 'REINSTATE', after: { isActive: true } });
    return this.getUser(actor.companyId, id);
  }
  /** 권한 전체 교체 (Role × Scope 목록) — 반드시 Audit */
  async setRoleScopes(actor: AuthUser, userId: string, scopes: RoleScopeDto[]) {
    // 대상 사용자가 내 회사 소속인지 먼저 확인 — UserRoleScope에는 companyId가 없어 여기서 막지 않으면 회사 경계가 뚫린다
    const target = await this.prisma.user.findFirst({ where: { id: userId, companyId: actor.companyId } });
    if (!target) throw new NotFoundException('사용자를 찾을 수 없습니다');
    for (const s of scopes) {
      if (s.scopeType === 'DEPARTMENT' && !s.departmentId) throw new BadRequestException('DEPARTMENT scope에는 departmentId가 필요합니다');
      if (s.scopeType === 'PROJECT' && !s.projectId) throw new BadRequestException('PROJECT scope에는 projectId가 필요합니다');
      if (s.scopeType === 'BUSINESS_TYPE' && !s.businessTypeId) throw new BadRequestException('BUSINESS_TYPE scope에는 businessTypeId가 필요합니다');
    }
    const before = await this.prisma.userRoleScope.findMany({ where: { userId } });
    await this.prisma.$transaction([
      this.prisma.userRoleScope.deleteMany({ where: { userId } }),
      this.prisma.userRoleScope.createMany({ data: scopes.map((s) => ({ userId, role: s.role, scopeType: s.scopeType, businessTypeId: s.businessTypeId ?? null, departmentId: s.departmentId ?? null, projectId: s.projectId ?? null })) }),
    ]);
    const after = await this.prisma.userRoleScope.findMany({ where: { userId } });
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'UserRoleScope', entityId: userId, action: 'PERMISSION_CHANGE', before, after });
    return after;
  }

  // 코드값
  listCodes(cid: string, kind?: string) { return this.prisma.codeValue.findMany({ where: { companyId: cid, kind }, orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }] }); }
  upsertCode(cid: string, d: CodeValueDto) {
    return this.prisma.codeValue.upsert({ where: { companyId_kind_code: { companyId: cid, kind: d.kind, code: d.code } }, update: { label: d.label, sortOrder: d.sortOrder, isActive: d.isActive }, create: { ...d, companyId: cid } });
  }
}
