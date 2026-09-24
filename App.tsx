import { BarlowCondensed_500Medium } from '@expo-google-fonts/barlow-condensed/500Medium';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { handleAuthUrl } from './src/navigation/deepLinks';
import { RootNavigator } from './src/navigation/RootNavigator';
import { syncPresence } from './src/services/presence';
import { bootstrap, useSession } from './src/services/session';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, BarlowCondensed_500Medium, BarlowCondensed_600SemiBold });
  const status = useSession((s) => s.status);
  const onboarded = useSession((s) => s.onboarded);
  const companyId = useSession((s) => s.me?.company?.id ?? null);
  const lang = useSession((s) => s.lang);
  const sounds = useSession((s) => s.prefs.sounds);
  const notifications = useSession((s) => s.prefs.notifications);
  const [booted, setBooted] = useState(false);

  // Restore the session, then process a link the app was opened with (timo://auth?token=… / ?session=…).
  useEffect(() => {
    let alive = true;
    (async () => {
      try { await bootstrap(); } catch { useSession.setState({ status: 'signedOut' }); }
      if (!alive) return;
      setBooted(true);
      await handleAuthUrl(await Linking.getInitialURL());
    })();
    const sub = Linking.addEventListener('url', ({ url }) => { void handleAuthUrl(url); });
    return () => { alive = false; sub.remove(); };
  }, []);

  const ready = booted && status !== 'loading' && (fontsLoaded || !!fontError);
  useEffect(() => { if (ready) SplashScreen.hide(); }, [ready]);

  // (Re)configure the presence engine after sign-in / onboarding / joining a company and when the
  // notification language or toggles change. syncPresence is a no-op until signed in and onboarded.
  useEffect(() => {
    if (status === 'signedIn' && onboarded) void syncPresence();
  }, [status, onboarded, companyId, lang, sounds, notifications]);

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
