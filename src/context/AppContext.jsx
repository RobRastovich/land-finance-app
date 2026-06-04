import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects]   = useState([]);
  const [builders, setBuilders]   = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Load projects on mount
  useEffect(() => {
    api.getProjects()
      .then(data => {
        setProjects(data);
        if (data.length > 0) setProjectId(data[0].id);
      })
      .catch(e => setError(e.message));
  }, []);

  // Load builders + contracts when project changes
  const reload = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [b, c] = await Promise.all([
        api.getBuilders(projectId),
        api.getContracts(projectId),
      ]);
      setBuilders(b);
      setContracts(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <AppContext.Provider value={{
      projectId, setProjectId,
      projects, builders, contracts,
      loading, error, reload,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
