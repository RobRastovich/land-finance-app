import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { Copy, Check, Trash2, Shield, User, Pencil } from 'lucide-react';

export default function Users() {
  const { isAdmin, projects } = useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'standard', communityIds: [] });

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function generateInviteLink(role = 'standard') {
    try {
      const { inviteToken } = await api.generateInvite(role);
      const base = window.location.origin;
      const link = `${base}/register/${inviteToken}`;
      setInviteLink(link);
      setCopied(false);
    } catch (e) { alert(e.message); }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function startEdit(u) {
    setEditingUser(u.id);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      communityIds: (u.communities || []).map(c => c.id),
    });
  }

  async function saveEdit() {
    try {
      await api.updateUser(editingUser, { name: editForm.name, email: editForm.email, role: editForm.role });
      await api.assignCommunities(editingUser, editForm.communityIds);
      setEditingUser(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this user?')) return;
    await api.deleteUser(id);
    load();
  }

  function toggleCommunity(projectId) {
    setEditForm(f => ({
      ...f,
      communityIds: f.communityIds.includes(projectId)
        ? f.communityIds.filter(id => id !== projectId)
        : [...f.communityIds, projectId],
    }));
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Shield size={48} className="mx-auto text-gray-300 mb-4" />
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  if (loading) return <div className="text-gray-400 p-8">Loading users...</div>;

  return (
    <div className="space-y-6">
      {/* Invite Section */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-800 mb-3">Invite New User</h3>
        <p className="text-sm text-gray-500 mb-4">Generate a registration link to share with new users. Links expire in 7 days.</p>
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => generateInviteLink('standard')}
            className="px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452] transition"
          >
            Generate Standard User Link
          </button>
          <button
            onClick={() => generateInviteLink('admin')}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition"
          >
            Generate Admin Link
          </button>
        </div>
        {inviteLink && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 border">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 bg-transparent text-sm text-gray-700 outline-none font-mono"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border rounded-md text-sm font-medium hover:bg-gray-50 transition"
            >
              {copied ? <><Check size={14} className="text-green-600" /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-gray-800">All Users ({users.length})</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Communities</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                {editingUser === u.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input
                        type="text" value={editForm.name}
                        onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="px-2 py-1 border rounded text-sm w-full"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="email" value={editForm.email}
                        onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                        className="px-2 py-1 border rounded text-sm w-full"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="standard">Standard</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {projects.map(p => (
                          <button
                            key={p.id}
                            onClick={() => toggleCommunity(p.id)}
                            className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                              editForm.communityIds.includes(p.id)
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-500 border border-gray-200'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={saveEdit} className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium">Save</button>
                        <button onClick={() => setEditingUser(null)} className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-xs font-medium">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.communities || []).map(c => (
                          <span key={c.id} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs">{c.name}</span>
                        ))}
                        {(!u.communities || u.communities.length === 0) && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.created_at?.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(u)} className="text-gray-400 hover:text-blue-500 transition">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="text-gray-400 hover:text-red-500 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
