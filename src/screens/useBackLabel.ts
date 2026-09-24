import { useNavigation } from '@react-navigation/native';

import { useT } from '../i18n';

/** iOS back-button label = the previous screen's title in this tab's stack. */
export function useBackLabel(): string {
  const t = useT();
  const nav = useNavigation();
  const st = nav.getState();
  const prev = st && st.index > 0 ? st.routes[st.index - 1]?.name : undefined;
  return prev === 'Home' ? t.tabHome : prev === 'Registrations' ? t.regs : prev === 'Detail' ? t.detail : t.back;
}
