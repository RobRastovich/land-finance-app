import React from 'react';
import { useApp } from '../context/AppContext';
import { Shield } from 'lucide-react';

export default function ProtectedRoute({ module, children }) {
  const { hasPermission } = useApp();

  if (!hasPermission(module)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <Shield size={48} className="text-gray-300 mb-4" />
        <p className="text-sm">You don't have permission to access this module.</p>
      </div>
    );
  }

  return children;
}
