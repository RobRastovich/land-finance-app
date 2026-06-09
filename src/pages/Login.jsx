import React, { useState } from 'react';

const BASE = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:4000';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };

      const res = await fetch(`${BASE}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      localStorage.setItem('token', data.token);
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1F4E79 0%, #2E75B6 100%)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: '2.5rem', width: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem' }}>🏘️</div>
          <h1 style={{ margin: '0.5rem 0 0', color: '#1F4E79', fontSize: '1.4rem', fontWeight: 700 }}>
            Melina Community
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            Land Development Management
          </p>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} type="text" value={form.name} onChange={set('name')} required placeholder="Your name" />
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" />
          </div>

          {error && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: '#666' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: 0 }}
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: 4, fontSize: '0.85rem', fontWeight: 600, color: '#374151' };
const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #D1D5DB',
  borderRadius: 6, fontSize: '0.95rem', boxSizing: 'border-box', outline: 'none',
};
const btnStyle = {
  width: '100%', padding: '0.75rem', background: '#1F4E79', color: 'white',
  border: 'none', borderRadius: 6, fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
};
