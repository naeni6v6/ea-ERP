import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import { big, compact } from '../lib/money';
import { colors, ft, numFont, sh } from '../theme';

/**
 * 최근 6개월 매출·영업이익 묶음 막대 — 웹 TrendChart와 같은 시리즈 색.
 * (#dd7a0a 매출 / #2a78d6 영업이익 — 색약 구분 ΔE 27, 대비 3:1 이상 검증 완료)
 * 금액 연산은 BigInt로만 하고, 숫자 변환은 막대 높이 비율 계산에만 쓴다.
 */
const SERIES = { sales: '#dd7a0a', profit: '#2a78d6' } as const;
const PLOT_H = 120;

export interface TrendRow {
  short: string; // "8월"
  sales: string;
  operatingProfit: string;
}

export function TrendBars({ data }: { data: TrendRow[] }) {
  if (!data.length) return null;

  let maxAbs = 1n;
  for (const r of data) {
    for (const v of [big(r.sales), big(r.operatingProfit)]) {
      const a = v < 0n ? -v : v;
      if (a > maxAbs) maxAbs = a;
    }
  }
  const hasNeg = data.some((r) => big(r.sales) < 0n || big(r.operatingProfit) < 0n);
  // 음수가 있으면 위(양수)/아래(음수) 영역을 나눈다 — 최대 절대값 기준 동일 축척
  const posH = hasNeg ? PLOT_H * 0.68 : PLOT_H;
  const negH = hasNeg ? PLOT_H - posH : 0;
  const hOf = (v: bigint) => {
    const a = v < 0n ? -v : v;
    const base = v < 0n ? negH : posH;
    return Math.max(a > 0n ? 2 : 0, Math.round((Number(a) / Number(maxAbs)) * base));
  };
  const last = data.length - 1;

  return (
    <View style={s.wrap}>
      <View style={s.legend}>
        <LegendItem color={SERIES.sales} label="매출" />
        <LegendItem color={SERIES.profit} label="영업이익" />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {data.map((r, i) => {
          const sv = big(r.sales);
          const pv = big(r.operatingProfit);
          return (
            <View key={r.short + i} style={s.month}>
              {/* 최신 달만 값 직접 표기 — 모든 막대에 숫자를 붙이지 않는다 */}
              <View style={{ minHeight: 15 }}>
                {i === last && (
                  <Text style={[s.lastLabel, ft.semibold, numFont]} numberOfLines={1}>
                    {compact(sv)}·{compact(pv)}
                  </Text>
                )}
              </View>
              <View style={[s.posArea, { height: posH }]}>
                <Bar h={sv >= 0n ? hOf(sv) : 0} color={SERIES.sales} />
                <Bar h={pv >= 0n ? hOf(pv) : 0} color={SERIES.profit} />
              </View>
              <View style={s.baseline} />
              {hasNeg && (
                <View style={[s.negArea, { height: negH }]}>
                  <Bar h={sv < 0n ? hOf(sv) : 0} color={SERIES.sales} down />
                  <Bar h={pv < 0n ? hOf(pv) : 0} color={SERIES.profit} down />
                </View>
              )}
              <Text style={[s.monthLabel, i === last && { color: colors.inkMute, ...ft.semibold }]}>{r.short}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Bar({ h, color, down }: { h: number; color: string; down?: boolean }) {
  return (
    <View
      style={[
        s.bar,
        { height: h, backgroundColor: color },
        down ? s.barDown : s.barUp,
        h === 0 && { backgroundColor: 'transparent' },
      ]}
    />
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: colors.inkMute }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    paddingBottom: 10,
    marginTop: 10,
    gap: 8,
    ...sh.card,
  },
  legend: { flexDirection: 'row', gap: 14 },
  month: { flex: 1, alignItems: 'center' },
  lastLabel: { fontSize: 10.5, color: colors.inkMute },
  posArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  negArea: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  baseline: { alignSelf: 'stretch', height: 1, backgroundColor: colors.line },
  bar: { width: 11 },
  barUp: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barDown: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  monthLabel: { fontSize: 11, color: colors.inkFaint, marginTop: 5 },
});
