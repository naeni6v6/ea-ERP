/**
 * 데모 데이터 생성 (프로젝트 → 업무 → 거래 → 은행거래 분류 → 유보금/지급예정 → 직원 권한).
 *
 * scripts/e2e.sh 와 같은 시나리오지만 Node에서 fetch로 보낸다.
 * Windows Git Bash에서 e2e.sh를 돌리면 MSYS2가 curl.exe 인수를 ANSI 코드페이지로
 * 변환하면서 한글이 깨져 저장된다. 이 스크립트는 그 경로를 타지 않는다.
 *
 * 사용: node scripts/demo-data.mjs          (DB를 seed 직후 상태에서 실행할 것)
 */

const API = process.env.API_BASE ?? 'http://localhost:4000/api';
const EMAIL = process.env.CEO_EMAIL ?? 'ceo@eacompany.kr';
const PASSWORD = process.env.CEO_PASSWORD ?? 'changeme123!';

let token = '';

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = Array.isArray(json?.message) ? json.message.join(', ') : json?.message;
    throw new Error(`${method} ${path} → ${res.status} ${msg ?? text}`);
  }
  return json;
}

const get = (p) => call('GET', p);
const post = (p, b) => call('POST', p, b);
const patch = (p, b) => call('PATCH', p, b);
const put = (p, b) => call('PUT', p, b);

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());

async function main() {
  token = (await post('/auth/login', { email: EMAIL, password: PASSWORD })).accessToken;
  console.log('login ok');

  const businessTypes = await get('/business-types');
  const departments = await get('/departments');
  const accounts = await get('/accounts');
  const banks = await get('/treasury/bank-accounts');

  const byCode = (rows, code) => rows.find((r) => r.code === code).id;
  const bySystemKey = (key) => accounts.find((a) => a.systemKey === key).id;

  const BUILD = byCode(businessTypes, 'BUILD');
  const DEV = byCode(departments, 'DEV');
  const RESEARCH = byCode(departments, 'RESEARCH');
  const MAIN = banks[0].id;
  const GOV = banks[1].id;

  // 기초잔액
  await patch(`/treasury/bank-accounts/${MAIN}`, { openingBalance: '150000000', openingDate: '2026-01-01' });
  await patch(`/treasury/bank-accounts/${GOV}`, { openingBalance: '50000000', openingDate: '2026-01-01' });

  // 거래처
  const partner = await post('/partners', { name: 'A병원', type: 'CUSTOMER' });
  await post('/partners', { name: 'B소프트', type: 'VENDOR' });

  // 프로젝트 + 업무
  const project = await post('/projects', {
    code: 'P-2026-001',
    name: 'A병원 시스템 구축',
    businessTypeId: BUILD,
    leadDepartmentId: DEV,
    departmentIds: [RESEARCH],
    status: 'ACTIVE',
    startDate: '2026-07-01',
    planEndDate: '2026-12-31',
    contractAmount: '100000000',
    budgetAmount: '60000000',
    goal: '병원 통합 진료 시스템 구축 및 안정화',
  });
  console.log('project', project.code, project.name);

  for (const title of ['요구사항 분석', 'DB 설계', 'API 개발', '프론트 개발', '테스트']) {
    await post(`/projects/${project.id}/tasks`, { title });
  }
  const tasks = await get(`/projects/${project.id}/tasks`);
  await patch(`/tasks/${tasks[0].id}`, { status: 'DONE' });
  await patch(`/tasks/${tasks[1].id}`, { isDone: true });
  await patch(`/tasks/${tasks[2].id}`, { status: 'IN_PROGRESS' });

  const p = await get(`/projects/${project.id}`);
  console.log(`progress: ${p.doneTasks}/${p.totalTasks} = ${p.progress}%`);

  // 거래
  const COGS = bySystemKey('COGS_DEFAULT');
  const dims = { projectId: project.id };

  await post('/journal', {
    type: 'SALES',
    entryDate: today,
    amount: '100000000',
    vatAmount: '10000000',
    partnerId: partner.id,
    memo: '1차 검수 매출',
    dims,
  });
  await post('/journal', {
    type: 'CASH_EXPENSE',
    entryDate: today,
    amount: '40000000',
    vatAmount: '4000000',
    accountId: COGS,
    bankAccountId: MAIN,
    memo: '외주개발비',
    dims,
  });
  await post('/journal', {
    type: 'EXPENSE',
    entryDate: today,
    amount: '5000000',
    memo: '프로젝트 관련 수수료(미지급)',
    dims,
  });
  await post('/journal', {
    type: 'PREPAID',
    entryDate: today,
    amount: '12000000',
    bankAccountId: MAIN,
    memo: '사무실 임대료 1년 선납',
    dims: { departmentId: DEV },
  });
  await post('/journal', {
    type: 'PREPAID_AMORTIZE',
    entryDate: today,
    amount: '1000000',
    memo: '8월 임차료',
    dims: { departmentId: DEV },
  });
  console.log('journal entries created');

  // 유보금 / 지급예정
  const reserve = await post('/treasury/reserves', {
    category: 'INVESTMENT',
    purpose: '건물 매입 준비',
    amount: '50000000',
    reason: '2026년 사옥 확보 계획',
  });
  await post(`/treasury/reserves/${reserve.id}/move`, {
    type: 'RELEASE',
    amount: '10000000',
    reason: '계약금 집행',
  });
  await post('/treasury/planned-payments', {
    kind: 'CONFIRMED',
    title: '8월 급여',
    category: 'PAYROLL',
    amount: '30000000',
    dueDate: '2026-08-25',
    departmentId: DEV,
  });
  await post('/treasury/planned-payments', {
    kind: 'PLANNED',
    title: '장비 구입 계획',
    category: 'PO',
    amount: '20000000',
    dueDate: '2026-10-01',
  });
  console.log('treasury data created');

  // 은행거래 import → 미분류 1건은 남겨 분류 화면을 확인할 수 있게 한다
  const imported = await post('/treasury/bank-transactions/import', {
    bankAccountId: MAIN,
    rows: [
      {
        txnAt: `${today}T10:00:00+09:00`,
        direction: 'IN',
        amount: '110000000',
        counterpartyRaw: 'A병원',
        descriptionRaw: '1차 대금',
        externalId: 'demo-1',
      },
      {
        txnAt: `${today}T14:30:00+09:00`,
        direction: 'OUT',
        amount: '2200000',
        counterpartyRaw: '한국전력',
        descriptionRaw: '8월 공과금 자동이체',
        externalId: 'demo-2',
      },
    ],
  });
  console.log('bank import', imported);

  const unclassified = await get('/treasury/bank-transactions?status=UNCLASSIFIED');
  const incoming = unclassified.find((t) => t.direction === 'IN');
  const receipt = await post('/journal', {
    type: 'RECEIPT_AR',
    entryDate: today,
    amount: '100000000',
    vatAmount: '10000000',
    bankAccountId: MAIN,
    bankTransactionId: incoming.id,
    partnerId: partner.id,
    memo: 'A병원 1차 대금 회수',
    dims,
  });
  console.log('bank txn classified →', receipt.bankClassifications[0].status);
  console.log('남은 미분류 거래 1건 — 웹 [자금 > 은행거래 분류]에서 확인 가능');

  // 직원 계정 + 권한
  const employee = await post('/users', {
    email: 'dev1@eacompany.kr',
    password: 'password123',
    name: '김개발',
    departmentId: DEV,
  });
  await put(`/users/${employee.id}/role-scopes`, [
    { role: 'ADMIN', scopeType: 'DEPARTMENT', departmentId: RESEARCH },
  ]);
  console.log('employee created: dev1@eacompany.kr / password123 (연구팀 ADMIN)');

  const dash = await get('/metrics/dashboard?preset=this_month');
  console.log('\n--- 확인 ---');
  console.log('매출', dash.pnl.sales, '영업이익', dash.pnl.operatingProfit);
  console.log('가용현금', dash.treasury.availableCash);
  console.log('사업별', dash.byBusinessType.map((r) => `${r.name}=${r.sales}`).join(', '));
  console.log('프로젝트', dash.projects.projects.map((r) => r.name).join(', '));
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
