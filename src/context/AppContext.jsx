import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children, user }) {
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects]   = useState([]);
  const [builders, setBuilders]   = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const isAdmin = user?.role === 'admin';

  // Load projects scoped to user role
  useEffect(() => {
    const loadProjects = isAdmin ? api.getProjects : api.getMyCommunities;
    loadProjects()
      .then(data => { setProjects(data); })
      .catch(e => setError(e.message));
  }, [isAdmin]);

  // Refresh projects list
  const refreshProjects = useCallback(async () => {
    try {
      const loadProjects = isAdmin ? api.getProjects : api.getMyCommunities;
      const data = await loadProjects();
      setProjects(data);
    } catch (e) { setError(e.message); }
  }, [isAdmin]);

  // Load builders + contracts when project changes
  const reload = useCallback(async () => {
    if (!projectId) {
      await refreshProjects();
      return;
    }
    setLoading(true);
    try {
      const loadProjects = isAdmin ? api.getProjects : api.getMyCommunities;
      const [b, c, p] = await Promise.all([
        api.getBuilders(projectId),
        api.getContracts(projectId),
        loadProjects(),
      ]);
      setBuilders(b);
      setContracts(c);
      setProjects(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, refreshProjects, isAdmin]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <AppContext.Provider value={{
      projectId, setProjectId,
      projects, builders, contracts,
      loading, error, reload, refreshProjects,
      user, isAdmin,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
