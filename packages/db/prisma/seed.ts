import { PrismaClient, AccountCategory, PlSection, DepartmentKind, Role, ScopeType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { id: 'ea-company' },
    update: {},
    create: { id: 'ea-company', name: '주식회사 이에이컴퍼니', timezone: 'Asia/Seoul' },
  });
  const cid = company.id;

  // 사업유형
  const bts = [
    ['OFFLINE', '오프라인 매장'], ['EDU', '교육사업'], ['SERVICE', '용역사업'], ['BUILD', '구축사업'],
    ['GOV', '정부지원사업'], ['DIST', '유통사업'], ['RND', 'R&D 과제수행사업'],
  ];
  for (const [i, [code, name]] of bts.entries()) {
    await prisma.businessType.upsert({
      where: { companyId_code: { companyId: cid, code } },
      update: { name, sortOrder: i },
      create: { companyId: cid, code, name, sortOrder: i },
    });
  }

  // 부서 / 사업장
  const depts: [string, string, DepartmentKind][] = [
    ['LAGOM', '라곰재활운동센터', 'SITE'], ['DAP', 'DAP선수트레이닝센터', 'SITE'],
    ['EDU', '교육팀', 'HQ'], ['RESEARCH', '연구팀', 'HQ'], ['DIST', '유통팀', 'HQ'],
    ['MKT', '마케팅팀', 'HQ'], ['DEV', '개발팀', 'HQ'], ['SALES', '영업팀', 'HQ'], ['HQ', '본사(공통)', 'HQ'],
  ];
  for (const [i, [code, name, kind]] of depts.entries()) {
    await prisma.department.upsert({
      where: { companyId_code: { companyId: cid, code } },
      update: { name, kind, sortOrder: i },
      create: { companyId: cid, code, name, kind, sortOrder: i },
    });
  }

  // 계정과목 (관리회계용 최소 세트)
  type A = [string, string, AccountCategory, PlSection, string?];
  const accounts: A[] = [
    // 자산
    ['1010', '현금', 'ASSET', 'NONE', 'CASH'],
    ['1020', '보통예금', 'ASSET', 'NONE', 'CASH_BANK'],
    ['1100', '매출채권', 'ASSET', 'NONE', 'AR'],
    ['1110', '미수금', 'ASSET', 'NONE', 'OTHER_RECEIVABLE'],
    ['1200', '선급금', 'ASSET', 'NONE', 'ADVANCE_PAID'],
    ['1210', '선급비용', 'ASSET', 'NONE', 'PREPAID'],
    ['1250', '부가세대급금', 'ASSET', 'NONE', 'VAT_IN'],
    ['1300', '재고자산', 'ASSET', 'NONE', 'INVENTORY'],
    ['1500', '장비/비품', 'ASSET', 'NONE', 'EQUIPMENT'],
    ['1510', '차량운반구', 'ASSET', 'NONE', 'VEHICLE'],
    ['1600', '보증금', 'ASSET', 'NONE', 'DEPOSIT'],
    // 부채
    ['2010', '매입채무', 'LIABILITY', 'NONE', 'TRADE_PAYABLE'],
    ['2020', '미지급금', 'LIABILITY', 'NONE', 'AP'],
    ['2030', '미지급비용', 'LIABILITY', 'NONE', 'ACCRUED_EXPENSE'],
    ['2100', '예수금', 'LIABILITY', 'NONE', 'WITHHOLDING'],
    ['2110', '부가세예수금', 'LIABILITY', 'NONE', 'VAT_OUT'],
    ['2200', '계약부채(선수금)', 'LIABILITY', 'NONE', 'CONTRACT_LIAB'],
    ['2300', '단기차입금', 'LIABILITY', 'NONE', 'SHORT_LOAN'],
    ['2310', '장기차입금', 'LIABILITY', 'NONE', 'LONG_LOAN'],
    // 자본
    ['3010', '자본금', 'EQUITY', 'NONE', 'CAPITAL'],
    ['3100', '이익잉여금', 'EQUITY', 'NONE', 'RETAINED_EARNINGS'],
    // 수익
    ['4010', '제품/상품매출', 'REVENUE', 'SALES', 'SALES_DEFAULT'],
    ['4020', '용역매출', 'REVENUE', 'SALES'],
    ['4030', '교육매출', 'REVENUE', 'SALES'],
    ['4040', '회원권/PT매출', 'REVENUE', 'SALES'],
    ['4050', '정부지원금수익', 'REVENUE', 'SALES'],
    ['4900', '잡이익/이자수익', 'REVENUE', 'NON_OP_INCOME'],
    // 매출원가
    ['5010', '상품매입원가', 'EXPENSE', 'COGS'],
    ['5020', '외주용역비(원가)', 'EXPENSE', 'COGS', 'COGS_DEFAULT'],
    ['5030', '재료비', 'EXPENSE', 'COGS'],
    ['5040', '프로젝트 직접인건비', 'EXPENSE', 'COGS'],
    // 판관비
    ['6010', '급여', 'EXPENSE', 'SGA'],
    ['6020', '4대보험/복리후생비', 'EXPENSE', 'SGA'],
    ['6030', '임차료', 'EXPENSE', 'SGA', 'RENT'],
    ['6040', '광고선전비', 'EXPENSE', 'SGA'],
    ['6050', '지급수수료', 'EXPENSE', 'SGA', 'SGA_DEFAULT'],
    ['6060', '소모품비', 'EXPENSE', 'SGA'],
    ['6070', '통신비/소프트웨어', 'EXPENSE', 'SGA'],
    ['6080', '여비교통비', 'EXPENSE', 'SGA'],
    ['6090', '접대비', 'EXPENSE', 'SGA'],
    ['6100', '감가상각비', 'EXPENSE', 'SGA'],
    ['6110', '교육훈련비', 'EXPENSE', 'SGA'],
    ['6900', '이자비용', 'EXPENSE', 'NON_OP_EXPENSE'],
    ['6910', '잡손실', 'EXPENSE', 'NON_OP_EXPENSE'],
    ['7010', '법인세비용', 'EXPENSE', 'INCOME_TAX'],
  ];
  for (const [i, [code, name, category, plSection, systemKey]] of accounts.entries()) {
    await prisma.account.upsert({
      where: { companyId_code: { companyId: cid, code } },
      update: { name, category, plSection, systemKey: systemKey ?? null, sortOrder: i },
      create: { companyId: cid, code, name, category, plSection, systemKey: systemKey ?? null, sortOrder: i },
    });
  }

  // 코드값
  const codes: [string, string, string][] = [
    ['PROJECT_STATUS', 'PLANNED', '준비'], ['PROJECT_STATUS', 'ACTIVE', '진행'], ['PROJECT_STATUS', 'ON_HOLD', '보류'],
    ['PROJECT_STATUS', 'DONE', '완료'], ['PROJECT_STATUS', 'CANCELLED', '취소'],
    ['TASK_STATUS', 'TODO', '할 일'], ['TASK_STATUS', 'IN_PROGRESS', '진행중'], ['TASK_STATUS', 'REVIEW', '검토중'],
    ['TASK_STATUS', 'DONE', '완료'], ['TASK_STATUS', 'ON_HOLD', '보류'],
    ['RESERVE_CATEGORY', 'RISK', '리스크 대응'], ['RESERVE_CATEGORY', 'INVESTMENT', '투자준비'], ['RESERVE_CATEGORY', 'STRATEGIC', '전략예비'],
    ['PLANNED_CATEGORY', 'PAYROLL', '급여'], ['PLANNED_CATEGORY', 'TAX', '세금'], ['PLANNED_CATEGORY', 'RENT', '임대료'],
    ['PLANNED_CATEGORY', 'PO', '발주대금'], ['PLANNED_CATEGORY', 'OUTSOURCE', '외주비'], ['PLANNED_CATEGORY', 'INSURANCE', '보험료'], ['PLANNED_CATEGORY', 'FIXED', '기타 고정비'],
  ];
  for (const [i, [kind, code, label]] of codes.entries()) {
    await prisma.codeValue.upsert({
      where: { companyId_kind_code: { companyId: cid, kind, code } },
      update: { label, sortOrder: i },
      create: { companyId: cid, kind, code, label, sortOrder: i },
    });
  }

  // 계좌 (기초잔액은 0 — 실제 값은 설정 화면/API에서 입력)
  const lagom = await prisma.department.findUnique({ where: { companyId_code: { companyId: cid, code: 'LAGOM' } } });
  const dap = await prisma.department.findUnique({ where: { companyId_code: { companyId: cid, code: 'DAP' } } });
  const today = new Date();
  const banks = [
    ['국민은행', '운영계좌', 'OPERATING', false, null],
    ['신한은행', '정부사업 계좌', 'GOV_PROJECT', true, null],
    ['기업은행', 'R&D 계좌', 'RND', true, null],
    ['국민은행', '라곰 운영계좌', 'SITE', false, lagom?.id],
    ['국민은행', 'DAP 운영계좌', 'SITE', false, dap?.id],
  ] as const;
  const existing = await prisma.bankAccount.count({ where: { companyId: cid } });
  if (existing === 0) {
    for (const [bankName, alias, purpose, isRestricted, departmentId] of banks) {
      await prisma.bankAccount.create({
        data: { companyId: cid, bankName, alias, purpose, isRestricted, departmentId: departmentId ?? null, openingBalance: 0n, openingDate: today },
      });
    }
  }

  // CEO 계정
  const ceoEmail = 'ceo@eacompany.kr';
  const ceo = await prisma.user.upsert({
    where: { email: ceoEmail },
    update: {},
    create: {
      companyId: cid, email: ceoEmail, name: '대표', passwordHash: await bcrypt.hash('changeme123!', 10),
    },
  });
  const hasScope = await prisma.userRoleScope.count({ where: { userId: ceo.id } });
  if (!hasScope) {
    await prisma.userRoleScope.create({ data: { userId: ceo.id, role: Role.CEO, scopeType: ScopeType.COMPANY } });
  }

  console.log('Seed done. CEO login: ceo@eacompany.kr / changeme123!');
}

main().finally(() => prisma.$disconnect());
