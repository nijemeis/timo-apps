import * as Linking from 'expo-linking';

import { ApiError } from '../api/client';
import { tFor } from '../i18n';
import { signInWithLink, signInWithSession, useSession } from '../services/session';
import { useAuthUi } from '../state/ui';

const handled = new Set<string>();

/**
 * timo://auth?token=…   → magic link (single use, 15 min)
 * timo://auth?session=… → company SSO finished with a ready session
 * timo://auth?error=…   → SSO failed
 * Also accepts the same query on an https universal/app link. Each URL is handled once (Android can deliver
 * the SSO redirect both to the auth session and to the Linking listener).
 */
export async function handleAuthUrl(url: string | null): Promise<void> {
  if (!url || handled.has(url)) return;
  const { hostname, path, queryParams } = Linking.parse(url);
  const q = (queryParams ?? {}) as Record<string, string | undefined>;
  const isAuth = hostname === 'auth' || path === 'auth' || path?.endsWith('/auth') || !!q.token || !!q.session;
  if (!isAuth) return;
  handled.add(url);
  const t = tFor(useSession.getState().lang);
  try {
    if (q.token) {
      useAuthUi.setState({ problem: null });
      await signInWithLink(String(q.token));
    } else if (q.session) {
      useAuthUi.setState({ problem: null });
      await signInWithSession(String(q.session));
    } else if (q.error) {
      useAuthUi.setState({ problem: { kind: 'sso', message: q.error === 'sso_unknown' ? t.ssoUnknown : t.ssoFailed } });
    }
  } catch (e) {
    console.warn('[timo auth]', e);
    if (e instanceof ApiError && e.code.startsWith('link_')) useAuthUi.setState({ problem: { kind: 'link', code: e.code } });
    else if (e instanceof ApiError && e.status === 0) useAuthUi.setState({ problem: { kind: 'other', message: t.offline } });
    else useAuthUi.setState({ problem: { kind: q.session ? 'sso' : 'other', message: q.session ? t.ssoFailed : t.signInFailed } });
  }
}
