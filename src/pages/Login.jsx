import React, { useState } from 'react';

const BASE = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:4000';

export default function Login({ onAuth }) {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [form, setForm] = useState({ name: '', email: '', password: '', token: '', newPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const res = await fetch(`${BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        if (data.resetToken) setResetToken(data.resetToken);
        setSuccess('Reset token generated. Check below to reset your password.');
        setMode('reset');
      } else if (mode === 'reset') {
        const tokenToUse = form.token || resetToken;
        const res = await fetch(`${BASE}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenToUse, newPassword: form.newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        setSuccess('Password reset! You can now sign in.');
        setMode('login');
        setResetToken('');
      } else {
        const res = await fetch(`${BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        localStorage.setItem('token', data.token);
        onAuth(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(newMode) {
    setMode(newMode);
    setError('');
    setSuccess('');
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1F4E79 0%, #2E75B6 100%)',
    }}>
      <div style={{
        background: 'white', borderRadius: 12, padding: '2.5rem', width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem' }}>🏗️</div>
          <h1 style={{ margin: '0.5rem 0 0', color: '#1F4E79', fontSize: '1.4rem', fontWeight: 700 }}>
            ACREs
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            Acquisition, Capital, Risk & Evaluation
          </p>
        </div>

        <form onSubmit={submit}>
          {(mode === 'login' || mode === 'forgot') && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={set('email')} required placeholder="you@example.com" />
            </div>
          )}

          {mode === 'login' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" value={form.password} onChange={set('password')} required placeholder="••••••••" />
            </div>
          )}

          {mode === 'reset' && (
            <>
              {!resetToken && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Reset Token</label>
                  <input style={inputStyle} type="text" value={form.token} onChange={set('token')} required placeholder="Paste your reset token" />
                </div>
              )}
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>New Password</label>
                <input style={inputStyle} type="password" value={form.newPassword} onChange={set('newPassword')} required placeholder="Enter new password" />
              </div>
            </>
          )}

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '1rem', marginTop: '-0.5rem' }}>
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                style={{ background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <div style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: '#D1FAE5', color: '#065F46', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.85rem' }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Please wait…'
              : mode === 'login' ? 'Sign In'
              : mode === 'forgot' ? 'Send Reset Token'
              : 'Reset Password'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: '#666' }}>
          {(mode === 'forgot' || mode === 'reset') && (
            <>Remember your password?{' '}
              <button onClick={() => switchMode('login')} style={linkBtnStyle}>Sign In</button>
            </>
          )}
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
const linkBtnStyle = {
  background: 'none', border: 'none', color: '#2E75B6', cursor: 'pointer', fontWeight: 600, padding: 0,
};
