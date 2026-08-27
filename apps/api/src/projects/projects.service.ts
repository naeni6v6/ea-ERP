import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScopeService } from '../common/scope/scope.service';
import { AuditService } from '../common/audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { won } from '../common/money';
import { toDateOnly, todaySeoul } from '../common/dates';
import { ProjectDto, TaskDto } from './projects.dto';

/** 진행률 = Σ(완료 task weight) / Σ(weight) × 100. weight 기본 1 → 완료수/전체수 */
export const progressOf = (tasks: { isDone: boolean; weight: number }[]) => {
  const total = tasks.reduce((a, t) => a + t.weight, 0);
  const done = tasks.filter((t) => t.isDone).reduce((a, t) => a + t.weight, 0);
  return { totalTasks: tasks.length, doneTasks: tasks.filter((t) => t.isDone).length, progress: total === 0 ? 0 : Math.round((done / total) * 1000) / 10 };
};

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService, private scope: ScopeService, private audit: AuditService) {}

  private include = {
    businessType: true, leadDepartment: true, owner: { select: { id: true, name: true } },
    departments: { include: { department: true } }, members: { include: { user: { select: { id: true, name: true, email: true } } } },
    tasks: { where: { deletedAt: null }, select: { isDone: true, weight: true } },
  } satisfies Prisma.ProjectInclude;

  private decorate(p: any) {
    const prog = progressOf(p.tasks ?? []);
    const today = todaySeoul();
    const isDelayed = !!p.planEndDate && !['DONE', 'CANCELLED'].includes(p.status) && p.planEndDate.toISOString().slice(0, 10) < today;
    const { tasks, ...rest } = p;
    return { ...rest, ...prog, isDelayed };
  }

  async list(user: AuthUser, q: { businessTypeId?: string; departmentId?: string; status?: string }) {
    const s = await this.scope.resolve(user);
    const where: Prisma.ProjectWhereInput = {
      companyId: user.companyId, deletedAt: null, ...this.scope.projectWhere(s),
      businessTypeId: q.businessTypeId, status: q.status,
      ...(q.departmentId ? { departments: { some: { departmentId: q.departmentId } } } : {}),
    };
    const rows = await this.prisma.project.findMany({ where, include: this.include, orderBy: [{ status: 'asc' }, { planEndDate: 'asc' }] });
    return rows.map((p) => this.decorate(p));
  }

  async get(user: AuthUser, id: string) {
    await this.scope.assertProject(user, id);
    const p = await this.prisma.project.findFirst({ where: { id, companyId: user.companyId, deletedAt: null }, include: this.include });
    if (!p) throw new NotFoundException();
    return this.decorate(p);
  }

  private data(d: Partial<ProjectDto>): Prisma.ProjectUncheckedUpdateInput {
    const o: Prisma.ProjectUncheckedUpdateInput = {};
    for (const k of ['code', 'name', 'businessTypeId', 'leadDepartmentId', 'ownerUserId', 'status', 'priority', 'goal', 'description', 'financeVisibleToMembers'] as const) if (d[k] !== undefined) (o as any)[k] = d[k];
    for (const k of ['startDate', 'planEndDate', 'actualEndDate'] as const) if (d[k] !== undefined) (o as any)[k] = d[k] ? toDateOnly(d[k]!) : null;
    for (const k of ['contractAmount', 'expectedRevenue', 'budgetAmount', 'targetCost', 'targetProfit'] as const) if (d[k] !== undefined) (o as any)[k] = won(d[k] as any);
    return o;
  }

  async create(user: AuthUser, d: ProjectDto) {
    const s = await this.scope.resolve(user);
    if (!s.isAdmin) throw new ForbiddenException('프로젝트 생성 권한이 없습니다');
    if (s.departmentIds !== 'ALL' && !s.departmentIds.includes(d.leadDepartmentId)) throw new ForbiddenException('주관부서 권한이 없습니다');
    const deptIds = Array.from(new Set([d.leadDepartmentId, ...(d.departmentIds ?? [])]));
    const p = await this.prisma.project.create({
      data: {
        ...(this.data(d) as any), companyId: user.companyId,
        departments: { create: deptIds.map((departmentId) => ({ departmentId, isLead: departmentId === d.leadDepartmentId })) },
        members: { create: (d.memberUserIds ?? []).map((userId) => ({ userId, roleInProject: userId === d.ownerUserId ? 'OWNER' : 'MEMBER' })) },
      },
    });
    await this.audit.log({ companyId: user.companyId, actorId: user.id, entity: 'Project', entityId: p.id, action: 'CREATE', after: d });
    return this.get(user, p.id);
  }

  async update(user: AuthUser, id: string, d: Partial<ProjectDto>) {
    const s = await this.scope.assertProject(user, id);
    if (!s.isAdmin) throw new ForbiddenException('프로젝트 수정 권한이 없습니다');
    const before = await this.get(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id }, data: this.data(d) });
      if (d.departmentIds || d.leadDepartmentId) {
        const lead = d.leadDepartmentId ?? before.leadDepartmentId;
        const deptIds = Array.from(new Set([lead, ...(d.departmentIds ?? before.departments.map((x: any) => x.departmentId))]));
        await tx.projectDepartment.deleteMany({ where: { projectId: id } });
        await tx.projectDepartment.createMany({ data: deptIds.map((departmentId) => ({ projectId: id, departmentId, isLead: departmentId === lead })) });
      }
      if (d.memberUserIds) {
        await tx.projectMember.deleteMany({ where: { projectId: id } });
        await tx.projectMember.createMany({ data: d.memberUserIds.map((userId) => ({ projectId: id, userId, roleInProject: userId === (d.ownerUserId ?? before.ownerUserId) ? 'OWNER' : 'MEMBER' })) });
      }
    });
    const after = await this.get(user, id);
    const budgetChanged = d.budgetAmount !== undefined && String(before.budgetAmount) !== String(after.budgetAmount);
    await this.audit.log({ companyId: user.companyId, actorId: user.id, entity: 'Project', entityId: id, action: budgetChanged ? 'BUDGET_CHANGE' : 'UPDATE', before: { budgetAmount: before.budgetAmount, status: before.status }, after: { budgetAmount: after.budgetAmount, status: after.status } });
    return after;
  }

  /** Soft delete */
  async remove(user: AuthUser, id: string, reason?: string) {
    const s = await this.scope.assertProject(user, id);
    if (!s.isCeo) throw new ForbiddenException('프로젝트 삭제는 대표만 가능합니다');
    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ companyId: user.companyId, actorId: user.id, entity: 'Project', entityId: id, action: 'DELETE', reason });
    return { ok: true };
  }

  // ───── Tasks ─────
  async listTasks(user: AuthUser, projectId: string) {
    await this.scope.assertProject(user, projectId);
    return this.prisma.task.findMany({ where: { projectId, deletedAt: null }, include: { assignee: { select: { id: true, name: true } } }, orderBy: [{ isDone: 'asc' }, { sortOrder: 'asc' }, { dueDate: 'asc' }] });
  }
  async myTasks(user: AuthUser) {
    return this.prisma.task.findMany({ where: { assigneeId: user.id, deletedAt: null, project: { deletedAt: null } }, include: { project: { select: { id: true, name: true, code: true } } }, orderBy: [{ isDone: 'asc' }, { dueDate: 'asc' }] });
  }
  async createTask(user: AuthUser, projectId: string, d: TaskDto) {
    await this.scope.assertProject(user, projectId);
    const t = await this.prisma.task.create({ data: { projectId, title: d.title, description: d.description, assigneeId: d.assigneeId ?? null, dueDate: d.dueDate ? toDateOnly(d.dueDate) : null, priority: d.priority ?? 'NORMAL', status: d.status ?? 'TODO', isDone: d.isDone ?? d.status === 'DONE', weight: d.weight ?? 1, sortOrder: d.sortOrder ?? 0 } });
    return t;
  }
  async updateTask(user: AuthUser, taskId: string, d: Partial<TaskDto>) {
    const t = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!t) throw new NotFoundException();
    await this.scope.assertProject(user, t.projectId);
    const data: Prisma.TaskUncheckedUpdateInput = { ...d as any };
    if (d.dueDate !== undefined) data.dueDate = d.dueDate ? toDateOnly(d.dueDate) : null;
    if (d.status === 'DONE') data.isDone = true; else if (d.status && d.isDone === undefined) data.isDone = false;
    if (d.isDone === true && !d.status) data.status = 'DONE';
    return this.prisma.task.update({ where: { id: taskId }, data });
  }
  async removeTask(user: AuthUser, taskId: string) {
    const t = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null } });
    if (!t) throw new NotFoundException();
    await this.scope.assertProject(user, t.projectId);
    await this.prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
    return { ok: true };
  }
}
