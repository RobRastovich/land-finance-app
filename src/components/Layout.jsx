import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, TrendingUp,
  LogOut, Menu, X, ChevronRight
} from 'lucide-react';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/builders',  icon: Building2,       label: 'Builder Manager' },
  { to: '/cashflow',  icon: TrendingUp,      label: 'Cash Flow'       },
];

export default function Layout({ children, signOut, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const pageTitle = NAV.find(n => location.pathname.startsWith(n.to))?.label || 'Melina';

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside
        className={`flex flex-col transition-all duration-300 bg-gradient-to-b from-[#1F4E79] to-[#153452] text-white
          ${sidebarOpen ? 'w-56' : 'w-16'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
          {sidebarOpen && (
            <div>
              <div className="font-bold text-base leading-tight">Melina</div>
              <div className="text-[10px] text-blue-200 uppercase tracking-widest">Land Dev</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-white/10 transition ml-auto"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm font-medium
                ${isActive
                  ? 'bg-white/15 text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{label}</span>}
              {sidebarOpen && (
                <ChevronRight size={14} className="ml-auto opacity-40" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* User / Sign out */}
        <div className="border-t border-white/10 p-3">
          {sidebarOpen && (
            <div className="text-xs text-blue-200 truncate mb-2 px-1">
              {user?.signInDetails?.loginId || user?.username}
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
              text-blue-100 hover:bg-white/10 hover:text-white transition"
          >
            <LogOut size={16} className="shrink-0" />
            {sidebarOpen && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
          <div className="text-sm text-gray-500">
            Melina Community · Land Development
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
