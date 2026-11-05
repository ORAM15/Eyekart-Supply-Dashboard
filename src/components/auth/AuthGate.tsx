import React, { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserSession } from '../../types/index.js';
import {
  getAccessToken,
  getAuthChangeEventName,
  getCurrentVerifiedAuthUser,
  getLiveApiBase,
  getSupabasePublicConfig,
  getStoredSession,
  signInWithPassword,
  signOutFromSupabase,
  signUpWithPassword,
} from '../../services/auth.js';

interface AuthGateProps {
  children: (user: UserSession) => ReactNode;
}

interface ServerProfile {
  id: string;
  display_name: string;
  email: string;
  role: UserSession['role'];
  assigned_branch_id?: string | null;
  is_active: boolean;
}

const roleTitle: Record<UserSession['role'], string> = {
  ADMIN: 'Stock Administrator',
  RECEPTIONIST: 'Inventory Receptionist',
  BRANCH_USER: 'Branch Supervisor',
};

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<UserSession | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const loadProfile = useCallback(async () => {
    setError('');
    const authUser = await getCurrentVerifiedAuthUser();
    if (!authUser) {
      setProfile(null);
      setSessionReady(true);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setProfile(null);
      setSessionReady(true);
      return;
    }

    const { url, publishableKey } = getSupabasePublicConfig();
    const response = await fetch(`${getLiveApiBase()}/me`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.user) {
      setProfile(null);
      setError(
        response.status === 403
          ? 'This EyeKart account is inactive. An administrator must reactivate it before access is granted.'
          : payload.error || 'Could not verify your EyeKart profile. Please try again.'
      );
      setSessionReady(true);
      return;
    }

    const row = payload.user as ServerProfile;
    if (!row.is_active) {
      await signOutFromSupabase();
      setProfile(null);
      setError('This EyeKart account is inactive. Contact the account administrator.');
      setSessionReady(true);
      return;
    }

    setProfile({
      id: row.id,
      name: row.display_name,
      email: row.email || authUser.email,
      role: row.role,
      title: roleTitle[row.role],
      ...(row.assigned_branch_id ? { assignedBranchId: row.assigned_branch_id } : {}),
    });
    setInfo('');
    setSessionReady(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      if (!getStoredSession()) {
        if (mounted) setSessionReady(true);
        return;
      }
      await loadProfile();
      if (!mounted) return;
    };

    const onAuthChanged = () => {
      const existing = getStoredSession();
      if (!existing) {
        setProfile(null);
        setSessionReady(true);
        return;
      }
      setSessionReady(false);
      void loadProfile();
    };

    void initialize();
    window.addEventListener(getAuthChangeEventName(), onAuthChanged);
    return () => {
      mounted = false;
      window.removeEventListener(getAuthChangeEventName(), onAuthChanged);
    };
  }, [loadProfile]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your EyeKart account email and password.');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Enter your name so stock changes can be recorded against you.');
        return;
      }
      if (password.length < 6) {
        setError('Choose a password of at least 6 characters.');
        return;
      }
    }
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signup') {
        const result = await signUpWithPassword(name, email, password);
        if (result.needsConfirmation) {
          setInfo('Account created. Check your email for a confirmation link, then sign in.');
          setMode('signin');
          setPassword('');
          return;
        }
        setInfo('Account created — welcome to EyeKart Supply.');
      } else {
        await signInWithPassword(email, password);
      }
      // The auth event updates the gate too; loading inline avoids flashing the login screen.
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please verify your credentials.');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
        <div className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-sm font-semibold">Verifying EyeKart access…</p>
        </div>
      </div>
    );
  }

  if (profile) return <>{children(profile)}</>;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:p-9 shadow-2xl">
        <div className="flex items-center gap-3 mb-7">
          <div className="h-12 w-12 rounded-2xl bg-teal-600 flex items-center justify-center text-xl font-black">E</div>
          <div>
            <h1 className="text-lg font-black tracking-tight">EyeKart Supply</h1>
            <p className="text-xs text-slate-400">Secure stock management · Kenya</p>
          </div>
        </div>
        <h2 className="text-2xl font-black">{mode === 'signup' ? 'Create your account' : 'Sign in'}</h2>
        <p className="mt-2 mb-6 text-sm text-slate-400">
          {mode === 'signup'
            ? 'Anyone on the EyeKart team can create an account. The first account becomes the stock administrator; everyone after that joins as inventory receptionist.'
            : 'Use your EyeKart account. New to the team? Create an account below.'}
        </p>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-700/60 bg-rose-950/60 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        {info && <p className="mb-4 text-sm text-teal-300">{info}</p>}

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="eyekart-name" className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">Your name</label>
              <input
                id="eyekart-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                placeholder="e.g. Wanjiru Kamau"
              />
            </div>
          )}
          <div>
            <label htmlFor="eyekart-email" className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">Work email</label>
            <input
              id="eyekart-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              placeholder="name@eyekart.co.ke"
            />
          </div>
          <div>
            <label htmlFor="eyekart-password" className="block mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-300">Password</label>
            <input
              id="eyekart-password"
              type="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your account password'}
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-teal-500 px-4 py-3 font-extrabold text-slate-950 transition-colors hover:bg-teal-400 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Verifying account…' : mode === 'signup' ? 'Create account' : 'Sign in securely'}
          </button>
        </form>
        <p className="mt-5 text-xs leading-relaxed text-slate-500">
          {mode === 'signup'
            ? 'Your name is recorded on every stock change you make, so the audit trail always shows who did what.'
            : 'Every stock change is recorded against the signed-in member, so the audit trail always shows who did what.'}
        </p>
        <button
          type="button"
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo(''); setPassword(''); }}
          className="mt-4 w-full text-xs font-semibold text-teal-300 hover:text-white"
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New to the team? Create an account'}
        </button>
        <button
          type="button"
          onClick={() => { setEmail(''); setPassword(''); setName(''); setError(''); setInfo(''); }}
          className="mt-2 w-full text-xs text-slate-400 hover:text-white"
        >
          Clear fields
        </button>
      </div>
    </div>
  );
};
