import { forwardRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { colors, fonts, type } from '../theme';

interface Props extends TextInputProps {
  label?: string;
  help?: string;
  error?: string | null;
  mono?: boolean;
  right?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/** Labelled input: 48h, surface fill, hairline border, 4px radius; accent border on focus. */
export const Field = forwardRef<TextInput, Props>(function Field({ label, help, error, mono, right, containerStyle, inputStyle, multiline, onFocus, onBlur, ...rest }, ref) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <View style={[s.box, multiline && s.multi, { borderColor: focus || error ? colors.accent : colors.divider }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(e) => { setFocus(true); onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={[s.input, mono && s.mono, multiline && s.multiInput, inputStyle]}
          {...rest}
        />
        {right}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : help ? <Text style={s.help}>{help}</Text> : null}
    </View>
  );
});

const s = StyleSheet.create({
  box: { minHeight: 48, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderRadius: 4 },
  multi: { minHeight: 88, alignItems: 'stretch' },
  input: { flex: 1, height: 46, paddingHorizontal: 12, paddingVertical: 0, fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  multiInput: { height: undefined, minHeight: 86, paddingTop: 10, paddingBottom: 10 },
  mono: { fontFamily: fonts.mono, letterSpacing: 16 * 0.06 },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  error: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.accent800 },
});
