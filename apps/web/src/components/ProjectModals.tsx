'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { num } from '@/lib/format';
import { MoneyInput } from '@/components/MoneyInput';
import { Field, Modal } from '@/components/ui';

/** 프로젝트 생성 모달 — 대시보드(통합 프로젝트 화면)에서 사용 */
export function ProjectCreateModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { businessTypes, departments, codesOf } = useSession();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [businessTypeId, setBusinessTypeId] = useState('');
  const [leadDepartmentId, setLeadDepartmentId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [startDate, setStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/projects', {
        code,
        name,
        businessTypeId,
        leadDepartmentId,
        status,
        startDate: startDate || undefined,
        planEndDate: planEndDate || undefined,
        contractAmount: contractAmount || '0',
        budgetAmount: budgetAmount || '0',
        goal: goal || undefined,
      });
      onSaved();
      onClose();
      setCode('');
      setName('');
      setGoal('');
      setContractAmount('');
      setBudgetAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="프로젝트 생성" wide>
      <div className="space-y-3.5">
        <div className="grid grid-cols-3 gap-3">
          <Field label="코드" required hint="예: P-2026-002">
            <input className="input font-num" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <div className="col-span-2">
            <Field label="프로젝트명" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="사업유형" required>
            <select
              className="input"
              value={businessTypeId}
              onChange={(e) => setBusinessTypeId(e.target.value)}
            >
              <option value="">선택</option>
              {businessTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="주관부서" required>
            <select
              className="input"
              value={leadDepartmentId}
              onChange={(e) => setLeadDepartmentId(e.target.value)}
            >
              <option value="">선택</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="상태">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {codesOf('PROJECT_STATUS').map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="시작일">
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="종료예정일">
            <input
              type="date"
              className="input"
              value={planEndDate}
              onChange={(e) => setPlanEndDate(e.target.value)}
            />
          </Field>
          <Field label="수주금액">
            <MoneyInput value={contractAmount} onChange={setContractAmount} />
          </Field>
          <Field label="실행예산">
            <MoneyInput value={budgetAmount} onChange={setBudgetAmount} />
          </Field>
        </div>

        <Field label="목표">
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={busy || !code || !name || !businessTypeId || !leadDepartmentId}
          >
            {busy ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ───────────────────────── 프로젝트 업로드 ─────────────────────────

/** 열 이름 별칭 — 한글/영문 어떤 헤더로 와도 표준 키로 맞춘다 (소문자·공백제거 후 비교) */
const HEADER_ALIASES: Record<string, string> = {
  code: 'code', 코드: 'code', 프로젝트코드: 'code',
  name: 'name', 프로젝트명: 'name', 이름: 'name', 명칭: 'name', 프로젝트: 'name',
  businesstype: 'businessType', 사업유형: 'businessType', 유형: 'businessType',
  department: 'department', leaddepartment: 'department', 주관부서: 'department', 부서: 'department', 담당부서: 'department',
  status: 'status', 상태: 'status', 진행현황: 'status', 진행상태: 'status',
  startdate: 'startDate', 시작일: 'startDate', 시작날짜: 'startDate', 시작: 'startDate',
  planenddate: 'planEndDate', enddate: 'planEndDate', 종료예정일: 'planEndDate', 마감일: 'planEndDate', 마감날짜: 'planEndDate', 종료일: 'planEndDate', 마감: 'planEndDate',
  contractamount: 'contractAmount', 수주금액: 'contractAmount', 계약금액: 'contractAmount', 계약금: 'contractAmount', 금액: 'contractAmount',
  budgetamount: 'budgetAmount', budget: 'budgetAmount', 실행예산: 'budgetAmount', 예산: 'budgetAmount',
  goal: 'goal', 목표: 'goal', 프로젝트목표: 'goal',
};

const normKey = (k: string) => HEADER_ALIASES[k.trim().toLowerCase().replace(/[\s_()]/g, '')] ?? '';

/** "100,000,000" / "1억" 아닌 순수 숫자·콤마만 처리 — 콤마·원·공백 제거 */
const normAmount = (v: unknown): string => {
  // 부호는 맨 앞 하나만 인정 — "5-" 같은 값이 BigInt()를 깨뜨리지 않게
  const s = String(v ?? '').replace(/[^\d-]/g, '');
  const digits = s.replace(/-/g, '');
  if (digits === '') return '0';
  return `${s.startsWith('-') ? '-' : ''}${BigInt(digits)}`;
};

/** 2026-07-27 / 2026.7.27 / 26/07/27 → "2026-07-27" */
const normDate = (v: unknown): string | undefined => {
  const m = String(v ?? '').trim().replace(/[./]/g, '-').match(/^(\d{2,4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return undefined;
  const y = m[1].length === 2 ? `20${m[1]}` : m[1];
  return `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
};

/** 따옴표(")를 지원하는 CSV/TSV 파서 — "100,000,000"처럼 콤마가 든 금액도 안전 */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

interface ParsedRow {
  code: string;
  name: string;
  businessTypeId: string;
  businessTypeName: string;
  leadDepartmentId: string;
  departmentName: string;
  status: string;
  statusLabel: string;
  startDate?: string;
  planEndDate?: string;
  contractAmount: string;
  budgetAmount: string;
  goal?: string;
  warnings: string[];
  valid: boolean;
}

/** 업로드 파일(CSV·TSV·JSON)을 파싱해 미리보기 후 일괄 생성한다 */
export function ProjectUploadModal({
  open,
  onClose,
  onSaved,
  existingCodes,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** 코드 미기재 행의 자동 코드 생성(PRJ-###)에 사용 */
  existingCodes: string[];
}) {
  const { businessTypes, departments, codesOf } = useSession();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; fails: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const statusCodes = codesOf('PROJECT_STATUS');

  const reset = () => {
    setRows(null);
    setFileName('');
    setError('');
    setResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  /** 이름 매칭 — 정확히 일치 > 포함 일치 > 첫 항목(경고 표시) */
  const resolve = <T extends { id: string; name: string }>(list: T[], raw: string, kind: string, warnings: string[]): T | null => {
    if (!list.length) return null;
    const v = raw.trim();
    if (v) {
      const exact = list.find((x) => x.name === v || (x as any).code === v);
      if (exact) return exact;
      const partial = list.find((x) => x.name.includes(v) || v.includes(x.name));
      if (partial) {
        warnings.push(`${kind} '${v}' → '${partial.name}'로 매칭`);
        return partial;
      }
      warnings.push(`${kind} '${v}' 없음 → '${list[0].name}'로 기본 지정`);
    } else {
      warnings.push(`${kind} 미기재 → '${list[0].name}'로 기본 지정`);
    }
    return list[0];
  };

  const buildRows = (records: Record<string, unknown>[]) => {
    const used = new Set(existingCodes);
    let seq = existingCodes
      .map((c) => /^PRJ-(\d+)$/.exec(c)?.[1])
      .filter(Boolean)
      .reduce((a, b) => Math.max(a, Number(b)), 0);

    const parsed: ParsedRow[] = records.map((rec) => {
      // 원본 키 → 표준 키
      const r: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        const nk = normKey(k);
        if (nk && v !== null && v !== undefined) r[nk] = String(v);
      }
      const warnings: string[] = [];
      const name = (r.name ?? '').trim();

      let code = (r.code ?? '').trim();
      if (!code) {
        do { seq += 1; code = `PRJ-${String(seq).padStart(3, '0')}`; } while (used.has(code));
        warnings.push(`코드 자동 생성 (${code})`);
      } else if (used.has(code)) {
        warnings.push('이미 존재하는 코드 — 생성 시 실패할 수 있음');
      }
      used.add(code);

      const bt = resolve(businessTypes, r.businessType ?? '', '사업유형', warnings);
      const dept = resolve(departments, r.department ?? '', '주관부서', warnings);

      const sRaw = (r.status ?? '').trim();
      const sMatch = statusCodes.find((c) => c.code === sRaw.toUpperCase() || c.label === sRaw);
      if (sRaw && !sMatch) warnings.push(`상태 '${sRaw}' 없음 → '계획'으로 지정`);

      const valid = !!name && !!bt && !!dept;
      if (!name) warnings.push('프로젝트명 누락 — 이 행은 건너뜀');

      return {
        code,
        name,
        businessTypeId: bt?.id ?? '',
        businessTypeName: bt?.name ?? '—',
        leadDepartmentId: dept?.id ?? '',
        departmentName: dept?.name ?? '—',
        status: sMatch?.code ?? 'PLANNED',
        statusLabel: sMatch?.label ?? '계획',
        startDate: normDate(r.startDate),
        planEndDate: normDate(r.planEndDate),
        contractAmount: normAmount(r.contractAmount),
        budgetAmount: normAmount(r.budgetAmount),
        goal: (r.goal ?? '').trim() || undefined,
        warnings,
        valid,
      };
    });
    setRows(parsed);
  };

  const onFile = async (file: File) => {
    setError('');
    setResult(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const ext = file.name.toLowerCase().split('.').pop() ?? '';
      if (ext === 'json') {
        const j = JSON.parse(text);
        const arr = Array.isArray(j) ? j : Array.isArray(j?.projects) ? j.projects : null;
        if (!arr) throw new Error('JSON은 프로젝트 객체 배열이어야 합니다');
        buildRows(arr);
      } else {
        // csv / tsv / txt — 헤더 행에서 구분자 자동 감지
        const head = text.slice(0, text.indexOf('\n') + 1 || text.length);
        const delim = ext === 'tsv' || (head.match(/\t/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? '\t' : ',';
        const grid = parseDelimited(text.replace(/^﻿/, ''), delim);
        if (grid.length < 2) throw new Error('헤더 행과 데이터 행이 필요합니다');
        const headers = grid[0];
        buildRows(grid.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))));
      }
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : '파일을 읽을 수 없습니다');
    }
  };

  const doImport = async () => {
    if (!rows) return;
    const targets = rows.filter((r) => r.valid);
    setBusy(true);
    setProgress(0);
    let ok = 0;
    const fails: string[] = [];
    for (const r of targets) {
      try {
        await api.post('/projects', {
          code: r.code,
          name: r.name,
          businessTypeId: r.businessTypeId,
          leadDepartmentId: r.leadDepartmentId,
          status: r.status,
          startDate: r.startDate,
          planEndDate: r.planEndDate,
          contractAmount: r.contractAmount,
          budgetAmount: r.budgetAmount,
          goal: r.goal,
        });
        ok++;
      } catch (e) {
        fails.push(`${r.code} ${r.name}: ${e instanceof Error ? e.message : '실패'}`);
      }
      setProgress(ok + fails.length);
    }
    setBusy(false);
    setResult({ ok, fails });
    if (ok > 0) onSaved();
  };

  const downloadTemplate = () => {
    const tpl =
      '﻿코드,프로젝트명,사업유형,주관부서,상태,시작일,마감일,수주금액,실행예산,목표\n' +
      'PRJ-101,신규 프로젝트 예시,,,진행,2026-09-01,2026-12-31,"100,000,000","60,000,000",목표를 적으세요\n';
    const url = URL.createObjectURL(new Blob([tpl], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = '프로젝트_업로드_양식.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = rows?.filter((r) => r.valid).length ?? 0;

  return (
    <Modal open={open} onClose={close} title="프로젝트 업로드" desc="CSV · TSV · JSON 파일로 여러 프로젝트를 한 번에 등록합니다 (엑셀은 CSV로 저장 후 업로드)" wide>
      <div className="space-y-3.5">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            파일 선택
          </button>
          <span className="flex-1 truncate text-sm text-ink-mute">{fileName || '선택된 파일 없음'}</span>
          <button className="btn-ghost text-xs" onClick={downloadTemplate}>
            CSV 양식 받기
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">{error}</div>
        )}

        {rows && !result && (
          <>
            <div className="max-h-72 overflow-auto rounded-lg border border-line">
              <table className="w-full">
                <thead className="sticky top-0 border-b border-line-soft bg-white">
                  <tr>
                    <th className="th">코드</th>
                    <th className="th">프로젝트명</th>
                    <th className="th">사업유형</th>
                    <th className="th">주관부서</th>
                    <th className="th">상태</th>
                    <th className="th">기간</th>
                    <th className="th text-right">수주금액</th>
                    <th className="th">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((r, i) => (
                    <tr key={i} className={r.valid ? '' : 'bg-red-50/60'}>
                      <td className="td font-num text-xs">{r.code}</td>
                      <td className="td text-sm font-medium">{r.name || '—'}</td>
                      <td className="td text-xs text-ink-mute">{r.businessTypeName}</td>
                      <td className="td text-xs text-ink-mute">{r.departmentName}</td>
                      <td className="td text-xs">{r.statusLabel}</td>
                      <td className="td whitespace-nowrap font-num text-xs text-ink-mute">
                        {r.startDate ?? '—'} ~ {r.planEndDate ?? '—'}
                      </td>
                      <td className="td-num text-xs">{num(r.contractAmount)}</td>
                      <td className="td text-[11px] leading-snug text-warn">{r.warnings.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-mute">
              {rows.length}행 중 <b className="text-ink">{validCount}건</b> 등록 가능
              {busy && ` — 등록 중 ${progress}/${validCount}`}
            </p>
          </>
        )}

        {result && (
          <div className="rounded-lg border border-line bg-line-soft/40 px-4 py-3 text-sm">
            <p>
              ✅ <b>{result.ok}건</b> 등록 완료
              {result.fails.length > 0 && <span className="text-neg"> · {result.fails.length}건 실패</span>}
            </p>
            {result.fails.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-neg">
                {result.fails.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={close} disabled={busy}>
            {result ? '닫기' : '취소'}
          </button>
          {!result && (
            <button className="btn-primary" onClick={doImport} disabled={busy || !rows || validCount === 0}>
              {busy ? `등록 중… ${progress}/${validCount}` : `${validCount}건 등록`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
