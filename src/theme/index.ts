import { Platform, type TextStyle } from 'react-native';

/** Industry design-system tokens (web/design/README.md → "Design tokens"). Exact values, monochrome palette. */
export const colors = {
  bg: '#f2f2f3',
  surface: '#e9e9ea',
  text: '#1d1f20',
  muted: '#5d5d60', // neutral-700
  subtle: '#7a7a7d', // neutral-600
  divider: 'rgba(29,31,32,.16)',
  corner: '#8b8c8e',
  accent: '#5980a6',
  accent600: '#597ea3',
  accent700: '#416180',
  accent800: '#2c455d',
  accent900: '#1d2d3d',
  accent100: '#eef6ff',
  accent200: '#d6ebff',
  accent300: '#b5d9fd',
  accent400: '#94bce3',
  accent500: '#749dc4',
  neutral200: '#e7e7ea',
  neutral300: '#d4d4d7',
  neutral400: '#b7b7ba',
  neutral500: '#98989b',
  neutral800: '#424244',
  scrim: 'rgba(29,31,32,.32)',
  hover: 'rgba(29,31,32,.07)',
  pressed: 'rgba(29,31,32,.14)',
  rowPressed: 'rgba(29,31,32,.04)',
  ghostPressed: 'rgba(89,128,166,.1)',
  white: '#ffffff',
} as const;

/** One family per weight: custom fonts can't be synthesised with fontWeight on Android. */
export const fonts = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  condMedium: 'BarlowCondensed_500Medium',
  condSemibold: 'BarlowCondensed_600SemiBold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
} as const;

export const isIOS = Platform.OS === 'ios';

/** Hairline = the design's 1px border. */
export const hairline = 1;

export const shadows = {
  sm: { shadowColor: '#2b2b2d', shadowOpacity: 0.14, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#2b2b2d', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  lg: { shadowColor: '#2b2b2d', shadowOpacity: 0.22, shadowRadius: 32, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} as const;

const tnum: TextStyle['fontVariant'] = ['tabular-nums'];

/** Mobile type scale. Letter spacing is em × size (RN takes points). */
export const type = {
  kicker: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.96, textTransform: 'uppercase', color: colors.muted },
  largeTitle: { fontFamily: fonts.condSemibold, fontSize: 36, lineHeight: 40, letterSpacing: -0.36, color: colors.text },
  androidTitle: { fontFamily: fonts.condMedium, fontSize: 24, lineHeight: 30, color: colors.text },
  heading: { fontFamily: fonts.condSemibold, fontSize: 36, lineHeight: 39, color: colors.text },
  greeting: { fontFamily: fonts.condSemibold, fontSize: 32, lineHeight: 35, color: colors.text },
  hero: { fontFamily: fonts.condMedium, fontSize: 64, lineHeight: 64, letterSpacing: -0.64, fontVariant: tnum, color: colors.text },
  numeral: { fontFamily: fonts.condSemibold, fontSize: 28, lineHeight: 34, fontVariant: tnum, color: colors.text },
  rowTime: { fontFamily: fonts.condSemibold, fontSize: 19, lineHeight: 23, fontVariant: tnum, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.text },
  body15: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  secondary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 17, color: colors.muted },
  mono: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  tnum: { fontVariant: tnum },
} satisfies Record<string, TextStyle>;

export const space = { xs: 3.4, sm: 6.8, md: 10.2, lg: 13.6, xl: 20.4, xxl: 27.2, screen: 20 } as const;
