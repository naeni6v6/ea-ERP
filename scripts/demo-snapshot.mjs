/**
 * 데모 스냅샷 캡처 — 실행 중인 API에서 GET 응답을 모아
 * apps/web/public/demo-fixtures.json (+ 프로젝트 id 목록)으로 저장한다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const API = 'http://localhost:4000/api';
const EMAIL = 'ceo@eacompany.kr';
const PASSWORD = 'changeme123!';
const OUT = 'C:/Users/user/Desktop/ea-erp/apps/web/public/demo-fixtures.json';
const IDS_OUT = 'C:/Users/user/Desktop/ea-erp/apps/web/src/lib/demo-project-ids.json';

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
}).then((r) => r.json());
const token = login.accessToken;
if (!token) throw new Error('로그인 실패: ' + JSON.stringify(login).slice(0, 200));

const fixtures = {};
const sortedKey = (pathname, params) => {
  if (!params) return pathname;
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)])
    .sort(([a], [b]) => (a < b ? -1 : 1));
  if (!entries.length) return pathname;
  return `${pathname}?${entries.map(([k, v]) => `${k}=${v}`).join('&')}`;
};

let ok = 0;
let fail = 0;
async function grab(pathname, params, aliasPathnameOnly = false) {
  const qs = params
    ? '?' + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(`${API}${pathname}${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    fail++;
    console.log('FAIL', pathname, qs, res.status);
    return null;
  }
  const body = await res.json().catch(() => null);
  fixtures[sortedKey(pathname, params)] = body;
  if (aliasPathnameOnly && params) fixtures[pathname] = fixtures[pathname] ?? body;
  ok++;
  return body;
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const [Y, M] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
const ymOf = (offset) => {
  const t = Y * 12 + (M - 1) + offset;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
const lastDay = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
const thisYm = ymOf(0);

// ── 공통 마스터 ──
for (const p of ['/auth/me', '/business-types', '/departments', '/code-values', '/users', '/accounts', '/partners', '/journal/entry-types', '/notices/today', '/cards', '/cards/sync-gowid/status']) await grab(p);

// ── 대시보드 / 손익 ──
await grab('/metrics/dashboard');
await grab('/metrics/dashboard', { preset: 'this_month' }, true);
await grab('/metrics/treasury');
await grab('/metrics/projects/finance');
await grab('/metrics/pnl');
await grab('/metrics/pnl', { preset: 'this_month' }, true);
for (const g of ['businessType', 'department', 'project', 'account']) {
  await grab('/metrics/pnl/breakdown', { groupBy: g });
  await grab('/metrics/pnl/breakdown', { groupBy: g, preset: 'this_month' });
}
// 월별 추이 — 최근 6개월 (preset=custom)
for (let i = 0; i < 6; i++) {
  const ym = ymOf(-i);
  await grab('/metrics/pnl', { preset: 'custom', from: `${ym}-01`, to: i === 0 ? today : `${ym}-${String(lastDay(ym)).padStart(2, '0')}` });
}

// ── 프로젝트 ──
const projects = await grab('/projects');
const ids = (projects ?? []).map((p) => p.id);
for (const id of ids) {
  await grab(`/projects/${id}`);
  await grab(`/projects/${id}/tasks`);
}

// ── 내 업무 / 업무 일지 ──
await grab('/tasks/my');
await grab('/tasks/my', { scope: 'all' });
await grab('/worklogs', { date: today }, true);
await grab('/worklogs', { date: today, scope: 'all' });
await grab('/worklogs', { from: `${thisYm}-01`, to: `${thisYm}-${String(lastDay(thisYm)).padStart(2, '0')}` });
await grab('/worklogs', { from: `${thisYm}-01`, to: `${thisYm}-${String(lastDay(thisYm)).padStart(2, '0')}`, scope: 'all' });

// ── 자금 ──
await grab('/treasury/bank-accounts');
await grab('/treasury/reserves');
await grab('/treasury/bank-transactions');
await grab('/treasury/bank-transactions', { direction: 'OUT', take: 200 });
await grab('/treasury/bank-transactions', { direction: 'IN', take: 200 });
for (const s of ['UNCLASSIFIED', 'CLASSIFIED', 'IGNORED']) await grab('/treasury/bank-transactions', { status: s, take: 200 });
for (const off of [-5, -4, -3, -2, -1, 0, 1]) {
  const ym = ymOf(off);
  const ld = String(lastDay(ym)).padStart(2, '0');
  await grab('/treasury/bank-transactions', { from: `${ym}-01`, to: `${ym}-${ld}`, take: 500 });
  await grab('/treasury/planned-payments', { from: `${ym}-01`, to: `${ym}-${ld}` });
  await grab('/treasury/planned-incomes', { from: `${ym}-01`, to: `${ym}-${ld}` });
}
await grab('/treasury/planned-payments');
await grab('/treasury/planned-incomes');
// 지출 대시보드 — 6개월 범위 조회
await grab('/treasury/bank-transactions', { from: `${ymOf(-5)}-01`, to: today, direction: 'OUT', take: 1000 });

// ── 카드지출 / 거래 ──
await grab('/cards/expenses');
await grab('/cards/expenses', { status: 'SUBMITTED', take: 8 });
await grab('/cards/expenses', { from: `${ymOf(-5)}-01`, to: today, take: 1000 });
await grab('/cards/expenses', { from: `${thisYm}-01`, to: `${thisYm}-${String(lastDay(thisYm)).padStart(2, '0')}` });
// 자금 화면의 항목별 한도 — 이번 달 지출이 없으면 지난달로 폴백하므로 지난달 범위도 담는다
await grab('/cards/expenses', { from: `${ymOf(-1)}-01`, to: `${ymOf(-1)}-${String(lastDay(ymOf(-1))).padStart(2, '0')}` });
// 자금 탭의 팝빌 패널 상태
await grab('/treasury/popbill/status');
await grab('/journal');
await grab('/journal', { from: '2026-01-01', to: '2026-12-31', take: 500 });

mkdirSync('C:/Users/user/Desktop/ea-erp/apps/web/public', { recursive: true });
writeFileSync(OUT, JSON.stringify(fixtures), 'utf8');
writeFileSync(IDS_OUT, JSON.stringify(ids, null, 2), 'utf8');
console.log(`done: ok=${ok} fail=${fail} keys=${Object.keys(fixtures).length} ids=${ids.length}`);
