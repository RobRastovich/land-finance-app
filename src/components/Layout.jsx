import React, { useState } from 'react';
import { NavLink, useLocation, useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, TrendingUp, DollarSign, BarChart3, FolderOpen,
  LogOut, Menu, X, ChevronDown, ChevronRight, Plus, Users, MessageSquare
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import ChatWidget from './ChatWidget';

const SUB_NAV = [
  { path: 'dashboard', icon: LayoutDashboard, label: 'Dashboard'       },
  { path: 'builders',  icon: Building2,       label: 'Builder Manager' },
  { path: 'cashflow',  icon: TrendingUp,      label: 'Cash Flow'       },
  { path: 'payments',  icon: DollarSign,      label: 'Payments'        },
  { path: 'pnl',       icon: BarChart3,       label: 'P&L'             },
  { path: 'documents', icon: FolderOpen,      label: 'Documents'       },
];

export default function Layout({ children, signOut, user }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { communityId } = useParams();
  const { projects, isAdmin } = useApp();

  // Auto-expand the active community
  const expanded = expandedId !== undefined ? expandedId : communityId;

  const currentProject = projects.find(p => p.id === communityId);
  const activeSub = SUB_NAV.find(n => location.pathname.includes(`/${n.path}`));
  const pageTitle = activeSub?.label
    || (location.pathname === '/chat' ? 'AI Chat' : null)
    || currentProject?.name
    || 'ACREs';

  function handleCommunityClick(projectId) {
    if (expanded === projectId) {
      // Collapse if already expanded
      setExpandedId(null);
    } else {
      // Expand and navigate
      setExpandedId(projectId);
      navigate(`/communities/${projectId}/dashboard`);
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside
        className={`flex flex-col transition-all duration-300 bg-gradient-to-b from-[#1F4E79] to-[#153452] text-white
          ${sidebarOpen ? 'w-60' : 'w-16'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
          {sidebarOpen && (
            <div>
              <div className="font-bold text-base leading-tight">ACREs</div>
              <div className="text-[10px] text-blue-200 uppercase tracking-widest">Acquisition · Capital · Risk · Evaluation</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-white/10 transition ml-auto"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Communities nav */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {sidebarOpen && (
            <div className="px-3 mb-2 text-[10px] font-semibold text-blue-300 uppercase tracking-widest">
              Communities
            </div>
          )}
          {projects.map(project => {
            const isExpanded = expanded === project.id;
            const isCurrent = communityId === project.id;
            return (
              <div key={project.id} className="mb-1">
                {/* Community name */}
                <button
                  onClick={() => handleCommunityClick(project.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm font-medium w-full
                    ${isCurrent
                      ? 'bg-white/15 text-white'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
                >
                  <Building2 size={16} className="shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="truncate">{project.name}</span>
                      {isExpanded
                        ? <ChevronDown size={14} className="ml-auto opacity-60" />
                        : <ChevronRight size={14} className="ml-auto opacity-40" />}
                    </>
                  )}
                </button>

                {/* Sub-nav (collapsible) */}
                {isExpanded && sidebarOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-2">
                    {SUB_NAV.map(({ path, icon: Icon, label }) => (
                      <NavLink
                        key={path}
                        to={`/communities/${project.id}/${path}`}
                        className={({ isActive: linkActive }) =>
                          `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition text-xs font-medium
                          ${linkActive && isCurrent
                            ? 'bg-white/10 text-white'
                            : 'text-blue-200 hover:bg-white/5 hover:text-white'}`
                        }
                      >
                        <Icon size={14} className="shrink-0" />
                        <span>{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* New Community button (admin only) */}
          {sidebarOpen && isAdmin && (
            <button
              onClick={() => navigate('/communities/new')}
              className="flex items-center gap-3 px-3 py-2 mt-3 rounded-lg transition text-sm font-medium w-full
                text-blue-200 hover:bg-white/10 hover:text-white border border-dashed border-white/20"
            >
              <Plus size={16} className="shrink-0" />
              <span>New Community</span>
            </button>
          )}

          {/* Admin: Users link */}
          {isAdmin && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 mt-3 rounded-lg transition text-sm font-medium w-full
                ${isActive ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`
              }
            >
              <Users size={16} className="shrink-0" />
              {sidebarOpen && <span>User Management</span>}
            </NavLink>
          )}

          {/* Chat link */}
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 mt-3 rounded-lg transition text-sm font-medium w-full
              ${isActive ? 'bg-white/15 text-white' : 'text-blue-200 hover:bg-white/10 hover:text-white'}`
            }
          >
            <MessageSquare size={16} className="shrink-0" />
            {sidebarOpen && <span>AI Chat</span>}
          </NavLink>
        </nav>

        {/* User / Sign out */}
        <div className="border-t border-white/10 p-3">
          {sidebarOpen && (
            <div className="text-xs text-blue-200 truncate mb-2 px-1">
              {user?.name || user?.email || 'User'}
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
            {currentProject ? `${currentProject.name} · ` : ''}ACREs
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      {location.pathname !== '/chat' && (
        <ChatWidget
          mcpServerId={process.env.REACT_APP_CHAT_MCP_SERVER_ID}
          getUserToken={() => localStorage.getItem('token')}
          title="ACREs Assistant"
        />
      )}
    </div>
  );
}
