import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from './themed';
import { api } from '../api/client';
import { qk, useNotice } from '../api/queries';
import type { Notice } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { colors, ft, sh } from '../theme';

/**
 * 오늘의 공지 — 웹 NoticeBanner와 같은 데이터(GET /notices/today, 날짜당 1건)·같은 흐름.
 * 확인 전에는 빨간 강조 카드 + [확인했습니다], 확인 후에는 조용한 한 줄로 접힌다.
 * 확인 여부는 기기별로 기억한다(웹은 브라우저 localStorage, 앱은 AsyncStorage — 웹과 같은 키 규칙).
 * CEO/관리자는 ✎로 그 자리에서 등록·수정하고, 내용을 비워 게시하면 삭제된다(웹과 동일).
 */
const ackKey = (n: Notice) => `ea_notice_ack_${n.id}_${n.updatedAt}`;

export function NoticeBanner() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const q = useNotice();
  const notice = q.data ?? null;

  const [acked, setAcked] = useState(true); // 로딩 중엔 강조 카드를 띄우지 않는다
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!notice) {
      setAcked(true);
      return;
    }
    AsyncStorage.getItem(ackKey(notice))
      .then((v) => alive && setAcked(!!v))
      .catch(() => alive && setAcked(false));
    return () => {
      alive = false;
    };
  }, [notice?.id, notice?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const ack = () => {
    if (!notice) return;
    setAcked(true);
    AsyncStorage.setItem(ackKey(notice), '1').catch(() => {
      /* 저장 실패해도 이번 실행에서는 확인 처리 */
    });
  };

  const openEditor = (initial: string) => {
    setText(initial);
    setError('');
    setEditing(true);
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // 빈 내용으로 게시하면 서버가 오늘 공지를 삭제한다 (웹과 같은 규칙)
      await api.put('/notices/today', { content: text });
      setEditing(false);
      await qc.invalidateQueries({ queryKey: qk.notice });
    } catch (e) {
      setError(e instanceof Error ? e.message : '공지 저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  // ── 등록/수정 입력 ──
  if (editing) {
    return (
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="megaphone-outline" size={15} color="#dc2626" />
          <Text style={[s.tag, ft.bold]}>오늘의 공지</Text>
        </View>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder="전 직원에게 보여줄 금일 공지 — 비우고 게시하면 삭제됩니다"
          placeholderTextColor={colors.inkFaint}
          multiline
          autoFocus
          editable={!busy}
        />
        {!!error && <Text style={{ color: colors.neg, fontSize: 13 }}>{error}</Text>}
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setEditing(false)} disabled={busy} style={s.ghostBtn}>
            <Text style={[{ color: colors.inkMute, fontSize: 14 }, ft.semibold]}>취소</Text>
          </Pressable>
          <Pressable onPress={save} disabled={busy} style={[s.postBtn, busy && { opacity: 0.6 }]}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[{ color: '#fff', fontSize: 14 }, ft.bold]}>게시</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // ── 공지 없음 — 관리자에게만 얇은 등록 띠 (웹과 동일) ──
  if (!notice?.content) {
    if (!isAdmin || q.isLoading) return null;
    return (
      <Pressable onPress={() => openEditor('')} style={({ pressed }) => [s.addBar, pressed && { opacity: 0.7 }]}>
        <Ionicons name="add" size={16} color={colors.inkFaint} />
        <Text style={{ color: colors.inkFaint, fontSize: 13 }}>오늘의 공지 등록</Text>
      </Pressable>
    );
  }

  const EditBtn = isAdmin ? (
    <Pressable onPress={() => openEditor(notice.content)} hitSlop={10} style={s.editBtn} accessibilityLabel="공지 수정">
      <Ionicons name="pencil" size={15} color="#e0442e" />
    </Pressable>
  ) : null;

  // ── 확인 후 — 톤을 낮춰 조용히 유지하되 내용은 전부 보여준다 ──
  if (acked) {
    return (
      <View style={s.quiet}>
        <Ionicons name="megaphone-outline" size={15} color="#f08a7a" style={{ marginTop: 2 }} />
        <Text style={[s.quietTag, ft.bold]}>오늘의 공지</Text>
        <Text style={[s.quietContent, ft.semibold]}>{notice.content}</Text>
        {EditBtn}
      </View>
    );
  }

  // ── 미확인 — 시선을 끄는 카드 ──
  return (
    <View style={s.card} accessibilityRole="alert">
      <View style={s.head}>
        <View style={s.iconTile}>
          <Ionicons name="megaphone-outline" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[s.tag, ft.bold]}>오늘의 공지</Text>
            <View style={{ flex: 1 }} />
            {EditBtn}
          </View>
          <Text style={[s.content, ft.bold]}>{notice.content}</Text>
        </View>
      </View>
      <Pressable onPress={ack} style={({ pressed }) => [s.ackBtn, pressed && { opacity: 0.85 }]}>
        <Text style={[{ color: '#fff', fontSize: 15 }, ft.bold]}>확인했습니다</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff5f2', // 웹 그라데이션의 시작 톤
    borderRadius: 18,
    padding: 16,
    gap: 12,
    ...sh.card,
  },
  head: { flexDirection: 'row', gap: 12 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e5484d', // 웹 red-500/600 톤
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { fontSize: 12, color: '#dc2626' },
  content: { fontSize: 16, lineHeight: 23, color: colors.ink, marginTop: 3 },
  ackBtn: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginRight: -4,
  },
  input: {
    minHeight: 84,
    borderRadius: 14,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  ghostBtn: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  postBtn: {
    minWidth: 76,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#dc2626',
  },
  addBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  quiet: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fdf2f1', // 웹 bg-red-50/60
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quietTag: { fontSize: 12, color: '#e0442e', marginTop: 3 },
  quietContent: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.inkMute },
});
