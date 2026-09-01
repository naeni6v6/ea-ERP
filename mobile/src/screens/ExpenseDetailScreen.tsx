import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/themed';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { useInvalidateExpenses, usePurposes } from '../api/queries';
import { PurposeChips } from '../components/PurposeChips';
import { PrimaryButton, StatusChip } from '../components/ui';
import { useOnline } from '../components/OfflineBanner';
import { won } from '../lib/money';
import { kstDateTime } from '../lib/dates';
import { colors, ft, numFont, sh } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

/** 지출 상세 / 용도 입력 — 용도(필수) 칩 선택 + 메모(선택) 입력 후 제출 */
export function ExpenseDetailScreen({ route, navigation }: Props) {
  const e = route.params.expense;
  const { purposes } = usePurposes();
  const invalidate = useInvalidateExpenses();
  const online = useOnline();

  const [purpose, setPurpose] = useState<string | null>(e.purposeText);
  const [memo, setMemo] = useState(e.memo ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const editable = e.status === 'PENDING' || e.status === 'REJECTED' || e.status === 'SUBMITTED';

  const submit = async () => {
    if (!purpose || busy) return;
    setBusy(true);
    setError('');
    try {
      // 이 호출 하나로 용도 저장 + SUBMITTED(승인 대기) 전환
      await api.patch(`/cards/expenses/${e.id}/purpose`, {
        purposeText: purpose,
        ...(memo.trim() ? { memo: memo.trim() } : {}),
      });
      await invalidate();
      navigation.goBack();
    } catch (err) {
      // 실패를 조용히 넘기지 않는다 — 저장 안 됐음을 명확히 알린다
      setError(`제출에 실패해 저장되지 않았습니다. ${err instanceof Error ? err.message : ''}`.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
          <View style={s.head}>
            <Text style={s.store}>{e.storeName ?? '가맹점 미상'}</Text>
            <Text style={[s.amount, numFont]}>{won(e.amount)}</Text>
            <StatusChip status={e.status} />
          </View>

          {e.status === 'REJECTED' && (
            <View style={s.rejectBox}>
              <Text style={{ color: colors.neg, ...ft.bold, fontSize: 14 }}>반려 사유</Text>
              <Text style={{ color: colors.ink, fontSize: 14, marginTop: 2, lineHeight: 20 }}>
                {e.rejectReason ?? '사유가 입력되지 않았습니다'}
              </Text>
            </View>
          )}

          <View style={s.infoBox}>
            <InfoRow label="결제일시" value={kstDateTime(e.usedAt)} />
            <InfoRow
              label="결제카드"
              value={e.card ? `${e.card.name}${e.card.last4 ? ` (${e.card.last4})` : ''}` : '—'}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={s.fieldLabel}>
              용도 <Text style={{ color: colors.neg }}>*</Text>
            </Text>
            <PurposeChips options={purposes} value={purpose} onChange={setPurpose} />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={s.fieldLabel}>메모 (선택)</Text>
            <TextInput
              style={s.memoInput}
              placeholder="예: 팀 점심"
              placeholderTextColor={colors.inkFaint}
              value={memo}
              onChangeText={setMemo}
              multiline
              editable={editable && !busy}
            />
          </View>

          {!!error && <Text style={{ color: colors.neg, fontSize: 14, lineHeight: 20 }}>{error}</Text>}
        </ScrollView>

        {editable && (
          <View style={s.footer}>
            <PrimaryButton
              title={e.status === 'REJECTED' ? '재제출하기' : '제출하기'}
              onPress={submit}
              disabled={!purpose || online === false}
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
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
      <Text style={{ color: colors.inkFaint, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 14, ...ft.semibold }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    gap: 8,
    alignItems: 'flex-start',
    ...sh.card,
  },
  store: { fontSize: 16, color: colors.inkMute, ...ft.semibold },
  amount: { fontSize: 32, ...ft.extrabold, color: colors.ink },
  rejectBox: {
    backgroundColor: colors.negSoft,
    borderRadius: 14,
    padding: 12,
  },
  infoBox: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...sh.card,
  },
  fieldLabel: { fontSize: 14, ...ft.bold, color: colors.ink },
  memoInput: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 12,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: 'top',
    ...sh.card,
  },
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
