import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { useUnsubmitted, visibleRows } from '../api/queries';
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

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICON[route.name]} color={color} size={size} />,
        tabBarActiveTintColor: colors.brandDeep,
        tabBarInactiveTintColor: colors.inkFaint,
        headerTitleStyle: { ...ft.extrabold, color: colors.ink, fontSize: 19 },
        headerShadowVisible: false,
        // iOS 탭바 — 경계선 대신 흰 면 + 은은한 그림자
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: colors.card,
          ...sh.lift,
        },
        // 탭 라벨·배지는 내비게이션이 자체 스타일을 쓰므로 Pretendard를 직접 지정한다
        tabBarLabelStyle: { ...ft.semibold, fontSize: 11 },
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
          headerTitle: '지출',
          tabBarBadge: unsubCount > 0 ? unsubCount : undefined,
          tabBarBadgeStyle: { ...ft.semibold, backgroundColor: colors.neg, color: '#fff', fontSize: 11 },
        }}
      />
      <Tab.Screen name="Projects" component={ProjectsScreen} options={{ title: '프로젝트', headerTitle: '프로젝트' }} />
      {isCeo && (
        <Tab.Screen
          name="Approvals"
          component={ApprovalsScreen}
          options={{ title: '승인함', headerTitle: '승인함' }}
        />
      )}
      {/* 토스의 '전체' 탭 — 웹 사이드바 전체 메뉴. 내 정보도 이 안에서 연다 */}
      <Tab.Screen name="Menu" component={MenuScreen} options={{ title: '전체', headerTitle: '전체 메뉴' }} />
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
          headerTitleStyle: { ...ft.extrabold, color: colors.ink },
          headerTintColor: colors.brandDeep,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
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
