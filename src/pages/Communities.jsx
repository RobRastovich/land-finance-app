import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { Building2, ChevronRight, Plus, Copy, Pencil, X } from 'lucide-react';

export default function Communities() {
  const { projects, loading, reload } = useApp();
  const navigate = useNavigate();
  const [duplicating, setDuplicating] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameData, setRenameData] = useState({ name: '', description: '' });

  async function handleDuplicate(e, project) {
    e.stopPropagation();
    setDuplicating(project.id);
    try {
      const newProject = await api.duplicateProject(project.id);
      await reload();
      navigate(`/communities/${newProject.id}/dashboard`);
    } catch (err) {
      alert(err.message);
    } finally {
      setDuplicating(null);
    }
  }

  function openRenameModal(e, project) {
    e.stopPropagation();
    setRenaming(project.id);
    setRenameData({ name: project.name, description: project.description || '' });
  }

  function closeRenameModal() {
    setRenaming(null);
    setRenameData({ name: '', description: '' });
  }

  async function handleRename(e) {
    e.preventDefault();
    if (!renameData.name.trim()) return;
    try {
      await api.updateProject(renaming, renameData);
      await reload();
      closeRenameModal();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading communities...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Communities</h2>
          <p className="text-sm text-gray-500 mt-1">Select a community to manage</p>
        </div>
        <button
          onClick={() => navigate('/communities/new')}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452] transition"
        >
          <Plus size={16} /> New Community
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => (
          <div
            key={project.id}
            onClick={() => navigate(`/communities/${project.id}/dashboard`)}
            className="text-left bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition group cursor-pointer relative"
          >
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition">
                <Building2 size={24} />
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500 transition mt-1" />
            </div>
            <h3 className="font-semibold text-gray-800 mt-4 text-lg">{project.name}</h3>
            {project.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>
            )}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-gray-400">
                Created {new Date(project.created_at).toLocaleDateString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => openRenameModal(e, project)}
                  title="Rename community"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition"
                >
                  <Pencil size={13} />
                  Rename
                </button>
                <button
                  onClick={(e) => handleDuplicate(e, project)}
                  disabled={duplicating === project.id}
                  title="Duplicate community"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-500 hover:text-green-700 hover:bg-green-50 border border-transparent hover:border-green-200 transition disabled:opacity-50"
                >
                  <Copy size={13} />
                  {duplicating === project.id ? 'Duplicating...' : 'Duplicate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-16">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No communities yet. Create your first one to get started.</p>
        </div>
      )}

      {renaming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Rename Community</h3>
              <button
                onClick={closeRenameModal}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRename}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={renameData.name}
                    onChange={(e) => setRenameData({ ...renameData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                  <textarea
                    value={renameData.description}
                    onChange={(e) => setRenameData({ ...renameData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeRenameModal}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1F4E79] text-white rounded-lg hover:bg-[#153452] transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
