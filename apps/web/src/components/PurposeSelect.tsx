'use client';

import { useMemo } from 'react';
import { useSession } from '@/lib/session';
import { DownSelect } from '@/components/DownSelect';
import type { Account } from '@/lib/types';

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
  const purposes = usePurposeOptions();
  const options = useMemo(() => {
    const list = [{ value: '', label: '용도 선택' }, ...purposes.map((p) => ({ value: p, label: p }))];
    // 목록 도입 전에 직접 입력했던 값은 그대로 보이게 유지
    if (value && !purposes.includes(value)) list.push({ value, label: value });
    return list;
  }, [purposes, value]);

  return (
    <DownSelect
      value={value}
      options={options}
      onChange={onChange}
      placeholder="용도 선택"
      className={className}
      disabled={disabled}
      ariaLabel="용도"
    />
  );
}

/** 비용 계정과목 선택 — 카드 지출·계좌 지출에서 같은 모양으로 쓴다 */
export function AccountSelect({
  value,
  accounts,
  onChange,
  className,
  disabled,
  emptyLabel = '자동',
}: {
  value: string;
  accounts: Account[];
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
  /** 미지정일 때 보여줄 말 — 카드는 '자동'(시스템 기본 계정), 계좌는 '계정과목 선택' */
  emptyLabel?: string;
}) {
  const options = useMemo(
    () => [{ value: '', label: emptyLabel }, ...accounts.map((a) => ({ value: a.id, label: a.name }))],
    [accounts, emptyLabel],
  );
  return (
    <DownSelect
      value={value}
      options={options}
      onChange={onChange}
      placeholder={emptyLabel}
      className={className}
      disabled={disabled}
      ariaLabel="계정과목"
    />
  );
}
