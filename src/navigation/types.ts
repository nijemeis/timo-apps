import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  MagicLink: { email: string; devToken?: string; name?: string; code?: string | null };
};

/** Both the Home and Registrations tabs host their own detail + correction screens (tab bar stays visible). */
export type TabStackParamList = {
  Home: undefined;
  Registrations: { attention?: boolean } | undefined;
  Detail: { id: string };
  Correction: { id?: string; missing?: boolean };
};

export type TabParamList = {
  HomeTab: NavigatorScreenParams<TabStackParamList> | undefined;
  RegsTab: NavigatorScreenParams<TabStackParamList> | undefined;
  ProfileTab: undefined;
};

export type RootStackParamList = AuthStackParamList & {
  Onboarding: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
};
