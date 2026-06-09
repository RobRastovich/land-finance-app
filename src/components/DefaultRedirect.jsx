import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function DefaultRedirect() {
  const { projects } = useApp();

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return <Navigate to={`/communities/${projects[0].id}/dashboard`} replace />;
}
