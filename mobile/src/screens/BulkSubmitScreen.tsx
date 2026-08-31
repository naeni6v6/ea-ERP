import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Text } from '../components/themed';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { useInvalidateExpenses, usePurposes, useUnsubmitted, visibleRows } from '../api/queries';
import type { CardExpense } from '../api/types';
import { OfflineBanner, useOnline } from '../components/OfflineBanner';
import { PurposeChips } from '../components/PurposeChips';
import { Empty, ErrorView, PrimaryButton, Spinner } from '../components/ui';
import { won } from '../lib/money';
import { dateLabel, kstTime, kstYmd } from '../lib/dates';
import { colors, ft, numFont } from '../theme';
import type { RootStackParamList } from '../navigation/types';

interface FailedItem {
  id: string;
  label: string;
  reason: string;
}

/**
 * 간편 일괄 제출 — 핵심 화면.
 * 미제출(PENDING+반려)을 날짜별로 묶고, 행마다 용도 칩을 인라인으로 고른 뒤 한 번에 제출한다.
 * 제출은 건별 PATCH 반복 — 일부 실패해도 성공한 건은 유지되고, 실패 건수·사유를 명확히 보여준다.
 */
export function BulkSubmitScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const q = useUnsubmitted();
  const { purposes } = usePurposes();
  const invalidate = useInvalidateExpenses();
  const online = useOnline();

  const [sel, setSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ ok: number; failed: FailedItem[] } | null>(null);

  const rows = useMemo(() => visibleRows(q.data?.rows), [q.data]);
  const sections = useMemo(() => {
    const byDay = new Map<string, CardExpense[]>();
    for (const r of rows) {
      const key = kstYmd(r.usedAt);
      const arr = byDay.get(key);
      if (arr) arr.push(r);
      else byDay.set(key, [r]);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([ymd, data]) => ({ title: dateLabel(ymd), data }));
  }, [rows]);

  const selectedCount = rows.filter((r) => sel[r.id]).length;

  const submit = async () => {
    const targets = rows.filter((r) => sel[r.id]);
    if (!targets.length || busy) return;
    setBusy(true);
    setResult(null);
    const failed: FailedItem[] = [];
    let ok = 0;
    // 순차 호출 — 쓰기는 자동 재시도하지 않는다(중복 제출 위험). 실패 건은 사용자가 다시 누른다.
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setProgress(`${i + 1}/${targets.length}건 제출 중…`);
      try {
        await api.patch(`/cards/expenses/${t.id}/purpose`, { purposeText: sel[t.id] });
        ok += 1;
        setSel((prev) => {
          const next = { ...prev };
          delete next[t.id];
          return next;
        });
      } catch (e) {
        failed.push({
          id: t.id,
          label: `${kstYmd(t.usedAt).slice(5).replace('-', '/')} ${t.storeName ?? '가맹점 미상'} ${won(t.amount)}`,
          reason: e instanceof Error ? e.message : '알 수 없는 오류',
        });
      }
    }
    setProgress('');
    setBusy(false);
    setResult({ ok, failed });
    await invalidate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />

      {result && (
        <View style={[s.resultBox, result.failed.length ? s.resultBad : s.resultGood]}>
          <Text style={{ ...ft.bold, color: result.failed.length ? colors.neg : colors.pos, fontSize: 14 }}>
            {result.ok}건 제출 완료
            {result.failed.length ? ` · ${result.failed.length}건 실패 — 저장되지 않았습니다` : ''}
          </Text>
          {result.failed.map((f) => (
            <Text key={f.id} style={{ color: colors.inkMute, fontSize: 13, lineHeight: 19 }}>
              · {f.label} — {f.reason}
            </Text>
          ))}
          {!!result.failed.length && (
            <Text style={{ color: colors.inkFaint, fontSize: 12 }}>
              실패한 건은 용도 선택이 그대로 남아 있습니다. 다시 제출해주세요.
            </Text>
          )}
          <Pressable onPress={() => setResult(null)} hitSlop={8} style={{ alignSelf: 'flex-end' }}>
            <Text style={{ color: colors.inkFaint, fontSize: 13 }}>닫기</Text>
          </Pressable>
        </View>
      )}

      {q.isLoading ? (
        <Spinner />
      ) : q.isError && !q.data ? (
        <ErrorView
          message={q.error instanceof Error ? q.error.message : '목록을 불러오지 못했습니다'}
          onRetry={() => q.refetch()}
        />
      ) : !rows.length ? (
        <Empty>제출할 지출이 없습니다. 모두 처리하셨어요 👍</Empty>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching && !q.isLoading}
              onRefresh={() => q.refetch()}
              tintColor={colors.brand}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={s.dayHeader}>
              <Text style={s.dayHeaderText}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ExpenseRow
              expense={item}
              purpose={sel[item.id] ?? null}
              purposes={purposes}
              onPick={(p) => setSel((prev) => ({ ...prev, [item.id]: p }))}
              onOpen={() => nav.navigate('ExpenseDetail', { expense: item })}
            />
          )}
        />
      )}

      {rows.length > 0 && (
        <View style={s.footer}>
          <PrimaryButton
            title={busy ? progress || '제출 중…' : selectedCount ? `${selectedCount}건 제출하기` : '용도를 선택해주세요'}
            onPress={submit}
            disabled={!selectedCount || online === false}
            busy={busy}
          />
          {online === false && (
            <Text style={{ color: colors.neg, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
              오프라인 상태에서는 제출할 수 없습니다
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function ExpenseRow({
  expense: e,
  purpose,
  purposes,
  onPick,
  onOpen,
}: {
  expense: CardExpense;
  purpose: string | null;
  purposes: string[];
  onPick: (p: string) => void;
  onOpen: () => void;
}) {
  const rejected = e.status === 'REJECTED';
  return (
    <View style={[s.row, rejected && s.rowRejected]}>
      <Pressable onPress={onOpen} hitSlop={4}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[s.time, numFont]}>{kstTime(e.usedAt)}</Text>
          <Text style={s.store} numberOfLines={1}>
            {e.storeName ?? '가맹점 미상'}
          </Text>
          <Text style={[s.amount, numFont]}>{won(e.amount)}</Text>
        </View>
        {rejected && (
          <View style={s.rejectBox}>
            <Text style={{ color: colors.neg, fontSize: 13, ...ft.bold }}>
              반려됨{e.rejectReason ? ` · ${e.rejectReason}` : ''}
            </Text>
            <Text style={{ color: colors.inkMute, fontSize: 12, marginTop: 1 }}>
              용도를 다시 골라 재제출해주세요
              {e.purposeText ? ` (기존: ${e.purposeText})` : ''}
            </Text>
          </View>
        )}
      </Pressable>
      <View style={{ marginTop: 8 }}>
        <PurposeChips options={purposes} value={purpose} onChange={onPick} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dayHeader: {
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dayHeaderText: { fontSize: 13, ...ft.bold, color: colors.inkMute },
  row: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowRejected: { backgroundColor: '#fffafa' },
  time: { fontSize: 13, color: colors.inkFaint },
  store: { flex: 1, fontSize: 15, color: colors.ink, ...ft.semibold },
  amount: { fontSize: 15, color: colors.ink, ...ft.bold },
  rejectBox: {
    marginTop: 6,
    backgroundColor: colors.negSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  resultBox: {
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  resultGood: { backgroundColor: colors.posSoft, borderColor: '#bcdfcc' },
  resultBad: { backgroundColor: colors.negSoft, borderColor: '#f0c4bc' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
