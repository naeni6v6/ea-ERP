import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '../components/themed';
import { useAuth } from '../auth/AuthContext';
import { brandGradient, card, colors, ft, sh, tight } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

const ROLE_LABEL: Record<string, string> = { CEO: '대표', ADMIN: '관리자', EMPLOYEE: '직원' };

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** 표시 조건 — 웹 사이드바 show와 동일. 실제 차단은 API가 한다 */
  show?: (s: { isCeo: boolean; isAdmin: boolean }) => boolean;
  go: (nav: Nav) => void;
}

interface MenuSection {
  title: string;
  /** 아이콘 타일 색 — 섹션 하나당 한 색. 항목마다 색이 다르면 눈이 어지럽다 */
  tint: { bg: string; fg: string };
  items: MenuItem[];
}

/**
 * 웹 사이드바(NAV)와 같은 구성 — 모바일 화면이 없는 항목은 준비 중 안내로 보낸다.
 * 색은 섹션 단위로만 나눈다: 같은 카테고리는 같은 색이라 목록이 조용하게 읽힌다.
 */
const SECTIONS: MenuSection[] = [
  {
    title: '메뉴',
    tint: { bg: colors.brandSoft, fg: colors.brandDeep },
    items: [
      { icon: 'speedometer-outline', label: '대시보드', go: (nav) => nav.navigate('Home') },
      { icon: 'briefcase-outline', label: '프로젝트', go: (nav) => nav.navigate('Projects') },
      { icon: 'clipboard-outline', label: '내 업무', go: (nav) => nav.navigate('MyTasks') },
    ],
  },
  {
    title: '경영',
    tint: { bg: colors.posSoft, fg: colors.pos },
    items: [
      { icon: 'trending-up-outline', label: '손익', show: (s) => s.isAdmin, go: (nav) => nav.navigate('Pnl') },
      { icon: 'swap-horizontal-outline', label: '거래', show: (s) => s.isAdmin, go: (nav) => nav.navigate('Journal') },
      { icon: 'wallet-outline', label: '자금', show: (s) => s.isCeo, go: (nav) => nav.navigate('Treasury') },
    ],
  },
  {
    title: '지출',
    tint: { bg: colors.warnSoft, fg: colors.warn },
    items: [
      { icon: 'card-outline', label: '카드 지출', go: (nav) => nav.navigate('Submit', { seg: 'card' }) },
      {
        icon: 'cash-outline',
        label: '계좌 지출',
        show: (s) => s.isCeo,
        go: (nav) => nav.navigate('Submit', { seg: 'account' }),
      },
      {
        icon: 'shield-checkmark-outline',
        label: '승인함',
        show: (s) => s.isCeo,
        go: (nav) => nav.navigate('Approvals'),
      },
    ],
  },
  {
    title: '분석',
    tint: { bg: colors.vizSoft, fg: colors.viz },
    items: [
      {
        icon: 'pricetags-outline',
        label: '유형별',
        show: (s) => s.isAdmin,
        go: (nav) => nav.navigate('Placeholder', { title: '유형별 분석' }),
      },
      {
        icon: 'people-outline',
        label: '사업부서별',
        show: (s) => s.isAdmin,
        go: (nav) => nav.navigate('Placeholder', { title: '사업부서별 분석' }),
      },
      {
        icon: 'calendar-outline',
        label: '기간별',
        show: (s) => s.isAdmin,
        go: (nav) => nav.navigate('Placeholder', { title: '기간별 분석' }),
      },
    ],
  },
  {
    title: '설정',
    tint: { bg: colors.bgSoft, fg: colors.inkMute },
    items: [
      { icon: 'person-outline', label: '내 정보', go: (nav) => nav.navigate('Profile') },
      { icon: 'key-outline', label: '비밀번호 변경', go: (nav) => nav.navigate('ChangePassword') },
    ],
  },
];

/**
 * 전체 메뉴 — 토스 '전체' 탭 형식.
 * 웹 사이드바의 모든 항목을 권한대로 보여주고, 모바일 화면이 없는 곳은 준비 중 안내로 연결한다.
 */
export function MenuScreen() {
  const nav = useNavigation<Nav>();
  const { state, isCeo, isAdmin } = useAuth();
  if (state.status !== 'signedIn') return null;
  const me = state.me;
  const roles = [...new Set(me.roles.map((r) => ROLE_LABEL[r.role] ?? r.role))].join(' · ');
  const scope = { isCeo, isAdmin };
  const sections = SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => (it.show ? it.show(scope) : true)),
  })).filter((sec) => sec.items.length > 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.container}>
      {/* 내 프로필 — 토스 상단 프로필 행 */}
      <Pressable style={({ pressed }) => [s.profileCard, pressed && { opacity: 0.9 }]} onPress={() => nav.navigate('Profile')}>
        {/* 웹 우측 상단 프로필과 같은 브랜드 그라데이션 원 */}
        <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
          <Text style={s.avatarText}>{me.name.slice(0, 1)}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.profileName, tight]}>{me.name}</Text>
          <Text style={s.profileMeta}>
            {[me.department?.name, roles].filter(Boolean).join(' · ') || '내 정보 관리'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
      </Pressable>

      {sections.map((sec) => (
        <View key={sec.title} style={{ gap: 8 }}>
          <Text style={s.sectionTitle}>{sec.title}</Text>
          <View style={s.sectionCard}>
            {sec.items.map((it, i) => (
              <Pressable
                key={it.label}
                onPress={() => it.go(nav)}
                style={({ pressed }) => [s.row, i > 0 && s.rowDivider, pressed && { backgroundColor: colors.bgSoft }]}
              >
                <View style={[s.iconTile, { backgroundColor: sec.tint.bg }]}>
                  <Ionicons name={it.icon} size={18} color={sec.tint.fg} />
                </View>
                <Text style={s.rowLabel}>{it.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, gap: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    ...card,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...sh.glow,
  },
  avatarText: { color: '#fff', fontSize: 19, ...ft.bold },
  profileName: { fontSize: 18, color: colors.ink, ...ft.extrabold },
  profileMeta: { fontSize: 13, color: colors.inkMute, marginTop: 2 },
  sectionTitle: { fontSize: 12.5, color: colors.inkFaint, marginLeft: 6, ...ft.semibold },
  sectionCard: {
    overflow: 'hidden',
    ...card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.ink, ...ft.semibold },
});
