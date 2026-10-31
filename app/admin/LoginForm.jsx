// /app/admin/LoginForm.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from './actions';

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await login(password).catch(() => ({ error: 'Could not reach the server.' }));
    if (result?.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    router.refresh();
  };

  return (
    <main className="max-w-sm mx-auto px-4 py-24">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="Password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 px-3 py-2 text-lg outline-none focus:border-black"
        />
        <button type="submit" disabled={busy || !password} className="bg-black text-white py-2 disabled:opacity-40">
          {busy ? 'checking…' : 'log in'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
