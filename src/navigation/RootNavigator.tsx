import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { PresencePayload } from '../../modules/timo-beacons';
import { api } from '../api/client';
import type { SummaryResponse } from '../api/types';
import { Toast } from '../components';
import { CorrectionScreen } from '../screens/CorrectionScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegistrationDetailScreen } from '../screens/RegistrationDetailScreen';
import { RegistrationsScreen } from '../screens/RegistrationsScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { MagicLinkScreen } from '../screens/auth/MagicLinkScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ConfirmSheet } from '../screens/overlays/ConfirmSheet';
import { useSession } from '../services/session';
import { cacheRegs } from '../state/ui';
import { colors } from '../theme';
import { TabBar, tabBarHeight } from './TabBar';
import type { RootStackParamList, TabParamList, TabStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Root = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator<TabStackParamList>();
const RegsStack = createNativeStackNavigator<TabStackParamList>();

const theme: Theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, primary: colors.accent, border: colors.divider } };
const stackOpts = { headerShown: false, contentStyle: { backgroundColor: colors.bg } } as const;

function HomeTab() {
  return (
    <HomeStack.Navigator screenOptions={stackOpts}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Detail" component={RegistrationDetailScreen} />
      <HomeStack.Screen name="Correction" component={CorrectionScreen} />
    </HomeStack.Navigator>
  );
}

function RegsTab() {
  return (
    <RegsStack.Navigator screenOptions={stackOpts}>
      <RegsStack.Screen name="Registrations" component={RegistrationsScreen} />
      <RegsStack.Screen name="Detail" component={RegistrationDetailScreen} />
      <RegsStack.Screen name="Correction" component={CorrectionScreen} />
    </RegsStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tabs.Navigator tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="HomeTab" component={HomeTab} />
      <Tabs.Screen name="RegsTab" component={RegsTab} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

/** "Not right? Request a correction": open the registration the event produced (or the list if unknown). */
async function openRegistrationFor(c: PresencePayload) {
  if (!navigationRef.isReady()) return;
  let id: string | null = null;
  try {
    const s = await api<SummaryResponse>('/api/me/summary');
    cacheRegs([s.open, ...s.today]);
    if (c.type === 'in') id = s.open?.id ?? s.today[0]?.id ?? null;
    else {
      const closed = s.today.filter((r) => r.checkOutAt);
      closed.sort((a, b) => Math.abs(Date.parse(a.checkOutAt!) - c.at) - Math.abs(Date.parse(b.checkOutAt!) - c.at));
      id = closed[0]?.id ?? null;
    }
  } catch {
    // Offline: fall through to the list.
  }
  if (id) navigationRef.navigate('Main', { screen: 'HomeTab', params: { screen: 'Detail', params: { id } } });
  else navigationRef.navigate('Main', { screen: 'RegsTab', params: { screen: 'Registrations', params: { attention: false } } });
}

export function RootNavigator() {
  const status = useSession((s) => s.status);
  const onboarded = useSession((s) => s.onboarded);
  const insets = useSafeAreaInsets();
  const main = status === 'signedIn' && onboarded;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <NavigationContainer ref={navigationRef} theme={theme}>
        <Root.Navigator screenOptions={{ ...stackOpts, animation: 'default' }}>
          {status !== 'signedIn' ? (
            <>
              <Root.Screen name="Login" component={LoginScreen} options={{ animationTypeForReplace: 'pop' }} />
              <Root.Screen name="Register" component={RegisterScreen} />
              <Root.Screen name="MagicLink" component={MagicLinkScreen} />
            </>
          ) : !onboarded ? (
            <Root.Screen name="Onboarding" component={OnboardingScreen} />
          ) : (
            <Root.Screen name="Main" component={MainTabs} />
          )}
        </Root.Navigator>
        {main ? <ConfirmSheet onRequestCorrection={(c) => void openRegistrationFor(c)} /> : null}
      </NavigationContainer>
      <Toast bottom={(main ? tabBarHeight(insets) : insets.bottom) + 20} />
    </View>
  );
}
