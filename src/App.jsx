import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BuilderManager from './pages/BuilderManager';
import CashFlow from './pages/CashFlow';
import Login from './pages/Login';

const IS_LOCAL = process.env.REACT_APP_LOCAL_DEV === 'true';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (IS_LOCAL) {
      setUser({ name: 'Dev User', email: 'dev@local' });
      return;
    }
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.sub, name: payload.name, email: payload.email });
        } else {
          localStorage.removeItem('token');
        }
      } catch {
        localStorage.removeItem('token');
      }
    }
  }, []);

  function handleAuth(user) {
    setUser(user);
  }

  function signOut() {
    localStorage.removeItem('token');
    setUser(null);
  }

  if (!user) return <Login onAuth={handleAuth} />;

  return (
    <AppProvider>
      <BrowserRouter>
        <Layout signOut={signOut} user={user}>
          <Routes>
            <Route path="/"          element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/builders"  element={<BuilderManager />} />
            <Route path="/cashflow"  element={<CashFlow />} />
            <Route path="*"          element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
