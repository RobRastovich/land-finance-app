import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsConfig from './aws-config';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BuilderManager from './pages/BuilderManager';
import CashFlow from './pages/CashFlow';

const IS_LOCAL = process.env.REACT_APP_LOCAL_DEV === 'true';

if (!IS_LOCAL) {
  Amplify.configure(awsConfig);
}

const melinaTheme = {
  name: 'melina-theme',
  tokens: {
    colors: {
      brand: {
        primary: {
          10:  { value: '#EBF3FB' },
          20:  { value: '#BDD7EE' },
          40:  { value: '#2E75B6' },
          60:  { value: '#1F4E79' },
          80:  { value: '#153452' },
          90:  { value: '#0D1F33' },
          100: { value: '#060D16' },
        },
      },
    },
  },
};

// ── Local dev wrapper: no Cognito ────────────────────────────
function LocalWrapper({ children }) {
  return children({ signOut: () => {}, user: { signInDetails: { loginId: 'dev@local' } } });
}

// ── Production wrapper: Cognito Authenticator ────────────────
function AuthWrapper({ children }) {
  return (
    <ThemeProvider theme={melinaTheme}>
      <Authenticator
        loginMechanisms={['email']}
        signUpAttributes={['name', 'email']}
        components={{
          Header() {
            return (
              <div style={{
                background: 'linear-gradient(135deg, #1F4E79 0%, #2E75B6 100%)',
                padding: '2rem', textAlign: 'center', borderRadius: '8px 8px 0 0',
              }}>
                <h1 style={{ color: 'white', margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                  🏘️ Melina Community
                </h1>
                <p style={{ color: '#BDD7EE', margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                  Land Development Management
                </p>
              </div>
            );
          },
        }}
      >
        {({ signOut, user }) => children({ signOut, user })}
      </Authenticator>
    </ThemeProvider>
  );
}

const Wrapper = IS_LOCAL ? LocalWrapper : AuthWrapper;

export default function App() {
  return (
    <Wrapper>
      {({ signOut, user }) => (
        <AppProvider>
          <BrowserRouter>
            <Layout signOut={signOut} user={user}>
              <Routes>
                <Route path="/"           element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"  element={<Dashboard />} />
                <Route path="/builders"   element={<BuilderManager />} />
                <Route path="/cashflow"   element={<CashFlow />} />
                <Route path="*"           element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </AppProvider>
      )}
    </Wrapper>
  );
}
