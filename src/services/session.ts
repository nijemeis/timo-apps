import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { api, ApiError, setApiLocale, setApiToken, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, MeResponse } from '../api/types';

export type Lang = 'en' | 'nl';

export interface Prefs {
  sounds: boolean;
  notifications: boolean;
  /** null = follow the device language */
  lang: Lang | null;
}

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  token: string | null;
  me: MeResponse | null;
  deviceId: string | null;
  onboarded: boolean;
  prefs: Prefs;
  /** The language the UI should render in. */
  lang: Lang;
}

const TOKEN_KEY = 'timo.session';
const INSTALL_KEY = 'timo.installId';
const PREFS_KEY = 'timo.prefs';
const ONBOARDED_KEY = 'timo.onboarded';

const deviceLang = (): Lang => (getLocales()[0]?.languageCode === 'nl' ? 'nl' : 'en');
const DEFAULT_PREFS: Prefs = { sounds: true, notifications: true, lang: null };

export const useSession = create<SessionState>(() => ({
  status: 'loading',
  token: null,
  me: null,
  deviceId: null,
  onboarded: false,
  prefs: DEFAULT_PREFS,
  lang: deviceLang(),
}));

async function installId(): Promise<string> {
  let id = await SecureStore.getItemAsync(INSTALL_KEY);
  if (!id) {
    id = `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(INSTALL_KEY, id);
  }
  return id;
}

async function registerDevice(): Promise<string | null> {
  try {
    const r = await api<{ deviceId: string }>('/api/devices', {
      body: {
        installId: await installId(),
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        model: Device.modelName ?? null,
        appVersion: Application.nativeApplicationVersion ?? null,
      },
    });
    return r.deviceId;
  } catch {
    return null;
  }
}

function applyLang(prefs: Prefs, me: MeResponse | null) {
  const lang: Lang = prefs.lang ?? ((me?.user.locale as Lang | null) || deviceLang());
  setApiLocale(lang);
  return lang;
}

async function establish(token: string) {
  setApiToken(token);
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  const me = await api<MeResponse>('/api/me');
  const deviceId = await registerDevice();
  const onboarded = (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
  const prefs = useSession.getState().prefs;
  useSession.setState({ status: 'signedIn', token, me, deviceId, onboarded, lang: applyLang(prefs, me) });
}

/** App start: restore prefs and the stored session. */
export async function bootstrap() {
  setUnauthorizedHandler(() => { void signOut(); });
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  const prefs: Prefs = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  useSession.setState({ prefs, lang: applyLang(prefs, null) });
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) { useSession.setState({ status: 'signedOut' }); return; }
  try {
    await establish(token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) {
      // Offline at launch: keep the session; screens show cached/empty data until the network is back.
      setApiToken(token);
      const onboarded = (await AsyncStorage.getItem(ONBOARDED_KEY)) === '1';
      useSession.setState({ status: 'signedIn', token, onboarded });
      return;
    }
    await signOut();
  }
}

/** Ask for a sign-in link. Returns the dev token when the server allows the shortcut. */
export async function requestMagicLink(email: string) {
  return api<{ ok: true; devToken?: string }>('/api/auth/magic-link', { body: { email, client: 'app' } });
}

export async function register(name: string, email: string, companyCode: string | null) {
  return api<{ ok: true; devToken?: string }>('/api/auth/register', {
    body: { name, email, companyCode: companyCode || null, locale: useSession.getState().lang, client: 'app' },
  });
}

/** Exchange a magic-link token (from timo://auth?token=… or the dev shortcut) for a session. */
export async function signInWithLink(magicToken: string) {
  const r = await api<AuthResponse>('/api/auth/verify', { body: { token: magicToken } });
  await establish(r.token);
}

/** SSO finishes with a ready session token (timo://auth?session=…). */
export async function signInWithSession(sessionToken: string) {
  await establish(sessionToken);
}

export async function refreshMe() {
  const me = await api<MeResponse>('/api/me');
  useSession.setState({ me, lang: applyLang(useSession.getState().prefs, me) });
  return me;
}

export async function joinCompany(code: string) {
  const me = await api<MeResponse>('/api/me/join', { body: { code } });
  useSession.setState({ me });
  return me;
}

export async function setOnboarded() {
  await AsyncStorage.setItem(ONBOARDED_KEY, '1');
  useSession.setState({ onboarded: true });
}

export async function setPrefs(patch: Partial<Prefs>) {
  const prefs = { ...useSession.getState().prefs, ...patch };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  const lang = applyLang(prefs, useSession.getState().me);
  useSession.setState({ prefs, lang });
  if (patch.lang) api('/api/me', { method: 'PATCH', body: { locale: patch.lang } }).catch(() => {});
}

export async function signOut() {
  const { token } = useSession.getState();
  if (token) api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  const { resetPresence } = await import('./presence');
  await resetPresence();
  setApiToken(null);
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await AsyncStorage.removeItem(ONBOARDED_KEY);
  useSession.setState({ status: 'signedOut', token: null, me: null, deviceId: null, onboarded: false });
}
