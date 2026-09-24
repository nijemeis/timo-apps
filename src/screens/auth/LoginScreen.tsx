import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Building2, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { BrandMark, Button, Field, TextLink } from '../../components';
import { useT } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { requestMagicLink } from '../../services/session';
import { useAuthUi } from '../../state/ui';
import { colors, fonts } from '../../theme';
import { AuthProblemNotice } from './AuthProblem';
import { signInWithSso } from './sso';

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** 01 Login */
export function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Login'>) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const email = useAuthUi((s) => s.email);
  const setEmail = (v: string) => useAuthUi.setState({ email: v });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'link' | 'sso' | null>(null);

  const sendLink = async () => {
    if (!isEmail(email)) { setError(t.emailInvalid); return; }
    setError(null); setBusy('link');
    try {
      const r = await requestMagicLink(email.trim());
      useAuthUi.setState({ problem: null });
      navigation.navigate('MagicLink', { email: email.trim(), devToken: r.devToken });
    } catch (e) {
      setError(e instanceof ApiError ? (e.status === 0 ? t.offline : e.fields?.email ?? e.message) : t.signInFailed);
    } finally { setBusy(null); }
  };

  const sso = async () => {
    if (!isEmail(email)) { setError(t.ssoNeedEmail); return; }
    setError(null); setBusy('sso');
    try { await signInWithSso(email.trim(), t); } finally { setBusy(null); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 56, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 16, gap: 36 }}>
        <View style={{ gap: 18 }}>
          <BrandMark />
          <Text style={{ fontFamily: fonts.condSemibold, fontSize: 34, lineHeight: 37, color: colors.text }}>{t.tagline}</Text>
        </View>
        <View style={{ gap: 14 }}>
          <AuthProblemNotice />
          <Field
            label={t.emailLabel}
            value={email}
            onChangeText={(v) => { setEmail(v); if (error) setError(null); }}
            placeholder={t.emailPh}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={sendLink}
            error={error}
          />
          <Button label={t.sendLink} icon={Mail} onPress={sendLink} loading={busy === 'link'} disabled={busy === 'sso'} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.subtle }}>{t.or}</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          </View>
          <Button variant="secondary" label={t.sso} icon={Building2} onPress={sso} loading={busy === 'sso'} disabled={busy === 'link'} />
        </View>
        <View style={{ marginTop: 'auto', flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted }}>{t.noAccount}</Text>
          <TextLink label={t.register} bold fontSize={15} onPress={() => navigation.navigate('Register')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
