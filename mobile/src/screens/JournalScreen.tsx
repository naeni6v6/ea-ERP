import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Text } from '../components/themed';
import { Ionicons } from '@expo/vector-icons';
import { useEntryTypes, useJournal } from '../api/queries';
import type { JournalEntry } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { PeriodChips, resolvePeriod, type PeriodKey } from '../components/PeriodChips';
import { Empty, ErrorView, Spinner } from '../components/ui';
import { big, num } from '../lib/money';
import { shortDateLabel } from '../lib/dates';
import { colors, ft, numFont, sh } from '../theme';

/** 거래 1건의 대표 금액 = 차변 합계 (균형 분개라 대변 합계와 같다) — 웹과 동일 */
const entryAmount = (e: JournalEntry): bigint => e.lines.reduce((a, l) => a + big(l.debit), 0n);

/** 라인에서 손익 성격 태그 — 웹 journal/page.tsx plTag와 동일 규칙 */
const plTag = (e: JournalEntry): { label: string; bg: string; fg: string } | null => {
  if (e.lines.some((l) => l.account?.category === 'REVENUE'))
    return { label: '매출', bg: colors.brandSoft, fg: colors.brandDeep };
  const exp = e.lines.find((l) => l.account?.category === 'EXPENSE');
  if (exp)
    return exp.account?.plSection === 'COGS'
      ? { label: '매출원가', bg: colors.warnSoft, fg: colors.warn }
      : { label: '판관비', bg: colors.bgSoft, fg: colors.inkMute };
  return null;
};

/**
 * 거래 — 웹 journal 페이지의 목록을 모바일로 (CEO/ADMIN 전용, 조회 전용).
 * 행을 누르면 분개 라인(계정·차변·대변)이 펼쳐진다. 등록·취소(VOID)는 웹에서 한다.
 */
export function JournalScreen() {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [type, setType] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { from, to } = resolvePeriod(period);

  const types = useEntryTypes(isAdmin);
  const q = useJournal(from, to, type, isAdmin);
  const rows = q.data?.rows ?? [];
  const typeLabel = (t: string) => types.data?.find((x) => x.type === t)?.label ?? t;

  const sections = useMemo(() => {
    const byDay = new Map<string, JournalEntry[]>();
    for (const r of rows) {
      const key = r.entryDate.slice(0, 10);
      const arr = byDay.get(key);
      if (arr) arr.push(r);
      else byDay.set(key, [r]);
    }
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([ymd, data]) => ({ title: shortDateLabel(ymd), data }));
  }, [rows]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />

      <View style={{ padding: 16, paddingBottom: 8, gap: 10 }}>
        <PeriodChips value={period} onChange={setPeriod} />
        {/* 유형 필터 — 접이식 */}
        <Pressable onPress={() => setTypeOpen((v) => !v)} style={[s.typeField, typeOpen && { backgroundColor: colors.brandSoft }]}>
          <Ionicons name="filter-outline" size={14} color={colors.inkMute} />
          <Text style={[{ flex: 1, fontSize: 13.5, color: colors.ink }, ft.semibold]}>
            {type ? typeLabel(type) : '모든 유형'}
          </Text>
          <Text style={[s.count, numFont]}>{q.data ? `${q.data.total}건` : ''}</Text>
          <Ionicons name={typeOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.inkFaint} />
        </Pressable>
        {typeOpen && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {[{ type: '', label: '모든 유형' }, ...(types.data ?? [])].map((t) => {
              const on = type === t.type;
              return (
                <Pressable
                  key={t.type || '_all'}
                  onPress={() => {
                    setType(t.type);
                    setTypeOpen(false);
                  }}
                  style={[s.typeChip, on && { backgroundColor: colors.brandSoft }]}
                >
                  <Text style={[{ fontSize: 12.5, color: on ? colors.brandDeep : colors.inkMute }, on ? ft.bold : ft.semibold]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {q.isLoading ? (
        <Spinner />
      ) : q.isError && !q.data ? (
        <ErrorView
          message={q.error instanceof Error ? q.error.message : '거래를 불러오지 못했습니다'}
          onRetry={() => q.refetch()}
        />
      ) : !rows.length ? (
        <Empty>해당 조건의 거래가 없습니다</Empty>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.brand} />
          }
          renderSectionHeader={({ section }) => <Text style={s.dayHeader}>{section.title}</Text>}
          renderItem={({ item }) => (
            <EntryRow
              entry={item}
              typeLabel={typeLabel(item.type)}
              expanded={!!expanded[item.id]}
              onToggle={() => setExpanded((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
            />
          )}
          ListFooterComponent={
            <Text style={s.foot}>거래 등록·취소(VOID)는 웹 ERP에서 할 수 있어요</Text>
          }
        />
      )}
    </View>
  );
}

function EntryRow({
  entry: e,
  typeLabel,
  expanded,
  onToggle,
}: {
  entry: JournalEntry;
  typeLabel: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tag = plTag(e);
  const voided = e.status === 'VOID';
  const dims = e.lines.find((l) => l.businessType || l.department || l.project);
  const dimText = dims
    ? [dims.businessType?.name, dims.department?.name, dims.project?.name].filter(Boolean).join(' / ')
    : '';
  return (
    <View style={s.entryCard}>
      <Pressable onPress={onToggle} style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.entryNo, numFont]}>#{e.entryNo}</Text>
          <Text style={[s.entryType, ft.semibold]}>{typeLabel}</Text>
          {tag && (
            <View style={[s.tag, { backgroundColor: tag.bg }]}>
              <Text style={[{ fontSize: 10.5, color: tag.fg }, ft.bold]}>{tag.label}</Text>
            </View>
          )}
          {voided && (
            <View style={[s.tag, { backgroundColor: colors.negSoft }]}>
              <Text style={[{ fontSize: 10.5, color: colors.neg }, ft.bold]}>취소됨</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Text style={[s.amount, ft.bold, numFont, voided && s.voidText]}>{num(entryAmount(e))}원</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Text style={[s.memo, voided && s.voidText]} numberOfLines={2}>
            {e.memo || e.partner?.name || '—'}
          </Text>
          <View style={{ flex: 1 }} />
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.inkFaint} style={{ marginTop: 2 }} />
        </View>
        {(!!dimText || !!e.partner?.name) && (
          <Text style={s.dims} numberOfLines={1}>
            {[e.partner?.name, dimText].filter(Boolean).join(' · ')}
          </Text>
        )}
      </Pressable>

      {expanded && (
        <View style={s.lines}>
          {e.lines.map((l) => (
            <View key={l.id} style={s.lineRow}>
              <Text style={s.lineAcct} numberOfLines={1}>
                {l.account ? `${l.account.name}` : l.accountId}
              </Text>
              <Text style={[s.lineNum, numFont]}>{big(l.debit) > 0n ? `차 ${num(l.debit)}` : ''}</Text>
              <Text style={[s.lineNum, numFont, { color: colors.inkMute }]}>
                {big(l.credit) > 0n ? `대 ${num(l.credit)}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  typeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: colors.card,
    ...sh.card,
  },
  count: { fontSize: 12, color: colors.inkFaint },
  typeChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: colors.fill,
  },
  dayHeader: {
    fontSize: 13,
    color: colors.inkFaint,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    ...ft.semibold,
  },
  entryCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 4,
    ...sh.card,
  },
  entryNo: { fontSize: 11, color: colors.inkFaint },
  entryType: { fontSize: 13.5, color: colors.ink },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  amount: { fontSize: 14.5, color: colors.ink },
  memo: { flexShrink: 1, fontSize: 12.5, lineHeight: 18, color: colors.inkMute },
  dims: { fontSize: 11, color: colors.inkFaint },
  voidText: { color: colors.inkFaint, textDecorationLine: 'line-through' },
  lines: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 7,
    gap: 4,
  },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineAcct: { flex: 1, fontSize: 12, color: colors.inkMute },
  lineNum: { fontSize: 12, color: colors.ink, minWidth: 90, textAlign: 'right' },
  foot: { textAlign: 'center', fontSize: 11.5, color: colors.inkFaint, paddingVertical: 14 },
});
