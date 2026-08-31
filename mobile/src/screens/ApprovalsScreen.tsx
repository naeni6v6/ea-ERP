import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/themed';
import { api } from '../api/client';
import { useInvalidateExpenses, useSubmitted, visibleRows } from '../api/queries';
import type { CardExpense, ConfirmBulkResult } from '../api/types';
import { OfflineBanner, useOnline } from '../components/OfflineBanner';
import { Empty, ErrorView, PrimaryButton, Spinner } from '../components/ui';
import { won } from '../lib/money';
import { dateLabel, kstTime, kstYmd } from '../lib/dates';
import { colors, ft, numFont } from '../theme';

/** 승인함 (CEO 전용) — 승인 대기 목록에서 건별·일괄 승인과 반려를 처리한다 */
export function ApprovalsScreen() {
  const q = useSubmitted(true);
  const invalidate = useInvalidateExpenses();
  const online = useOnline();

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<CardExpense | null>(null);

  const rows = useMemo(() => visibleRows(q.data?.rows), [q.data]);
  const selectedIds = rows.filter((r) => checked[r.id]).map((r) => r.id);
  const allChecked = rows.length > 0 && selectedIds.length === rows.length;

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

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다');
    } finally {
      setBusy(false);
      await invalidate();
    }
  };

  const confirmBulk = () =>
    run(async () => {
      const r = await api.post<ConfirmBulkResult>('/cards/expenses/confirm-bulk', { ids: selectedIds });
      setChecked({});
      setNotice(
        `${r.confirmed}건 승인 완료${r.skipped ? ` · ${r.skipped}건 건너뜀` : ''}${
          r.errors.length ? `\n${r.errors.join('\n')}` : ''
        }`,
      );
    });

  const confirmOne = (e: CardExpense) =>
    run(async () => {
      await api.post(`/cards/expenses/${e.id}/confirm`);
      setNotice(`${e.storeName ?? '지출'} ${won(e.amount)} 승인 완료`);
    });

  const reject = (e: CardExpense, reason: string) =>
    run(async () => {
      await api.post(`/cards/expenses/${e.id}/reject`, { reason });
      setNotice(`${e.storeName ?? '지출'} ${won(e.amount)} 반려 처리`);
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />

      {!!notice && (
        <Banner tone="good" onClose={() => setNotice('')}>
          {notice}
        </Banner>
      )}
      {!!error && (
        <Banner tone="bad" onClose={() => setError('')}>
          {error}
        </Banner>
      )}

      {rows.length > 0 && (
        <View style={s.toolbar}>
          <Pressable
            onPress={() => setChecked(allChecked ? {} : Object.fromEntries(rows.map((r) => [r.id, true])))}
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: colors.inkMute, ...ft.semibold }}>{allChecked ? '전체 해제' : '전체 선택'}</Text>
          </Pressable>
          <Text style={{ color: colors.inkFaint, fontSize: 13 }}>승인 대기 {rows.length}건</Text>
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
        <Empty>승인 대기 중인 지출이 없습니다</Empty>
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
            <ApprovalRow
              expense={item}
              checked={!!checked[item.id]}
              onToggle={() => setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
              onConfirm={() => confirmOne(item)}
              onReject={() => setRejecting(item)}
              disabled={busy || online === false}
            />
          )}
        />
      )}

      {selectedIds.length > 0 && (
        <View style={s.footer}>
          <PrimaryButton
            title={`${selectedIds.length}건 일괄 승인`}
            onPress={confirmBulk}
            busy={busy}
            disabled={online === false}
          />
        </View>
      )}

      <RejectModal
        expense={rejecting}
        onClose={() => setRejecting(null)}
        onSubmit={(reason) => {
          const target = rejecting;
          setRejecting(null);
          if (target) reject(target, reason);
        }}
      />
    </View>
  );
}

function Banner({
  tone,
  children,
  onClose,
}: {
  tone: 'good' | 'bad';
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <View style={[s.banner, tone === 'good' ? s.bannerGood : s.bannerBad]}>
      <Text style={{ flex: 1, color: tone === 'good' ? colors.pos : colors.neg, fontSize: 13, lineHeight: 19 }}>
        {children}
      </Text>
      <Pressable onPress={onClose} hitSlop={8}>
        <Text style={{ color: colors.inkFaint, fontSize: 13 }}>닫기</Text>
      </Pressable>
    </View>
  );
}

function ApprovalRow({
  expense: e,
  checked,
  onToggle,
  onConfirm,
  onReject,
  disabled,
}: {
  expense: CardExpense;
  checked: boolean;
  onToggle: () => void;
  onConfirm: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  return (
    <View style={s.row}>
      <Pressable onPress={onToggle} style={s.checkboxWrap} hitSlop={8}>
        <View style={[s.checkbox, checked && s.checkboxOn]}>
          {checked && <Text style={{ color: '#fff', fontSize: 13, ...ft.extrabold }}>✓</Text>}
        </View>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.store} numberOfLines={1}>
            {e.storeName ?? '가맹점 미상'}
          </Text>
          <Text style={[s.amount, numFont]}>{won(e.amount)}</Text>
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {kstTime(e.usedAt)} · {e.card?.holder?.name ?? '소지자 미상'} · {e.card?.name ?? ''}
        </Text>
        <Text style={s.purpose} numberOfLines={2}>
          {e.purposeText ?? '용도 미입력'}
          {e.memo ? ` — ${e.memo}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable onPress={onConfirm} disabled={disabled} style={[s.miniBtn, s.miniConfirm, disabled && { opacity: 0.5 }]}>
            <Text style={{ color: colors.pos, ...ft.bold, fontSize: 14 }}>승인</Text>
          </Pressable>
          <Pressable onPress={onReject} disabled={disabled} style={[s.miniBtn, s.miniReject, disabled && { opacity: 0.5 }]}>
            <Text style={{ color: colors.neg, ...ft.bold, fontSize: 14 }}>반려</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RejectModal({
  expense,
  onClose,
  onSubmit,
}: {
  expense: CardExpense | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal visible={!!expense} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <Text style={{ fontSize: 17, ...ft.extrabold, color: colors.ink }}>반려 사유</Text>
          {expense && (
            <Text style={{ color: colors.inkMute, fontSize: 14 }}>
              {expense.storeName ?? '가맹점 미상'} · {won(expense.amount)}
            </Text>
          )}
          <TextInput
            style={s.reasonInput}
            placeholder="예: 용도가 맞지 않습니다"
            placeholderTextColor={colors.inkFaint}
            value={reason}
            onChangeText={setReason}
            multiline
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Pressable onPress={() => { setReason(''); onClose(); }} style={s.modalGhostBtn}>
              <Text style={{ color: colors.inkMute, ...ft.semibold }}>취소</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const r = reason.trim();
                if (!r) return;
                setReason('');
                onSubmit(r);
              }}
              style={[s.modalGhostBtn, { backgroundColor: colors.neg }]}
            >
              <Text style={{ color: '#fff', ...ft.bold }}>반려하기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  dayHeader: {
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dayHeaderText: { fontSize: 13, ...ft.bold, color: colors.inkMute },
  row: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  checkboxWrap: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  store: { flex: 1, fontSize: 15, color: colors.ink, ...ft.semibold },
  amount: { fontSize: 15, color: colors.ink, ...ft.bold },
  meta: { fontSize: 13, color: colors.inkFaint, marginTop: 2 },
  purpose: { fontSize: 14, color: colors.inkMute, marginTop: 4 },
  miniBtn: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  miniConfirm: { borderColor: '#bcdfcc', backgroundColor: colors.posSoft },
  miniReject: { borderColor: '#f0c4bc', backgroundColor: colors.negSoft },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 12,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  bannerGood: { backgroundColor: colors.posSoft, borderColor: '#bcdfcc' },
  bannerBad: { backgroundColor: colors.negSoft, borderColor: '#f0c4bc' },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(42,39,36,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 10,
  },
  reasonInput: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  modalGhostBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.bgSoft,
  },
});
