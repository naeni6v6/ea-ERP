import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { toDateOnly, todaySeoul } from '../common/dates';
import { BusinessTypeDto, CodeValueDto, CreateUserDto, DepartmentDto, RoleScopeDto, UpdateUserDto } from './org.dto';

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
  listUsers(cid: string) { return this.prisma.user.findMany({ where: { companyId: cid }, select: { id: true, email: true, name: true, isActive: true, department: true, roleScopes: true }, orderBy: { name: 'asc' } }); }
  async createUser(actor: AuthUser, d: CreateUserDto) {
    const u = await this.prisma.user.create({ data: { companyId: actor.companyId, email: d.email, name: d.name, departmentId: d.departmentId ?? null, passwordHash: await bcrypt.hash(d.password, 10) } });
    // 기본 권한: EMPLOYEE + 소속부서(없으면 COMPANY scope 없이 EMPLOYEE만)
    await this.prisma.userRoleScope.create({ data: { userId: u.id, role: 'EMPLOYEE', scopeType: d.departmentId ? 'DEPARTMENT' : 'COMPANY', departmentId: d.departmentId ?? null } });
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'User', entityId: u.id, action: 'CREATE', after: { email: u.email, name: u.name } });
    return this.getUser(actor.companyId, u.id);
  }
  async getUser(cid: string, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, companyId: cid }, select: { id: true, email: true, name: true, isActive: true, department: true, roleScopes: true } });
    if (!u) throw new NotFoundException(); return u;
  }
  async updateUser(actor: AuthUser, id: string, d: UpdateUserDto) {
    const before = await this.getUser(actor.companyId, id);
    const data: any = { name: d.name, departmentId: d.departmentId, isActive: d.isActive };
    if (d.password) data.passwordHash = await bcrypt.hash(d.password, 10);
    await this.prisma.user.update({ where: { id }, data });
    const after = await this.getUser(actor.companyId, id);
    await this.audit.log({ companyId: actor.companyId, actorId: actor.id, entity: 'User', entityId: id, action: 'UPDATE', before, after });
    return after;
  }
  /** 권한 전체 교체 (Role × Scope 목록) — 반드시 Audit */
  async setRoleScopes(actor: AuthUser, userId: string, scopes: RoleScopeDto[]) {
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
