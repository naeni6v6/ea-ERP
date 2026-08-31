'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { compact, num, pct, sdateShort, signClass } from '@/lib/format';
import { fetchMonthlyPnl } from '@/lib/monthly';
import { BreakdownTable } from '@/components/BreakdownTable';
import { CompareBars, TrendChart } from '@/components/charts';
import { ExpenseAnalysis } from '@/components/ExpenseAnalysis';
import { ProjectBoard, type ProjectBoardHandle } from '@/components/ProjectBoard';
import { ProjectCreateModal } from '@/components/ProjectModals';
import { ErrorBox, Kpi, Progress, Section, Spinner } from '@/components/ui';
import type { Dashboard, Project, ProjectFinance } from '@/lib/types';

const ZERO_FIN: ProjectFinance = { received: '0', receivable: '0', paid: '0', payable: '0', expectedProfit: '0' };

export default function DashboardPage() {
  const f = useFilters();
  const { me, isCeo, isAdmin, labelOf, codesOf } = useSession();
  const q = f.query;
  const [projStatus, setProjStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const boardRef = useRef<ProjectBoardHandle>(null);
  const [boardDirty, setBoardDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');

  const { data, error, loading, reload } = useAsync(
    () => api.get<Dashboard>('/metrics/dashboard', q),
    [q.preset, q.from, q.to, q.businessTypeId, q.departmentId, q.projectId],
  );

  // 월별 추이 — 손익 열람 권한(CEO/ADMIN)일 때만 조회. 기간 필터와 무관하게 최근 6개월.
  const canPnl = isCeo || isAdmin;
  const monthly = useAsync(
    () => (canPnl ? fetchMonthlyPnl(q) : Promise.resolve(null)),
    [canPnl, q.businessTypeId, q.departmentId, q.projectId],
  );

  // 프로젝트 보드 — 부서·담당·목표까지 포함한 전체 목록 (scope 적용, 상태 필터는 보드 전용)
  const projList = useAsync(
    () =>
      api.get<Project[]>('/projects', {
        businessTypeId: q.businessTypeId,
        departmentId: q.departmentId,
        status: projStatus || undefined,
      }),
    [q.businessTypeId, q.departmentId, projStatus],
  );

  // 프로젝트별 자금 요약(받을돈·받은돈·나간돈·나갈돈) — 손익 권한자만
  const finRes = useAsync(
    () => (canPnl ? api.get<Record<string, ProjectFinance>>('/metrics/projects/finance') : Promise.resolve(null)),
    [canPnl],
  );
  // 거래가 없는 프로젝트도 0원으로 펼쳐볼 수 있게 채운다
  const financeMap = finRes.data
    ? Object.fromEntries((projList.data ?? []).map((p) => [p.id, finRes.data![p.id] ?? ZERO_FIN]))
    : undefined;

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const { pnl, treasury, projects } = data;

  // 보드의 목표 초안·드래그 순서를 한 번에 저장
  const saveBoard = async () => {
    if (!boardRef.current) return;
    setSaveState('saving');
    try {
      await boardRef.current.save();
      setSaveState('idle');
      projList.reload();
      reload();
    } catch {
      setSaveState('error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <h1 className="page-title">
            {isCeo ? '경영 대시보드' : isAdmin ? '부문 대시보드' : '내 현황'}
          </h1>
          <span className="badge bg-amber-50 text-warn">* 샘플 데이터입니다</span>
        </span>
        {pnl && (
          <span className="font-num text-xs text-ink-faint">
            {sdateShort(pnl.range.from)} ~ {sdateShort(pnl.range.to)}
          </span>
        )}
      </div>

      {/* ── 프로젝트 관리 (대시보드·프로젝트 통합 화면, 모든 Role) ── */}
      <Section
        title="프로젝트 관리"
        desc={`전체 ${projects.total} · 진행 ${projects.active} · 지연 ${projects.delayed} · 위험 ${projects.atRisk}`}
        right={
          <span className="flex items-center gap-2">
            <select
              className="input w-28 !py-1.5 text-xs"
              value={projStatus}
              onChange={(e) => setProjStatus(e.target.value)}
            >
              <option value="">모든 상태</option>
              {codesOf('PROJECT_STATUS').map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            {isAdmin && (
              <>
                <button
                  className="btn-primary !px-3 !py-1.5 text-xs"
                  onClick={() => setCreateOpen(true)}
                >
                  + 프로젝트 생성
                </button>
                <button
                  className={`!px-3 !py-1.5 text-xs ${
                    saveState === 'error'
                      ? 'btn-primary !bg-red-600'
                      : boardDirty
                        ? 'btn-primary'
                        : 'btn-ghost border border-line'
                  }`}
                  onClick={saveBoard}
                  disabled={!boardDirty || saveState === 'saving'}
                  title="목표 입력·드래그로 바꾼 행 순서를 저장합니다"
                >
                  {saveState === 'saving' ? '저장 중…' : saveState === 'error' ? '실패 — 재시도' : '저장'}
                </button>
              </>
            )}
          </span>
        }
      >
        {projList.loading && !projList.data ? (
          <Spinner />
        ) : projList.error ? (
          <ErrorBox message={projList.error} onRetry={projList.reload} />
        ) : (
          <ProjectBoard
            ref={boardRef}
            projects={projList.data ?? []}
            labelOf={labelOf}
            finance={financeMap}
            editable={isAdmin}
            onDirtyChange={setBoardDirty}
            onTasksChanged={() => {
              projList.reload();
              reload();
            }}
            emptyHint={
              f.businessTypeId || f.departmentId || projStatus
                ? '필터(사업유형/부서/상태)에 해당하는 프로젝트가 없습니다. 필터를 초기화해보세요.'
                : undefined
            }
          />
        )}
      </Section>

      {/* ── 손익 (CEO / ADMIN) ── */}
      {pnl && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="매출" value={pnl.sales} tone="brand" />
          <Kpi
            label="매출총이익"
            value={pnl.grossProfit}
            tone="sign"
            sub={`매출총이익률 ${pct(pnl.grossMarginPct)}`}
          />
          <Kpi
            label="영업이익"
            value={pnl.operatingProfit}
            tone="sign"
            sub={`영업이익률 ${pct(pnl.operatingMarginPct)}`}
          />
          <Kpi
            label="당기순이익"
            value={pnl.netIncome}
            tone="sign"
            sub={`순이익률 ${pct(pnl.netMarginPct)}`}
          />
        </div>
      )}

      {/* ── 월별 추이 차트 (CEO / ADMIN) ── */}
      {pnl && monthly.data && (
        <Section title="월별 추이" desc="최근 6개월 매출·영업이익 (사업유형·부서 필터 적용, 기간 필터 무관)">
          <TrendChart
            points={[...monthly.data].reverse().map((m) => ({
              label: m.short,
              sales: m.sales,
              profit: m.operatingProfit,
            }))}
          />
        </Section>
      )}

      {/* ── 이번 달 지출 분석 (용도별 도넛, 모든 Role — 권한 범위대로 집계) ── */}
      <ExpenseAnalysis />

      {/* ── 자금 (CEO 전용) ── */}
      {treasury && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="가용현금"
              value={treasury.availableCash}
              tone="brand"
              hint="총잔액 − 유보금 − 확정 지급예정 − 사용제한계좌"
              sub={
                <span>
                  총잔액 {compact(treasury.totalBalance)} · 묶인 돈{' '}
                  {compact(treasury.unavailable)}
                </span>
              }
            />
            <Kpi
              label="경영유보금"
              value={treasury.reserveTotal}
              sub={<Link href="/treasury" className="text-brand-deep hover:underline">유보금 관리 →</Link>}
            />
            <Kpi
              label="확정 지급예정"
              value={treasury.plannedConfirmed}
              sub={`계획(미확정) ${compact(treasury.plannedPlanned)}`}
            />
            <Kpi
              label="오늘 순현금"
              value={treasury.todayNet}
              tone="sign"
              sub={
                <span>
                  입금 <span className="text-pos">{compact(treasury.todayIn)}</span> · 출금{' '}
                  <span className="text-neg">{compact(treasury.todayOut)}</span>
                </span>
              }
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Section title="계좌 잔액" desc="사용제한 계좌는 가용현금에서 제외됩니다">
              <ul className="divide-y divide-line-soft">
                {treasury.accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {a.alias}
                        {a.isRestricted && (
                          <span className="badge ml-1.5 bg-amber-50 text-warn">제한</span>
                        )}
                      </div>
                      <div className="text-[13px] text-ink-faint">
                        {a.bankName}
                        {a.department ? ` · ${a.department}` : ''}
                      </div>
                    </div>
                    <div className="font-num text-sm">{num(a.balance)}</div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="자금 예측" desc="현재 잔액에서 기간 내 지급예정을 차감 (입금예정은 MVP2)">
              <div className="divide-y divide-line-soft">
                {(
                  [
                    ['7일 뒤', treasury.forecast.d7],
                    ['30일 뒤', treasury.forecast.d30],
                    ['90일 뒤', treasury.forecast.d90],
                  ] as const
                ).map(([label, v]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-ink-soft">{label}</span>
                    <span className={`font-num text-sm font-medium ${signClass(v)}`}>{num(v)}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="프로젝트 현황">
              <div className="grid grid-cols-2 gap-px bg-line-soft">
                {(
                  [
                    ['전체', projects.total, ''],
                    ['진행 중', projects.active, 'text-brand-deep'],
                    ['지연', projects.delayed, projects.delayed ? 'text-neg' : ''],
                    ['위험', projects.atRisk, projects.atRisk ? 'text-warn' : ''],
                  ] as const
                ).map(([label, v, cls]) => (
                  <div key={label} className="bg-white px-4 py-3">
                    <div className="text-xs text-ink-mute">{label}</div>
                    <div className={`font-num text-xl font-semibold ${cls}`}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-line px-4 py-3">
                <div className="mb-1.5 text-xs text-ink-mute">전체 업무 완료율</div>
                <Progress value={projects.taskCompletionPct} />
              </div>
            </Section>
          </div>
        </>
      )}

      {/* ── 손익 분해 ── */}
      {data.byBusinessType && (
        <Section
          title="사업유형별 손익"
          right={
            <Link href="/pnl" className="text-xs text-brand-deep hover:underline">
              손익 상세 →
            </Link>
          }
        >
          {data.byBusinessType.length > 0 && (
            <CompareBars
              rows={data.byBusinessType.map((r) => ({ name: r.name, sales: r.sales, profit: r.operatingProfit }))}
            />
          )}
          <BreakdownTable rows={data.byBusinessType} />
        </Section>
      )}

      {data.byDepartment && (
        <Section title="부서별 손익">
          {data.byDepartment.length > 0 && (
            <CompareBars
              rows={data.byDepartment.map((r) => ({ name: r.name, sales: r.sales, profit: r.operatingProfit }))}
            />
          )}
          <BreakdownTable rows={data.byDepartment} />
        </Section>
      )}

      {!pnl && !treasury && (
        <p className="text-xs text-ink-faint">
          {me?.name} 님의 권한에서는 손익·자금 정보가 표시되지 않습니다. 프로젝트와 업무만 조회할 수
          있습니다.
        </p>
      )}

      <ProjectCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          projList.reload();
          reload();
        }}
      />
    </div>
  );
}
