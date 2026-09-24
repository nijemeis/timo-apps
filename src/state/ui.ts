import { create } from 'zustand';

import { ApiError } from '../api/client';
import type { RegistrationDTO, SummaryResponse } from '../api/types';

/** Dark toast (2.6 s). */
export const useToast = create<{ message: string | null; id: number }>(() => ({ message: null, id: 0 }));
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(message: string, ms = 2600) {
  if (toastTimer) clearTimeout(toastTimer);
  useToast.setState((s) => ({ message, id: s.id + 1 }));
  toastTimer = setTimeout(() => useToast.setState({ message: null }), ms);
}

/** Connectivity as seen by the last API calls (api() throws ApiError status 0 when there is no network). */
export const useNet = create<{ offline: boolean }>(() => ({ offline: false }));
export function noteApiResult(e?: unknown) {
  const offline = e instanceof ApiError && e.status === 0;
  if (useNet.getState().offline !== offline && (offline || e === undefined)) useNet.setState({ offline });
}

export type AuthProblem =
  | { kind: 'link'; code: 'link_expired' | 'link_used' | 'link_invalid' | string }
  | { kind: 'sso'; message: string }
  | { kind: 'other'; message: string };

/** Sign-in problems surfaced on the Login / Magic-link screens (from deep links or the SSO session). */
export const useAuthUi = create<{ problem: AuthProblem | null; email: string }>(() => ({ problem: null, email: '' }));

/** Last known home summary (kept for offline) and registrations seen, for instant detail rendering. */
export const useCache = create<{ summary: SummaryResponse | null; summaryAt: number; regs: Record<string, RegistrationDTO> }>(() => ({ summary: null, summaryAt: 0, regs: {} }));
export function cacheRegs(list: (RegistrationDTO | null | undefined)[]) {
  const regs = { ...useCache.getState().regs };
  for (const r of list) if (r) regs[r.id] = r;
  useCache.setState({ regs });
}
