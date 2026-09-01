import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/themed';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { qk, useProject, useTasks } from '../api/queries';
import type { Task } from '../api/types';
import { OfflineBanner } from '../components/OfflineBanner';
import { DelayedBadge, StatusBadge } from '../components/StatusBadge';
import { Progress } from '../components/Progress';
import { ErrorView, Spinner } from '../components/ui';
import { compact, num } from '../lib/money';
import { colors, ft, numFont, sh } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

/** 프로젝트 상세 — 개요·금액·진행·업무(체크/추가/삭제는 직원도 가능, 웹과 동일 권한) */
export function ProjectDetailScreen({ route }: Props) {
  const { projectId } = route.params;
  const qc = useQueryClient();
  const proj = useProject(projectId);
  const tasks = useTasks(projectId);

  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refetchAll = () =>
    Promise.all([
      proj.refetch(),
      tasks.refetch(),
      qc.invalidateQueries({ queryKey: qk.projects }),
      qc.invalidateQueries({ queryKey: qk.dashboard }),
    ]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
      await refetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const toggleTask = (t: Task) => run(() => api.patch(`/tasks/${t.id}`, { isDone: !t.isDone }));
  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle('');
    run(() => api.post(`/projects/${projectId}/tasks`, { title }));
  };
  const removeTask = (t: Task) => {
    Alert.alert('업무 삭제', `"${t.title}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => run(() => api.del(`/tasks/${t.id}`)) },
    ]);
  };

  const p = proj.data;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OfflineBanner dataUpdatedAt={proj.dataUpdatedAt || undefined} />
        {proj.isLoading ? (
          <Spinner />
        ) : proj.isError && !p ? (
          <ErrorView
            message={proj.error instanceof Error ? proj.error.message : '프로젝트를 불러오지 못했습니다'}
            onRetry={() => proj.refetch()}
          />
        ) : p ? (
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            refreshControl={
              <RefreshControl refreshing={proj.isFetching && !proj.isLoading} onRefresh={refetchAll} tintColor={colors.brand} />
            }
          >
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <StatusBadge kind="PROJECT_STATUS" code={p.status} />
                {p.isDelayed && <DelayedBadge />}
                <Text style={[s.code, numFont]}>{p.code}</Text>
              </View>
              <Text style={[s.name, ft.extrabold]}>{p.name}</Text>
              {!!p.goal && <Text style={s.goal}>{p.goal}</Text>}
            </View>

            <View style={s.card}>
              <Text style={[s.cardTitle, ft.bold]}>개요</Text>
              <Info label="사업유형" value={p.businessType?.name ?? '—'} />
              <Info label="주관부서" value={p.leadDepartment?.name ?? '—'} />
              <Info label="담당자" value={p.owner?.name ?? '—'} />
              <Info label="기간" value={`${sd(p.startDate)} ~ ${sd(p.planEndDate)}`} />
              <Info
                label="참여부서"
                value={(p.departments ?? []).map((d) => d.department.name).join(', ') || '—'}
              />
            </View>

            <View style={s.card}>
              <Text style={[s.cardTitle, ft.bold]}>금액</Text>
              <View style={s.moneyRow}>
                {([['수주금액', p.contractAmount], ['예상매출', p.expectedRevenue], ['실행예산', p.budgetAmount]] as const).map(
                  ([label, v]) => (
                    <View key={label} style={s.moneyCell}>
                      <Text style={s.moneyLabel}>{label}</Text>
                      <Text style={[s.moneyVal, ft.bold, numFont]}>{compact(v)}</Text>
                      <Text style={[s.moneyExact, numFont]}>{num(v)}원</Text>
                    </View>
                  ),
                )}
              </View>
            </View>

            <View style={s.card}>
              <Text style={[s.cardTitle, ft.bold]}>진행</Text>
              <Progress value={p.progress} />
              <Text style={{ fontSize: 13, color: colors.inkMute }}>
                전체 {p.totalTasks}건 · 완료 {p.doneTasks}건 · 남음 {p.totalTasks - p.doneTasks}건
              </Text>
              {!!p.members?.length && (
                <Info label="참여자" value={p.members.map((m) => m.user.name).join(', ')} />
              )}
            </View>

            <View style={s.card}>
              <Text style={[s.cardTitle, ft.bold]}>업무</Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={s.taskInput}
                  placeholder="새 업무 제목"
                  placeholderTextColor={colors.inkFaint}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  onSubmitEditing={addTask}
                  editable={!busy}
                />
                <Pressable onPress={addTask} disabled={busy || !newTitle.trim()} style={[s.addBtn, (busy || !newTitle.trim()) && { opacity: 0.45 }]}>
                  <Text style={[{ color: '#fff', fontSize: 14 }, ft.bold]}>추가</Text>
                </Pressable>
              </View>

              {!!error && <Text style={{ color: colors.neg, fontSize: 13 }}>{error}</Text>}

              {tasks.isLoading ? (
                <Spinner />
              ) : !(tasks.data ?? []).length ? (
                <Text style={{ color: colors.inkFaint, fontSize: 13, paddingVertical: 6 }}>등록된 업무가 없습니다</Text>
              ) : (
                (tasks.data ?? []).map((t) => (
                  <View key={t.id} style={s.taskRow}>
                    <Pressable onPress={() => toggleTask(t)} disabled={busy} style={s.checkWrap} hitSlop={8}>
                      <View style={[s.checkbox, t.isDone && s.checkboxOn]}>
                        {t.isDone && <Text style={[{ color: '#fff', fontSize: 12 }, ft.extrabold]}>✓</Text>}
                      </View>
                    </Pressable>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.taskTitle, t.isDone && s.taskDone]} numberOfLines={2}>
                        {t.title}
                      </Text>
                      <Text style={s.taskMeta} numberOfLines={1}>
                        {[t.assignee?.name, t.dueDate ? `마감 ${sd(t.dueDate)}` : null].filter(Boolean).join(' · ') || '담당 미지정'}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeTask(t)} disabled={busy} hitSlop={10} style={s.delBtn}>
                      <Text style={{ color: colors.inkFaint, fontSize: 16 }}>✕</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const sd = (iso: string | null): string => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '—');

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ width: 64, fontSize: 13, color: colors.inkFaint }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 13, color: colors.inkMute, lineHeight: 19 }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 8,
    ...sh.card,
  },
  cardTitle: { fontSize: 14, color: colors.ink, marginBottom: 2 },
  code: { marginLeft: 'auto', fontSize: 12, color: colors.inkFaint },
  name: { fontSize: 19, color: colors.ink },
  goal: { fontSize: 13.5, lineHeight: 20, color: colors.inkMute },
  moneyRow: { flexDirection: 'row', gap: 8 },
  moneyCell: { flex: 1, backgroundColor: colors.bgSoft, borderRadius: 10, padding: 10, gap: 2 },
  moneyLabel: { fontSize: 11.5, color: colors.inkFaint },
  moneyVal: { fontSize: 16, color: colors.ink },
  moneyExact: { fontSize: 10.5, color: colors.inkFaint },
  taskInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.ink,
  },
  addBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  checkWrap: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.pos, borderColor: colors.pos },
  taskTitle: { fontSize: 14, color: colors.ink, lineHeight: 19 },
  taskDone: { color: colors.inkFaint, textDecorationLine: 'line-through' },
  taskMeta: { fontSize: 12, color: colors.inkFaint, marginTop: 1 },
  delBtn: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
});
