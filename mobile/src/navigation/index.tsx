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
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { Spinner } from '../components/ui';
import { ApprovalBell, LogoTitle } from '../components/HomeHeader';
import { HEADER_TINT, HeaderTitle } from '../components/ScreenHeader';
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

const TAB_ICON: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Submit: 'card-outline',
  Projects: 'briefcase-outline',
  Approvals: 'shield-checkmark-outline',
  Menu: 'menu-outline',
};

function Tabs() {
  const { isCeo } = useAuth();
  const unsub = useUnsubmitted();
  const unsubCount = visibleRows(unsub.data?.rows).length;
  // 승인함 배지 — 헤더 종 배지와 같은 목록(미승인 전체)을 센다
  const open = useOpenExpenses(isCeo);
  const openCount = visibleRows(open.data?.rows).length;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // 아이콘·라벨은 기본값보다 한 단계 작게 — 탭바가 꽉 차 보이지 않게
        tabBarIcon: ({ color }) => <Ionicons name={TAB_ICON[route.name]} color={color} size={21} />,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.inkFaint,
        headerTitleStyle: { ...ft.extrabold, color: colors.ink, fontSize: 21, letterSpacing: -0.3 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        // iOS 내비게이션 바 — 본문보다 한 겹 위에 뜬 흰 면
        headerStyle: {
          backgroundColor: colors.card,
          shadowColor: '#2a2724',
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        },
        // iOS 탭바 — 경계선 대신 흰 면 + 은은한 그림자
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: colors.card,
          ...sh.lift,
        },
        tabBarIconStyle: { marginBottom: -2 },
        // 탭 라벨·배지는 내비게이션이 자체 스타일을 쓰므로 Pretendard를 직접 지정한다
        tabBarLabelStyle: { ...ft.semibold, fontSize: 10 },
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: '홈',
          // 맨 상단은 웹처럼 검은 띠(shell) — 로고가 그 위에 얹힌다
          headerStyle: { backgroundColor: colors.shell },
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
          headerTitle: () => <HeaderTitle title="지출" icon="card-outline" tint={HEADER_TINT.brand} />,
          tabBarBadge: unsubCount > 0 ? unsubCount : undefined,
          tabBarBadgeStyle: { ...ft.semibold, backgroundColor: colors.neg, color: '#fff', fontSize: 11 },
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          title: '프로젝트',
          headerTitle: () => <HeaderTitle title="프로젝트" icon="briefcase-outline" tint={HEADER_TINT.viz} />,
        }}
      />
      {isCeo && (
        <Tab.Screen
          name="Approvals"
          component={ApprovalsScreen}
          options={{
            title: '승인함',
            headerTitle: () => (
              <HeaderTitle title="승인함" icon="shield-checkmark-outline" tint={HEADER_TINT.pos} />
            ),
            tabBarBadge: openCount > 0 ? openCount : undefined,
            tabBarBadgeStyle: { ...ft.semibold, backgroundColor: colors.neg, color: '#fff', fontSize: 11 },
          }}
        />
      )}
      {/* 토스의 '전체' 탭 — 웹 사이드바 전체 메뉴. 내 정보도 이 안에서 연다 */}
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          title: '전체',
          headerTitle: () => <HeaderTitle title="전체 메뉴" icon="menu-outline" tint={HEADER_TINT.neutral} />,
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
          headerTintColor: colors.brandDeep,
          headerBackButtonDisplayMode: 'minimal',
          // 탭 화면과 같은 흰 내비게이션 바.
          // 네이티브 스택은 headerStyle에 backgroundColor만 받으므로,
          // 경계는 플랫폼 기본 그림자(iOS는 얇은 실선)로 낸다.
          headerStyle: { backgroundColor: colors.card },
          headerShadowVisible: true,
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
