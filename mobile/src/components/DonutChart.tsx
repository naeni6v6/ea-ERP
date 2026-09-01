import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, FeDropShadow, Filter, G } from 'react-native-svg';
import { Text } from './themed';
import { big, type Money } from '../lib/money';
import { categorySoftColor, colors, ft, numFont } from '../theme';

export interface DonutSlice {
  label: string;
  value: Money;
}

const R = 62;
const SW = 22;
/** 링 안쪽 지름 — 가운데 글자는 이 폭 안에 들어가야 조각과 겹치지 않는다 */
const INNER = 2 * (R - SW / 2);

/** 한글은 약 1em, 숫자·기호는 약 0.55em 폭 (웹 charts.tsx와 동일 규칙) */
const emWidth = (s: string) =>
  [...s].reduce((w, ch) => w + (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(ch) ? 1 : 0.55), 0);

/** 글자 수가 아니라 실제 폭으로 크기를 정한다 — 링 안쪽을 넘지 않게 */
const fitSize = (s: string, max: number, ratio: number) =>
  Math.min(max, Math.max(9, (INNER * ratio) / Math.max(emWidth(s), 0.1)));

/**
 * 구성비 도넛 — 웹 charts.tsx DonutChart와 같은 규격.
 * 반지름 62 / 두께 22 / 조각 사이 3 간격, 조각 색은 연한 톤(categorySoftColor),
 * 링 아래로 부드러운 그림자(색 위가 아니라 뒤로만 깔린다).
 * 금액은 BigInt로 합산하고, 숫자 변환은 각도 계산에만 쓴다.
 */
export function DonutChart({
  slices,
  centerTop,
  centerBottom,
  size = 150,
}: {
  slices: DonutSlice[];
  centerTop: string;
  centerBottom?: string;
  size?: number;
}) {
  const vals = slices.map((s) => {
    const v = big(s.value);
    return v > 0n ? Number(v) : 0;
  });
  const total = vals.reduce((a, v) => a + v, 0);
  const C = 2 * Math.PI * R;
  const GAP = total > 0 && vals.filter((v) => v > 0).length > 1 ? 3 : 0;

  let acc = 0;
  const arcs = vals.map((v, i) => {
    const frac = total > 0 ? v / total : 0;
    const len = Math.max(0, frac * C - GAP);
    const arc = { len, offset: acc, color: categorySoftColor(i), on: v > 0 };
    acc += frac * C;
    return arc;
  });

  // viewBox(176) 기준으로 계산한 크기를 실제 픽셀로 환산한다
  const px = size / 176;
  const topSize = fitSize(centerTop, 20, 0.72) * px;
  const bottomSize = fitSize(centerBottom ?? '', 10.5, 0.74) * px;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 176 176">
        <Defs>
          <Filter id="donutShadow" x="-25%" y="-25%" width="150%" height="150%">
            <FeDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#1c1c1e" floodOpacity="0.22" />
          </Filter>
        </Defs>
        {/* 12시 방향에서 시계 방향으로 그린다 */}
        <G rotation={-90} originX={88} originY={88}>
          <Circle cx={88} cy={88} r={R} stroke={colors.bgSoft} strokeWidth={SW} fill="none" />
          <G filter="url(#donutShadow)">
            {arcs.map((a, i) =>
              a.on ? (
                <Circle
                  key={i}
                  cx={88}
                  cy={88}
                  r={R}
                  stroke={a.color}
                  strokeWidth={SW}
                  fill="none"
                  strokeDasharray={`${a.len} ${C - a.len}`}
                  strokeDashoffset={-a.offset}
                  strokeLinecap="butt"
                />
              ) : null,
            )}
          </G>
        </G>
      </Svg>
      {/* 가운데 글자 — SVG 텍스트 대신 겹쳐 올려 Pretendard를 그대로 쓴다 */}
      <View style={{ position: 'absolute', alignItems: 'center', width: INNER * px }}>
        <Text style={[{ fontSize: topSize, color: colors.ink }, ft.extrabold, numFont]} numberOfLines={1}>
          {centerTop}
        </Text>
        {!!centerBottom && (
          <Text
            style={[{ fontSize: bottomSize, color: colors.inkFaint, marginTop: 2 }, numFont]}
            numberOfLines={1}
          >
            {centerBottom}
          </Text>
        )}
      </View>
    </View>
  );
}
