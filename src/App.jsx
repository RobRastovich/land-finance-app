import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import CommunityRoute from './components/CommunityRoute';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import BuilderManager from './pages/BuilderManager';
import CashFlow from './pages/CashFlow';
import Payments from './pages/Payments';
import ProfitLoss from './pages/ProfitLoss';
import Documents from './pages/Documents';
import Login from './pages/Login';
import NewCommunity from './pages/NewCommunity';
import Users from './pages/Users';
import Register from './pages/Register';
import DefaultRedirect from './components/DefaultRedirect';

const IS_LOCAL = process.env.REACT_APP_LOCAL_DEV === 'true';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (IS_LOCAL) {
      setUser({ name: 'Dev User', email: 'dev@local', role: 'admin' });
      return;
    }
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.sub, name: payload.name, email: payload.email, role: payload.role || 'standard' });
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

  if (!user) return (
    <BrowserRouter>
      <Routes>
        <Route path="/register/:inviteToken" element={<Register onAuth={handleAuth} />} />
        <Route path="*" element={<Login onAuth={handleAuth} />} />
      </Routes>
    </BrowserRouter>
  );

  return (
    <AppProvider user={user}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DefaultRedirect />} />
          <Route path="/communities/new" element={<Layout signOut={signOut} user={user}><NewCommunity /></Layout>} />
          <Route path="/users" element={<Layout signOut={signOut} user={user}><Users /></Layout>} />
          <Route path="/communities/:communityId" element={<Layout signOut={signOut} user={user}><CommunityRoute /></Layout>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedRoute module="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="builders"  element={<ProtectedRoute module="builder_manager"><BuilderManager /></ProtectedRoute>} />
            <Route path="cashflow"  element={<ProtectedRoute module="cash_flow"><CashFlow /></ProtectedRoute>} />
            <Route path="payments"  element={<ProtectedRoute module="payments"><Payments /></ProtectedRoute>} />
            <Route path="pnl"       element={<ProtectedRoute module="pnl"><ProfitLoss /></ProtectedRoute>} />
            <Route path="documents" element={<ProtectedRoute module="documents"><Documents /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
