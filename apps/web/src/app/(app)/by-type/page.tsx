'use client';

import { useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { BreakdownByDimension } from '@/components/BreakdownByDimension';

/** 유형별 — 사업유형(용역/제품/정부사업 …) 하나당 카드 한 장으로 손익 상세를 본다 */
export default function ByTypePage() {
  const f = useFilters();
  const { businessTypes } = useSession();

  // 필터에서 특정 유형을 골랐다면 그 유형만 보여준다
  const items = businessTypes
    .filter((b) => b.isActive && (!f.businessTypeId || b.id === f.businessTypeId))
    .map((b) => ({ id: b.id, name: b.name }));

  return (
    <BreakdownByDimension
      groupBy="businessType"
      title="유형별 손익"
      desc="사업유형별 매출·비용·이익 상세 — 공통비는 배부하지 않습니다"
      compareTitle="유형별 비교"
      items={items}
    />
  );
}
