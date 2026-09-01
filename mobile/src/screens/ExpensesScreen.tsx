import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Text } from '../components/themed';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import {
  useAllCardExpenses,
  useBankTransactions,
  useInvalidateExpenses,
  usePurposes,
  visibleRows,
} from '../api/queries';
import type { BankTransaction, CardExpense, CardExpenseStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { OfflineBanner, useOnline } from '../components/OfflineBanner';
import { PurposeChips } from '../components/PurposeChips';
import { Empty, ErrorView, PrimaryButton, Spinner } from '../components/ui';
import { big, num, won } from '../lib/money';
import { bankMerchantVisual, cardMerchantVisual } from '../lib/merchantIcon';
import { kstTime, kstYmd, shortDateLabel } from '../lib/dates';
import { colors, ft, numFont, sh } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Seg = 'card' | 'account';

/**
 * 지출 탭 — [카드 지출]·[계좌 지출] 세그먼트 (웹 지출 메뉴의 카드/계좌).
 * 기본은 항상 카드. 목록은 토스처럼 날짜 그룹 + 카테고리 아이콘 + 이름/시각 + 금액.
 * 카드 쪽 주축은 승인/미승인 — 필터로 나누고, 용도 입력은 미제출 행을 눌렀을 때만 펼친다.
 * 계좌는 자금 정보라 웹과 동일하게 대표 전용 — 직원에게는 세그먼트 자체가 없다.
 */
export function ExpensesScreen() {
  const { isCeo } = useAuth();
  const nav = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const route = useRoute<RouteProp<MainTabParamList, 'Submit'>>();
  const [seg, setSeg] = useState<Seg>('card');

  // 전체 메뉴에서 '계좌 지출'로 들어올 때만 해당 세그먼트를 연다.
  // 파라미터는 즉시 지워서, 다음에 탭을 그냥 누르면 항상 카드가 먼저 나온다.
  useEffect(() => {
    if (route.params?.seg) {
      setSeg(route.params.seg);
      nav.setParams({ seg: undefined });
    }
  }, [route.params, nav]);

  // 탭을 벗어나면 카드로 되돌린다 — 지출 탭은 언제 열어도 카드 > 계좌 순
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) setSeg('card');
  }, [focused]);

  const showSeg = isCeo;
  const active: Seg = showSeg ? seg : 'card';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {showSeg && (
        <View style={s.segWrap}>
          <View style={s.segTrack}>
            {(
              [
                ['card', '카드 지출'],
                ['account', '계좌 지출'],
              ] as const
            ).map(([key, label]) => {
              const on = active === key;
              return (
                <Pressable key={key} onPress={() => setSeg(key)} style={[s.segBtn, on && s.segBtnOn]}>
                  <Text style={[s.segText, on ? { color: colors.ink, ...ft.bold } : ft.semibold]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      {active === 'card' ? <CardExpensesPage /> : <AccountExpensesPage />}
    </View>
  );
}

// ───────────────────────── 카드 지출 ─────────────────────────

interface FailedItem {
  id: string;
  label: string;
  reason: string;
}

const STATUS_LABEL: Record<CardExpenseStatus, { label: string; color: string }> = {
  PENDING: { label: '미제출', color: colors.warn },
  SUBMITTED: { label: '승인 대기', color: colors.brandDeep },
  CONFIRMED: { label: '승인', color: colors.pos },
  REJECTED: { label: '반려', color: colors.neg },
  EXCLUDED: { label: '제외', color: colors.inkFaint },
};

/** 주축은 승인/미승인 — 미승인 = 미제출·승인 대기·반려 전부 */
type ApprovalFilter = 'all' | 'open' | 'confirmed';
const isOpen = (e: CardExpense) => e.status !== 'CONFIRMED';

/**
 * 전체 카드지출 내역. 승인/미승인 필터가 주축이고,
 * 미제출(PENDING/반려) 행은 눌러서 용도 칩을 펼친 뒤 하단 버튼으로 일괄 제출한다.
 * 제출은 건별 PATCH 반복 — 일부 실패해도 성공 건은 유지, 실패 사유 명시(자동 재시도 없음).
 */
function CardExpensesPage() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const q = useAllCardExpenses();
  const { purposes } = usePurposes();
  const invalidate = useInvalidateExpenses();
  const online = useOnline();

  const [filter, setFilter] = useState<ApprovalFilter>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ ok: number; failed: FailedItem[] } | null>(null);

  const all = useMemo(() => visibleRows(q.data?.rows), [q.data]);
  const openCount = all.filter(isOpen).length;
  const confirmedCount = all.length - openCount;
  const rows = useMemo(
    () => all.filter((e) => (filter === 'all' ? true : filter === 'open' ? isOpen(e) : !isOpen(e))),
    [all, filter],
  );
  const sections = useMemo(() => groupByDay(rows, (r) => r.usedAt), [rows]);
  const editable = (e: CardExpense) => e.status === 'PENDING' || e.status === 'REJECTED';
  const selectedCount = all.filter((r) => editable(r) && sel[r.id]).length;

  const submit = async () => {
    const targets = all.filter((r) => editable(r) && sel[r.id]);
    if (!targets.length || busy) return;
    setBusy(true);
    setResult(null);
    const failed: FailedItem[] = [];
    let ok = 0;
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
    <View style={{ flex: 1 }}>
      <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />

      {/* 승인/미승인 필터 — 이 화면의 주축 */}
      <View style={s.filterRow}>
        {(
          [
            ['all', `전체 ${all.length}`],
            ['open', `미승인 ${openCount}`],
            ['confirmed', `승인 ${confirmedCount}`],
          ] as const
        ).map(([key, label]) => {
          const on = filter === key;
          return (
            <Pressable key={key} onPress={() => setFilter(key)} style={[s.filterChip, on && s.filterChipOn]} hitSlop={4}>
              <Text style={[{ fontSize: 13.5, color: on ? '#fff' : colors.inkMute }, on ? ft.bold : ft.semibold]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
        <Empty>{filter === 'open' ? '미승인 지출이 없습니다 👍' : '카드 지출 내역이 없습니다'}</Empty>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: selectedCount ? 130 : 32, paddingTop: 2 }}
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching && !q.isLoading}
              onRefresh={() => q.refetch()}
              tintColor={colors.brand}
            />
          }
          renderSectionHeader={({ section }) => <Text style={s.dayHeader}>{section.title}</Text>}
          renderItem={({ item }) => (
            <CardExpenseRow
              expense={item}
              expanded={!!expanded[item.id]}
              purpose={sel[item.id] ?? null}
              purposes={purposes}
              onToggle={() =>
                editable(item)
                  ? setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                  : nav.navigate('ExpenseDetail', { expense: item })
              }
              onPick={(p) => setSel((prev) => ({ ...prev, [item.id]: p }))}
              onOpen={() => nav.navigate('ExpenseDetail', { expense: item })}
            />
          )}
        />
      )}

      {selectedCount > 0 && (
        <View style={s.footer}>
          <PrimaryButton
            title={busy ? progress || '제출 중…' : `${selectedCount}건 제출하기`}
            onPress={submit}
            disabled={online === false}
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

function CardExpenseRow({
  expense: e,
  expanded,
  purpose,
  purposes,
  onToggle,
  onPick,
  onOpen,
}: {
  expense: CardExpense;
  expanded: boolean;
  purpose: string | null;
  purposes: string[];
  onToggle: () => void;
  onPick: (p: string) => void;
  onOpen: () => void;
}) {
  const st = STATUS_LABEL[e.status];
  const rejected = e.status === 'REJECTED';
  const name = e.storeName ?? '가맹점 미상';
  const v = cardMerchantVisual(e.storeName);
  return (
    <View>
      <Pressable onPress={onToggle} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.bgSoft }]}>
        <View style={[s.iconCircle, { backgroundColor: v.bg }]}>
          <Ionicons name={v.icon} size={20} color={v.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.rowName, ft.semibold]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[s.rowSub, numFont]}>
            {kstTime(e.usedAt)}
            {purpose ? `  ·  ${purpose}` : e.purposeText ? `  ·  ${e.purposeText}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          {/* 카드지출은 전부 나가는 돈 — 토스처럼 마이너스로 보여준다 */}
          <Text style={[s.rowAmount, ft.bold, numFont]}>-{num(e.amount)}원</Text>
          <Text style={[s.rowStatus, ft.bold, { color: st.color }]}>{st.label}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={s.expandBox}>
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
          <PurposeChips options={purposes} value={purpose} onChange={onPick} />
          <Pressable onPress={onOpen} hitSlop={6} style={{ alignSelf: 'flex-start', paddingVertical: 2 }}>
            <Text style={{ fontSize: 13, color: colors.brandDeep, ...ft.semibold }}>메모 입력·상세 보기 ›</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ───────────────────────── 계좌 지출 (대표 전용) ─────────────────────────

function AccountExpensesPage() {
  const { isCeo } = useAuth();
  const q = useBankTransactions(isCeo);
  const rows = q.data ?? [];
  const sections = useMemo(() => groupByDay(rows, (r) => r.txnAt), [rows]);

  const outSum = rows.filter((t) => t.direction === 'OUT').reduce((a, t) => a + big(t.amount), 0n);
  const inSum = rows.filter((t) => t.direction === 'IN').reduce((a, t) => a + big(t.amount), 0n);

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />
      {q.isLoading ? (
        <Spinner />
      ) : q.isError && !q.data ? (
        <ErrorView
          message={q.error instanceof Error ? q.error.message : '입출금 내역을 불러오지 못했습니다'}
          onRetry={() => q.refetch()}
        />
      ) : !rows.length ? (
        <Empty>입출금 내역이 없습니다</Empty>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32, paddingTop: 2 }}
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching && !q.isLoading}
              onRefresh={() => q.refetch()}
              tintColor={colors.brand}
            />
          }
          ListHeaderComponent={
            <Text style={s.sumLine}>
              최근 {rows.length}건 · 출금 <Text style={{ color: colors.ink, ...ft.semibold }}>{won(outSum)}</Text> · 입금{' '}
              <Text style={{ color: colors.pos, ...ft.semibold }}>{won(inSum)}</Text>
            </Text>
          }
          renderSectionHeader={({ section }) => <Text style={s.dayHeader}>{section.title}</Text>}
          renderItem={({ item }) => <BankTxnRow txn={item} />}
        />
      )}
    </View>
  );
}

function BankTxnRow({ txn: t }: { txn: BankTransaction }) {
  const isIn = t.direction === 'IN';
  const name = t.counterpartyRaw || t.descriptionRaw || (isIn ? '입금' : '출금');
  const v = bankMerchantVisual(name, t.direction);
  return (
    <View style={s.row}>
      <View style={[s.iconCircle, { backgroundColor: v.bg }]}>
        <Ionicons name={v.icon} size={20} color={v.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowName, ft.semibold]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[s.rowSub, numFont]}>{kstTime(t.txnAt)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[s.rowAmount, ft.bold, numFont, isIn && { color: colors.pos }]}>
          {isIn ? '+' : '-'}
          {num(t.amount)}원
        </Text>
        {t.bankAccount && <Text style={s.rowStatus}>{t.bankAccount.alias}</Text>}
      </View>
    </View>
  );
}

// ───────────────────────── 공용 ─────────────────────────

/** 날짜(KST) 그룹 — 최신 날짜가 위 */
function groupByDay<T>(rows: T[], at: (r: T) => string): { title: string; data: T[] }[] {
  const byDay = new Map<string, T[]>();
  for (const r of rows) {
    const key = kstYmd(at(r));
    const arr = byDay.get(key);
    if (arr) arr.push(r);
    else byDay.set(key, [r]);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([ymd, data]) => ({ title: shortDateLabel(ymd), data }));
}

const s = StyleSheet.create({
  segWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  segTrack: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: 12,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnOn: { backgroundColor: colors.card, ...sh.card },
  segText: { fontSize: 14, color: colors.inkFaint },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  filterChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.bgSoft,
  },
  filterChipOn: { backgroundColor: colors.ink },

  dayHeader: {
    fontSize: 13,
    color: colors.inkFaint,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
    ...ft.semibold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minHeight: 62,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { fontSize: 15.5, color: colors.ink },
  rowSub: { fontSize: 12.5, color: colors.inkFaint, marginTop: 2 },
  rowAmount: { fontSize: 15.5, color: colors.ink },
  rowStatus: { fontSize: 12, color: colors.inkFaint },

  expandBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    ...sh.card,
  },
  rejectBox: {
    backgroundColor: colors.negSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  sumLine: { fontSize: 12.5, color: colors.inkFaint, paddingHorizontal: 20, paddingTop: 12 },

  resultBox: {
    margin: 12,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    ...sh.card,
  },
  resultGood: { backgroundColor: colors.posSoft },
  resultBad: { backgroundColor: colors.negSoft },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: colors.bg,
    ...sh.lift,
  },
});
