import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useOpenExpenses, useUnsubmitted, visibleRows } from '../api/queries';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import { ApprovalsScreen } from '../screens/ApprovalsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { MyTasksScreen } from '../screens/MyTasksScreen';
import { PnlScreen } from '../screens/PnlScreen';
import { JournalScreen } from '../screens/JournalScreen';
import { TreasuryScreen } from '../screens/TreasuryScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { Spinner } from '../components/ui';
import { ApprovalBell, LogoTitle } from '../components/HomeHeader';
import { HeaderTitle, TabBackButton } from '../components/ScreenHeader';
import { colors, ft, sh } from '../theme';
import type { MainTabParamList, RootStackParamList } from './types';
import { View } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand,
    background: colors.bg,
    card: colors.bg,
    text: colors.ink,
    border: colors.line,
  },
};

/** 탭 아이콘 — 선택되면 같은 모양의 채운 아이콘으로 바뀐다 (outline → filled) */
const TAB_ICON: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Submit: 'card-outline',
  Projects: 'briefcase-outline',
  Approvals: 'shield-checkmark-outline',
  MyTasks: 'clipboard-outline',
  Menu: 'grid-outline',
};
const filledIcon = (name: keyof typeof Ionicons.glyphMap) =>
  name.replace(/-outline$/, '') as keyof typeof Ionicons.glyphMap;

const badgeStyle = { ...ft.semibold, backgroundColor: colors.neg, color: '#fff', fontSize: 11 };

function Tabs() {
  const { isCeo } = useAuth();
  const unsub = useUnsubmitted();
  const unsubCount = visibleRows(unsub.data?.rows).length;
  // 승인함 배지 — 헤더 종 배지와 같은 목록(미승인 전체)을 센다
  const open = useOpenExpenses(isCeo);
  const openCount = visibleRows(open.data?.rows).length;

  return (
    <Tab.Navigator
      // ← 뒤로가기가 '직전에 보던 탭'으로 돌아가게 방문 기록을 쓴다
      backBehavior="history"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? filledIcon(TAB_ICON[route.name]) : TAB_ICON[route.name]} color={color} size={22} />
        ),
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.inkFaint,
        headerTitleStyle: { ...ft.extrabold, color: colors.ink, fontSize: 22, letterSpacing: -0.4 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        // 내비게이션 바 — 본문과 같은 바탕색에 얇은 경계선만. 흰 띠가 따로 떠 있지 않아 화면이 한 장으로 읽힌다
        headerStyle: {
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          shadowOpacity: 0,
          elevation: 0,
        },
        // 탭바 — 경계선 대신 흰 면 + 은은한 그림자
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: colors.card,
          paddingTop: 6,
          ...sh.lift,
        },
        tabBarIconStyle: { marginBottom: -2 },
        // 탭 라벨·배지는 내비게이션이 자체 스타일을 쓰므로 Pretendard를 직접 지정한다
        tabBarLabelStyle: { ...ft.semibold, fontSize: 10.5 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: '홈',
          // 맨 상단은 웹처럼 검은 띠(shell) — 로고가 그 위에 얹힌다
          headerStyle: { backgroundColor: colors.shell, borderBottomWidth: 0, shadowOpacity: 0, elevation: 0 },
          headerTitle: () => <LogoTitle />,
          headerTitleAlign: 'left',
          headerRight: () => <ApprovalBell />,
        }}
      />
      <Tab.Screen
        name="Submit"
        component={ExpensesScreen}
        options={{
          title: '지출',
          headerTitle: () => <HeaderTitle title="지출" />,
          tabBarBadge: unsubCount > 0 ? unsubCount : undefined,
          tabBarBadgeStyle: badgeStyle,
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          title: '프로젝트',
          headerTitle: () => <HeaderTitle title="프로젝트" />,
        }}
      />
      {isCeo && (
        <Tab.Screen
          name="Approvals"
          component={ApprovalsScreen}
          options={{
            title: '승인',
            headerTitle: () => <HeaderTitle title="승인함" />,
            tabBarBadge: openCount > 0 ? openCount : undefined,
            tabBarBadgeStyle: badgeStyle,
          }}
        />
      )}
      <Tab.Screen
        name="MyTasks"
        component={MyTasksScreen}
        options={{
          title: '내 업무',
          headerLeft: () => <TabBackButton />,
          headerTitle: () => <HeaderTitle title="내 업무" />,
        }}
      />
      {/* 토스의 '전체' 탭 — 웹 사이드바 전체 메뉴. 내 정보도 이 안에서 연다 */}
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          title: '전체',
          headerTitle: () => <HeaderTitle title="전체 메뉴" />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Spinner />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTitleStyle: { ...ft.extrabold, color: colors.ink, fontSize: 18 },
          headerTintColor: colors.ink,
          headerBackButtonDisplayMode: 'minimal',
          // 탭 화면과 같은 바탕색 내비게이션 바. 네이티브 스택은 headerStyle에 backgroundColor만 받는다
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
        }}
      >
        {state.status === 'signedIn' ? (
          <>
            <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: '지출 상세' }} />
            <Stack.Screen
              name="ProjectDetail"
              component={ProjectDetailScreen}
              options={({ route }) => ({ title: route.params.name ?? '프로젝트' })}
            />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: '비밀번호 변경' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '내 정보' }} />
            <Stack.Screen name="Pnl" component={PnlScreen} options={{ title: '손익' }} />
            <Stack.Screen name="Journal" component={JournalScreen} options={{ title: '거래' }} />
            <Stack.Screen name="Treasury" component={TreasuryScreen} options={{ title: '자금' }} />
            <Stack.Screen
              name="Placeholder"
              component={PlaceholderScreen}
              options={({ route }) => ({ title: route.params.title })}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
