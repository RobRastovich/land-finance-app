import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

const BASE = process.env.REACT_APP_API_ENDPOINT || 'http://localhost:4000';

export default function Register({ onAuth }) {
  const { inviteToken } = useParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, invite_token: inviteToken }),
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
        background: 'white', borderRadius: 12, padding: '2.5rem', width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem' }}>🏗️</div>
          <h1 style={{ margin: '0.5rem 0 0', color: '#1F4E79', fontSize: '1.4rem', fontWeight: 700 }}>
            ACREs
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            Create Your Account
          </p>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} type="text" value={form.name} onChange={set('name')} required placeholder="Your name" />
          </div>
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
            {loading ? 'Please wait…' : 'Create Account'}
          </button>
        </form>
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
