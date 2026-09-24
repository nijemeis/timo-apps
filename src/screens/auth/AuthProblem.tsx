import { Link2Off, TriangleAlert } from 'lucide-react-native';

import { Notice } from '../../components';
import { useT } from '../../i18n';
import { useAuthUi } from '../../state/ui';

/** Expired / used / invalid magic link, SSO failure — not designed yet; the info box in its warn tone. */
export function AuthProblemNotice() {
  const t = useT();
  const problem = useAuthUi((s) => s.problem);
  if (!problem) return null;
  if (problem.kind === 'link') {
    const title = problem.code === 'link_expired' ? t.linkExpiredTitle : problem.code === 'link_used' ? t.linkUsedTitle : t.linkInvalidTitle;
    return <Notice tone="warn" icon={Link2Off} title={title}>{t.linkBody}</Notice>;
  }
  return (
    <Notice tone="warn" icon={TriangleAlert} title={problem.kind === 'sso' ? t.ssoErrorTitle : undefined}>
      {problem.message}
    </Notice>
  );
}
