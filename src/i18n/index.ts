import { useSession, type Lang } from '../services/session';
import en, { type Dict } from './en';
import nl from './nl';

export type { Dict };
export const dictionaries: Record<Lang, Dict> = { en, nl };

/** The dictionary for the language the UI renders in (prefs → account locale → device). */
export function useT(): Dict {
  const lang = useSession((s) => s.lang);
  return dictionaries[lang] ?? en;
}

export const useLang = () => useSession((s) => s.lang);
export const tFor = (lang: Lang): Dict => dictionaries[lang] ?? en;
