import React, { useEffect } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function CommunityRoute() {
  const { communityId } = useParams();
  const { setProjectId } = useApp();

  useEffect(() => {
    if (communityId) setProjectId(communityId);
  }, [communityId, setProjectId]);

  return <Outlet />;
}
