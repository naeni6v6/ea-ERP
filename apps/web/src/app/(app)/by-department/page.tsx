'use client';

import { useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { BreakdownByDimension } from '@/components/BreakdownByDimension';

/** 사업부서별 — 부서(본사/라곰/DAP …) 하나당 카드 한 장으로 손익 상세를 본다 */
export default function ByDepartmentPage() {
  const f = useFilters();
  const { departments } = useSession();

  // 필터에서 특정 부서를 골랐다면 그 부서만 보여준다
  const items = departments
    .filter((d) => d.isActive && (!f.departmentId || d.id === f.departmentId))
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <BreakdownByDimension
      groupBy="department"
      title="사업부서별 손익"
      desc="부서별 매출·비용·이익 상세 — 공통비는 배부하지 않습니다"
      compareTitle="부서별 비교"
      items={items}
      variant="accent"
    />
  );
}
