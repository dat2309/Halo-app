import React, { useState } from 'react';

import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { login, loading } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(identifier.trim(), password);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Login failed');
    }
  };

  return (
    <div className="page-center">
      <form className="card" onSubmit={submit}>
        <h1>Halo Web</h1>
        <p className="muted">Sign in to test chat &amp; video call</p>

        <label>
          Email or phone
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="user@example.com or 0123456789"
            autoFocus
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
