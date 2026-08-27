import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const safe = (v: unknown) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? x.toString() : x))));

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}
  /** 재무 관련 중요한 변경은 반드시 기록 (사용자/일시/전/후/이유) */
  async log(p: { companyId: string; actorId?: string | null; entity: string; entityId: string; action: string; before?: unknown; after?: unknown; reason?: string | null }, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    return db.auditLog.create({ data: { companyId: p.companyId, actorId: p.actorId ?? null, entity: p.entity, entityId: p.entityId, action: p.action, before: safe(p.before) ?? Prisma.JsonNull, after: safe(p.after) ?? Prisma.JsonNull, reason: p.reason ?? null } });
  }
  list(companyId: string, q: { entity?: string; entityId?: string; take?: number }) {
    return this.prisma.auditLog.findMany({ where: { companyId, entity: q.entity, entityId: q.entityId }, orderBy: { createdAt: 'desc' }, take: q.take ?? 100, include: { actor: { select: { id: true, name: true } } } });
  }
}
