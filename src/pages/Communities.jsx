import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Building2, ChevronRight, Plus } from 'lucide-react';

export default function Communities() {
  const { projects, loading } = useApp();
  const navigate = useNavigate();

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
          onClick={() => {/* TODO: Add community modal */}}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4E79] text-white rounded-lg text-sm font-medium hover:bg-[#153452] transition"
        >
          <Plus size={16} /> New Community
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => (
          <button
            key={project.id}
            onClick={() => navigate(`/communities/${project.id}/dashboard`)}
            className="text-left bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition group"
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
            <div className="text-xs text-gray-400 mt-3">
              Created {new Date(project.created_at).toLocaleDateString()}
            </div>
          </button>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-16">
          <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No communities yet. Create your first one to get started.</p>
        </div>
      )}
    </div>
  );
}
