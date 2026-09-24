import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronLeft, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '../../api/client';
import { Button, Field, Icon } from '../../components';
import { useT } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import { register } from '../../services/session';
import { useAuthUi } from '../../state/ui';
import { colors, fonts } from '../../theme';
import { isEmail } from './LoginScreen';

/** 02 Register */
export function RegisterScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Register'>) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const email = useAuthUi((s) => s.email);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; code?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = t.nameInvalid;
    if (!isEmail(email)) e.email = t.emailInvalid;
    setErrors(e);
    if (e.name || e.email) return;
    setBusy(true);
    try {
      const r = await register(name.trim(), email.trim(), code.trim() || null);
      navigation.navigate('MagicLink', { email: email.trim(), devToken: r.devToken, name: name.trim(), code: code.trim() || null });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 0) setErrors({ form: t.offline });
        else setErrors({ name: err.fields?.name, email: err.fields?.email, code: err.fields?.companyCode ?? err.fields?.code, form: err.fields ? undefined : err.message });
      } else setErrors({ form: t.signInFailed });
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 16, gap: 28 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -6, padding: 4, opacity: pressed ? 0.5 : 1 })}>
          <Icon icon={ChevronLeft} size={22} stroke={2} color={colors.accent700} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.accent700 }}>{t.signIn}</Text>
        </Pressable>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.condSemibold, fontSize: 36, lineHeight: 39, color: colors.text }}>{t.regTitle}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted }}>{t.regSub}</Text>
        </View>
        <View style={{ gap: 14 }}>
          <Field label={t.nameLabel} value={name} onChangeText={setName} placeholder={t.namePh} autoComplete="name" textContentType="name" autoCapitalize="words" error={errors.name} />
          <Field label={t.emailLabel} value={email} onChangeText={(v) => useAuthUi.setState({ email: v })} placeholder={t.emailPh} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" error={errors.email} />
          <Field label={t.codeLabel} value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder={t.codePh} mono autoCapitalize="characters" autoCorrect={false} help={t.codeHelp} error={errors.code} />
          {errors.form ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.accent800 }}>{errors.form}</Text> : null}
        </View>
        <Button label={t.sendMagic} icon={Mail} onPress={submit} loading={busy} style={{ marginTop: 'auto' }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
