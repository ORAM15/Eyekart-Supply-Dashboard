export interface EyeKartAuthUser {
  id: string;
  email: string;
}

export interface EyeKartAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: EyeKartAuthUser;
}

const STORAGE_KEY = 'eyekart.auth.session.v1';
const AUTH_EVENT = 'eyekart-auth-change';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export function isLiveCrudConfigured(): boolean {
  return import.meta.env.VITE_EYEKART_LIVE_MODE === 'true' &&
    Boolean(supabaseUrl) &&
    Boolean(publishableKey);
}

function announceAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT));
  }
}

export function getAuthChangeEventName() {
  return AUTH_EVENT;
}

export function getStoredSession(): EyeKartAuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EyeKartAuthSession;
    if (!parsed.access_token || !parsed.refresh_token || !parsed.user?.id) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function storeSession(payload: any): EyeKartAuthSession {
  const session: EyeKartAuthSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: typeof payload.expires_at === 'number'
      ? payload.expires_at * 1000
      : Date.now() + Number(payload.expires_in || 3600) * 1000,
    user: {
      id: payload.user.id,
      email: payload.user.email || '',
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  announceAuthChange();
  return session;
}

async function authRequest(path: string, body?: Record<string, unknown>, token?: string) {
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Live authentication is not configured for EyeKart yet.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.msg === 'string'
      ? payload.msg
      : typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error_description === 'string'
          ? payload.error_description
          : 'Authentication request failed.';
    throw new Error(message);
  }
  return payload;
}

export async function signInWithPassword(email: string, password: string): Promise<EyeKartAuthSession> {
  const payload = await authRequest('token?grant_type=password', { email: email.trim(), password });
  return storeSession(payload);
}

export async function getAccessToken(): Promise<string | null> {
  const session = getStoredSession();
  if (!session) return null;

  // Refresh before expiry to avoid a save failing partway through an editing session.
  if (session.expires_at > Date.now() + 60_000) return session.access_token;

  try {
    const payload = await authRequest('token?grant_type=refresh_token', {
      refresh_token: session.refresh_token,
    });
    return storeSession(payload).access_token;
  } catch {
    await clearLocalSession();
    return null;
  }
}

export async function getCurrentVerifiedAuthUser(): Promise<EyeKartAuthUser | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const payload = await authRequest('user', undefined, token);
    return { id: payload.id, email: payload.email || '' };
  } catch {
    await clearLocalSession();
    return null;
  }
}

export async function signOutFromSupabase(): Promise<void> {
  const session = getStoredSession();
  if (session) {
    try {
      await authRequest('logout', undefined, session.access_token);
    } catch {
      // Clear the local session even if network logout fails.
    }
  }
  await clearLocalSession();
}

async function clearLocalSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY);
    announceAuthChange();
  }
}

export function getSupabasePublicConfig() {
  return {
    url: supabaseUrl,
    publishableKey,
  };
}
