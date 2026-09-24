import Constants from 'expo-constants';

import type { ApiErrorBody } from './types';

/**
 * Base URL of the Timo API. Set EXPO_PUBLIC_API_URL for a device build against production
 * (e.g. https://timo-xxxx.ondigitalocean.app); app.json `extra.apiUrl` is the local default.
 */
export const API_URL: string = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'http://localhost:3200'
).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
let locale = 'en';

export const setApiToken = (t: string | null) => { token = t; };
export const getApiToken = () => token;
export const setApiLocale = (l: string) => { locale = l; };
/** Called once when any request comes back 401 — the session store signs out. */
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        'Accept-Language': locale,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, 'offline', 'No connection');
  }
  if (res.status === 401 && token) onUnauthorized?.();
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = (json as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'server', e?.message ?? `HTTP ${res.status}`, e?.fields);
  }
  return json as T;
}
