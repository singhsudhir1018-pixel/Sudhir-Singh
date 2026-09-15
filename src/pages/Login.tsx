import React from 'react';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { language } = useAppStore();
  const t = translations[language];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (auth.app.options.apiKey === 'dummy-key') {
        // Fallback for UI preview if no Firebase Config is set
        useAppStore.getState().setUser({
          uid: 'dummy',
          name: 'Demo Admin',
          email,
          role: 'ADMIN',
          farmId: 'farm1',
          languagePref: 'en'
        });
        return;
      }
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-green-700 mb-2">{t.appTitle}</h1>
          <p className="text-stone-500">{t.login}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-70"
          >
            {loading ? '...' : t.login}
          </button>
        </form>

        {auth.app.options.apiKey === 'dummy-key' && (
          <div className="mt-6 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
            <strong>Note:</strong> Firebase is not configured. Clicking Login will sign you in with a demo account. To use real Auth, configure .env.example.
          </div>
        )}
      </div>
    </div>
  );
}
