import * as WebBrowser from 'expo-web-browser';

import { api, ApiError } from '../../api/client';
import type { Dict } from '../../i18n';
import { useAuthUi } from '../../state/ui';
import { handleAuthUrl } from '../../navigation/deepLinks';

/**
 * Company SSO: ask the API which IdP belongs to this email (json=1, so an unknown domain comes back as an
 * error instead of an error page in the browser), then run the auth session. The API finishes by redirecting
 * to timo://auth?session=… (or ?error=…), which the auth session hands back to us.
 */
export async function signInWithSso(email: string, t: Dict) {
  useAuthUi.setState({ problem: null });
  let url: string;
  try {
    const q = `email=${encodeURIComponent(email)}&client=app&json=1`;
    ({ url } = await api<{ url: string }>(`/api/auth/sso/start?${q}`));
  } catch (e) {
    const message = e instanceof ApiError ? (e.code === 'sso_unknown' ? t.ssoUnknown : e.status === 0 ? t.offline : e.message) : t.ssoFailed;
    useAuthUi.setState({ problem: { kind: 'sso', message } });
    return;
  }
  const res = await WebBrowser.openAuthSessionAsync(url, 'timo://auth');
  if (res.type === 'success' && res.url) await handleAuthUrl(res.url);
}
