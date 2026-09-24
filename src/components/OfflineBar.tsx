import { CloudOff } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useT } from '../i18n';
import { usePresence } from '../services/presence';
import { useNet } from '../state/ui';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';

/** Offline indicator: surface fill, hairline, 4px radius; also counts events still queued on the phone. */
export function OfflineBar() {
  const t = useT();
  const offline = useNet((s) => s.offline);
  const queued = usePresence((s) => s.native?.queued ?? 0);
  if (!offline) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: 4 }}>
      <Icon icon={CloudOff} size={18} color={colors.muted} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.text }}>{t.offline}</Text>
        {queued > 0 ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted }}>{t.offlineQueued(queued)}</Text> : null}
      </View>
    </View>
  );
}
