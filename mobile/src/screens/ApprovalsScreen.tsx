import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '../components/themed';
import { api } from '../api/client';
import { useInvalidateExpenses, useOpenExpenses, usePurposes, visibleRows } from '../api/queries';
import type { CardExpense, ConfirmBulkResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { OfflineBanner, useOnline } from '../components/OfflineBanner';
import { PurposePicker } from '../components/PurposeChips';
import { Empty, ErrorView, PrimaryButton, Spinner } from '../components/ui';
import { num, won } from '../lib/money';
import { cardMerchantVisual } from '../lib/merchantIcon';
import { kstTime, kstYmd, shortDateLabel } from '../lib/dates';
import { colors, ft, numFont, sh } from '../theme';

/**
 * 승인함 (CEO 전용) — 아직 승인되지 않은 카드 지출을 전부 모아 승인/반려한다.
 *
 * 서버 규칙에 맞춘 화면 흐름:
 * - 승인(confirm)은 **용도가 있어야** 된다. 상태가 미제출이어도 용도만 있으면 바로 승인된다.
 * - 반려(reject)는 **승인 대기(SUBMITTED)** 건만 가능하다.
 * 그래서 용도가 없는 건은 이 화면에서 용도를 고르면 저장(=승인 대기 전환) 후 이어서 승인한다.
 */
export function ApprovalsScreen() {
  const { isCeo } = useAuth();
  const q = useOpenExpenses(isCeo);
  const { purposes } = usePurposes();
  const invalidate = useInvalidateExpenses();
  const online = useOnline();

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sel, setSel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState<CardExpense | null>(null);

  const rows = useMemo(() => visibleRows(q.data?.rows), [q.data]);
  /** 지금 승인할 수 있는 건 = 이미 용도가 있거나, 이 화면에서 용도를 고른 건 */
  const purposeOf = (e: CardExpense) => e.purposeText ?? sel[e.id] ?? null;
  const ready = (e: CardExpense) => !!purposeOf(e);
  const selectedIds = rows.filter((r) => checked[r.id] && ready(r)).map((r) => r.id);
  const checkableCount = rows.filter(ready).length;
  const allChecked = checkableCount > 0 && selectedIds.length === checkableCount;

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
      .map(([ymd, data]) => ({ title: shortDateLabel(ymd), data }));
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

  /** 용도가 아직 저장되지 않았으면 먼저 저장한다 (저장 = 승인 대기 전환) */
  const ensurePurpose = async (e: CardExpense) => {
    if (e.purposeText) return;
    const picked = sel[e.id];
    if (!picked) throw new Error('용도를 먼저 선택해주세요');
    await api.patch(`/cards/expenses/${e.id}/purpose`, { purposeText: picked });
  };

  const confirmOne = (e: CardExpense) =>
    run(async () => {
      await ensurePurpose(e);
      await api.post(`/cards/expenses/${e.id}/confirm`);
      setSel((prev) => {
        const next = { ...prev };
        delete next[e.id];
        return next;
      });
      setNotice(`${e.storeName ?? '지출'} ${won(e.amount)} 승인 완료`);
    });

  const confirmBulk = () =>
    run(async () => {
      const targets = rows.filter((r) => selectedIds.includes(r.id));
      // 용도가 아직 없는 건은 먼저 저장한 뒤 한 번에 승인한다
      for (const t of targets) await ensurePurpose(t);
      const r = await api.post<ConfirmBulkResult>('/cards/expenses/confirm-bulk', { ids: selectedIds });
      setChecked({});
      setSel({});
      setNotice(
        `${r.confirmed}건 승인 완료${r.skipped ? ` · ${r.skipped}건 건너뜀` : ''}${
          r.errors.length ? `\n${r.errors.join('\n')}` : ''
        }`,
      );
    });

  const reject = (e: CardExpense, reason: string) =>
    run(async () => {
      await api.post(`/cards/expenses/${e.id}/reject`, { reason });
      setNotice(`${e.storeName ?? '지출'} ${won(e.amount)} 반려 처리`);
    });

  const toggleAll = () => {
    if (allChecked) return setChecked({});
    setChecked(Object.fromEntries(rows.filter(ready).map((r) => [r.id, true])));
  };

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
          <Pressable onPress={toggleAll} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: colors.inkMute, ...ft.semibold }}>{allChecked ? '전체 해제' : '전체 선택'}</Text>
          </Pressable>
          <Text style={{ color: colors.inkFaint, fontSize: 13 }}>미승인 {rows.length}건</Text>
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
        <Empty>승인할 지출이 없습니다. 모두 처리하셨어요 👍</Empty>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: selectedIds.length ? 120 : 24 }}
          refreshControl={
            <RefreshControl
              refreshing={q.isFetching && !q.isLoading}
              onRefresh={() => q.refetch()}
              tintColor={colors.brand}
            />
          }
          renderSectionHeader={({ section }) => <Text style={s.dayHeader}>{section.title}</Text>}
          renderItem={({ item }) => (
            <ApprovalRow
              expense={item}
              checked={!!checked[item.id]}
              purpose={purposeOf(item)}
              purposes={purposes}
              onToggle={() =>
                ready(item) && setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
              }
              onPick={(p) => setSel((prev) => ({ ...prev, [item.id]: p }))}
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
  purpose,
  purposes,
  onToggle,
  onPick,
  onConfirm,
  onReject,
  disabled,
}: {
  expense: CardExpense;
  checked: boolean;
  purpose: string | null;
  purposes: string[];
  onToggle: () => void;
  onPick: (p: string) => void;
  onConfirm: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const v = cardMerchantVisual(e.storeName);
  const needsPurpose = !purpose;
  const canReject = e.status === 'SUBMITTED'; // 서버가 승인 대기 건만 반려를 허용한다
  const statusLabel =
    e.status === 'SUBMITTED' ? '승인 대기' : e.status === 'REJECTED' ? '반려됨' : '미제출';
  const statusColor =
    e.status === 'SUBMITTED' ? colors.brandDeep : e.status === 'REJECTED' ? colors.neg : colors.warn;

  return (
    <View style={s.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <Pressable onPress={onToggle} hitSlop={8} disabled={needsPurpose}>
          <View style={[s.checkbox, checked && s.checkboxOn, needsPurpose && { opacity: 0.35 }]}>
            {checked && <Text style={{ color: '#fff', fontSize: 12, ...ft.extrabold }}>✓</Text>}
          </View>
        </Pressable>
        <View style={[s.iconCircle, { backgroundColor: v.bg }]}>
          <Ionicons name={v.icon} size={19} color={v.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.store, ft.semibold]} numberOfLines={1}>
            {e.storeName ?? '가맹점 미상'}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {kstTime(e.usedAt)} · {e.card?.holder?.name ?? '소지자 미상'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={[s.amount, ft.bold, numFont]}>-{num(e.amount)}원</Text>
          <Text style={[{ fontSize: 12, color: statusColor }, ft.bold]}>{statusLabel}</Text>
        </View>
      </View>

      {e.status === 'REJECTED' && !!e.rejectReason && (
        <Text style={s.rejectNote} numberOfLines={2}>
          반려 사유 · {e.rejectReason}
        </Text>
      )}

      {needsPurpose ? (
        <View style={{ gap: 6 }}>
          <Text style={s.hint}>승인하려면 용도를 골라주세요</Text>
          <PurposePicker options={purposes} value={null} onChange={onPick} />
        </View>
      ) : e.purposeText ? (
        <Text style={s.purpose} numberOfLines={2}>
          용도 · {purpose}
          {e.memo ? ` — ${e.memo}` : ''}
        </Text>
      ) : (
        // 이 화면에서 고른 용도 — 다시 눌러 바꿀 수 있게 선택기를 유지한다
        <View style={{ gap: 4 }}>
          <PurposePicker options={purposes} value={purpose} onChange={onPick} />
          <Text style={s.saveNote}>승인하면 이 용도로 저장됩니다</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onConfirm}
          disabled={disabled || needsPurpose}
          style={[s.miniBtn, s.miniConfirm, (disabled || needsPurpose) && { opacity: 0.4 }]}
        >
          <Text style={{ color: colors.pos, ...ft.bold, fontSize: 14 }}>승인</Text>
        </Pressable>
        <Pressable
          onPress={onReject}
          disabled={disabled || !canReject}
          style={[s.miniBtn, s.miniReject, (disabled || !canReject) && { opacity: 0.4 }]}
        >
          <Text style={{ color: colors.neg, ...ft.bold, fontSize: 14 }}>반려</Text>
        </Pressable>
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
            <Pressable
              onPress={() => {
                setReason('');
                onClose();
              }}
              style={s.modalGhostBtn}
            >
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
    backgroundColor: colors.bg,
  },
  dayHeader: {
    fontSize: 13,
    color: colors.inkFaint,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    ...ft.semibold,
  },
  row: {
    backgroundColor: colors.card,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    ...sh.card,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  store: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 12.5, color: colors.inkFaint, marginTop: 2 },
  amount: { fontSize: 15, color: colors.ink },
  purpose: { fontSize: 13, color: colors.inkMute },
  hint: { fontSize: 12.5, color: colors.warn, ...ft.semibold },
  saveNote: { fontSize: 11.5, color: colors.inkFaint },
  rejectNote: { fontSize: 12.5, color: colors.neg },
  miniBtn: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  miniConfirm: { backgroundColor: colors.posSoft },
  miniReject: { backgroundColor: colors.negSoft },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 12,
    marginBottom: 0,
    borderRadius: 14,
    padding: 12,
    ...sh.card,
  },
  bannerGood: { backgroundColor: colors.posSoft },
  bannerBad: { backgroundColor: colors.negSoft },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: colors.card,
    ...sh.lift,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(42,39,36,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    gap: 10,
    ...sh.lift,
  },
  reasonInput: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: colors.bgSoft,
    padding: 12,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  modalGhostBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.bgSoft,
  },
});
