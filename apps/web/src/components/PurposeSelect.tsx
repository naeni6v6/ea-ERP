'use client';

import { useSession } from '@/lib/session';

/**
 * 지출 용도 고정 목록 — 수기 입력 대신 선택. 설정의 코드값(CARD_PURPOSE)으로 관리하고,
 * 코드값이 아직 없으면 아래 기본 목록을 쓴다. 카드 지출·계좌 지출이 같은 목록을 공유한다.
 */
export const DEFAULT_PURPOSES = [
  '식비', '회식비', '업무교통비', '야근교통비', '국내출장비', '국외출장비', '접대비',
  '유류비', '교육훈련비', '도서구입비', '정기구독료', '회의비', '사무용품비', '소모품비',
  'IT솔루션', '서류발급비', '온라인 마케팅', '광고비', '판촉물제작비', '기타비용', '오사용',
  '급여비', '프로젝트비',
];

export function usePurposeOptions() {
  const { codesOf } = useSession();
  const fromCodes = codesOf('CARD_PURPOSE').map((c) => c.label);
  return fromCodes.length ? fromCodes : DEFAULT_PURPOSES;
}

export function PurposeSelect({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const options = usePurposeOptions();
  return (
    <select className={className ?? 'input'} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">용도 선택</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {/* 목록 도입 전에 직접 입력했던 값은 그대로 보이게 유지 */}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}
