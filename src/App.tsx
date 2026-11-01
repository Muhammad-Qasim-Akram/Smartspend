import { createContext, useContext, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, getErrorMessage } from './api';
import { Overview, Expenses, Budgets, Reports } from './pages';

interface User {
  firstName?: string | null;
  name?: string | null;
  email: string;
}

interface LoginForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User;
}

const Auth = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue | null {
  return useContext(Auth);
}

interface LogoProps {
  s?: number;
}

export function Logo({ s = 34 }: LogoProps) {
  return (
    <svg width={s} height={s * 0.58} viewBox="0 0 48 28" fill="none" aria-hidden="true">
      <path
        d="M24 14C20 7 16 5 12 5a9 9 0 1 0 0 18c4 0 8-2 12-9s8-9 12-9a9 9 0 1 1 0 18c-4 0-8-2-12-9z"
        stroke="#2A63D6"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LoginProps {
  onDone: () => Promise<void>;
}

function Login({ onDone }: LoginProps) {
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState<LoginForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setField = (key: keyof LoginForm) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (registering) {
        await api('/auth/register', { method: 'POST', body: form });
      }
      await api('/auth/login', {
        method: 'POST',
        body: { email: form.email, password: form.password },
      });
      await onDone();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand"><Logo />smartspend</div>
        <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
        {registering && (
          <div className="two">
            <label>First name<input required value={form.firstName} onChange={setField('firstName')} /></label>
            <label>Last name<input value={form.lastName} onChange={setField('lastName')} /></label>
          </div>
        )}
        <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={setField('email')} /></label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={registering ? 8 : 1}
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={form.password}
            onChange={setField('password')}
          />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : registering ? 'Sign up' : 'Sign in'}</button>
        <button
          type="button"
          className="link"
          onClick={() => {
            setRegistering(!registering);
            setError('');
          }}
        >
          {registering ? 'Have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </main>
  );
}

const navigation = [
  ['/', 'Overview'],
  ['/expenses', 'Expenses'],
  ['/budgets', 'Budgets'],
  ['/reports', 'Reports'],
] as const;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const loadUser = async (): Promise<void> => {
    try {
      setUser(await api<User>('/auth/me'));
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    void loadUser();
    const handleUnauthenticated = () => setUser(null);
    window.addEventListener('unauth', handleUnauthenticated);
    return () => window.removeEventListener('unauth', handleUnauthenticated);
  }, []);

  const signOut = async (): Promise<void> => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Signing out locally still clears the session if the server is unavailable.
    }
    setUser(null);
  };

  if (!ready) return <div className="splash"><Logo s={56} /></div>;
  if (!user) return <Login onDone={loadUser} />;

  return (
    <Auth.Provider value={{ user }}>
      <div className="shell">
        <div className="top">
          <div className="brand"><Logo />smartspend</div>
          <div className="who">
            <span>Hi, {user.firstName ?? user.name ?? user.email}</span>
            <button className="btn ghost" onClick={signOut}>Sign out</button>
          </div>
        </div>
        <nav className="pill" aria-label="Main">
          {navigation.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className="tab">{label}</NavLink>
          ))}
        </nav>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Auth.Provider>
  );
}
