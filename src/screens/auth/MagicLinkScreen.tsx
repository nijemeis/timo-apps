import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Inbox, MailCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { BlueprintCard, Button, Icon, TextLink } from '../../components';
import { useT } from '../../i18n';
import { handleAuthUrl } from '../../navigation/deepLinks';
import type { RootStackParamList } from '../../navigation/types';
import { requestMagicLink } from '../../services/session';
import { showToast, useAuthUi } from '../../state/ui';
import { colors, fonts } from '../../theme';
import { AuthProblemNotice } from './AuthProblem';

/** 03 Magic link sent */
export function MagicLinkScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'MagicLink'>) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { email } = route.params;
  const [devToken, setDevToken] = useState(route.params.devToken);
  const [busy, setBusy] = useState<'resend' | 'demo' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const openMail = async () => {
    // iOS: message: opens Mail's inbox. Android has no inbox URL without an intent launcher; mailto: opens the mail app.
    const url = Platform.OS === 'ios' ? 'message:' : 'mailto:';
    try { await Linking.openURL(url); } catch { setMsg(t.noMailApp); }
  };

  const resend = async () => {
    setBusy('resend'); setMsg(null);
    try {
      const r = await requestMagicLink(email);
      if (r.devToken) setDevToken(r.devToken);
      useAuthUi.setState({ problem: null });
      showToast(t.resent);
    } catch (e) {
      setMsg(e instanceof ApiError && e.status === 0 ? t.offline : e instanceof Error ? e.message : t.signInFailed);
    } finally { setBusy(null); }
  };

  const demo = async () => {
    if (!devToken) return;
    setBusy('demo');
    try { await handleAuthUrl(`timo://auth?token=${encodeURIComponent(devToken)}`); } finally { setBusy(null); }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.bg, paddingTop: insets.top + 72, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 16, gap: 28 }}>
      <BlueprintCard style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
        <Icon icon={MailCheck} size={32} color={colors.accent700} />
      </BlueprintCard>
      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.condSemibold, fontSize: 36, lineHeight: 39, color: colors.text }}>{t.magicTitle}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.muted }}>
          {t.magicSub} <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{email}</Text>. {t.magicExp}
        </Text>
      </View>
      <AuthProblemNotice />
      <View style={{ gap: 12 }}>
        <Button label={t.openMail} icon={Inbox} onPress={openMail} />
        <Button variant="ghost" label={t.resend} onPress={resend} loading={busy === 'resend'} />
        {msg ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.accent800, textAlign: 'center' }}>{msg}</Text> : null}
      </View>
      <View style={{ marginTop: 'auto', gap: 10, alignItems: 'center' }}>
        {devToken ? <Button variant="dashed" label={t.demoOpen} onPress={demo} loading={busy === 'demo'} /> : null}
        <TextLink label={t.useOther} onPress={() => navigation.popToTop()} />
      </View>
    </ScrollView>
  );
}
