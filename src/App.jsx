import React, { useEffect } from 'react';
import { useRakchaStore } from './store/useRakchaStore';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateProfile from './pages/CreateProfile';
import Dashboard from './pages/Dashboard';
import CreateJoinGroup from './pages/CreateJoinGroup';
import Settings from './pages/Settings';

export default function App() {
  const currentPage = useRakchaStore(s => s.currentPage);
  const syncRoute = useRakchaStore(s => s.syncRoute);

  useEffect(() => {
    // Ensure initial hash is set if empty
    if (!window.location.hash) {
      window.location.hash = '#/landing';
    }

    const handleHashChange = () => {
      const page = window.location.hash.replace('#/', '') || 'landing';
      syncRoute(page);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [syncRoute]);

  switch (currentPage) {
    case 'landing':
      return <Landing />;
    case 'login':
      return <Login />;
    case 'register':
      return <Register />;
    case 'create-profile':
      return <CreateProfile />;
    case 'app':
      return <Dashboard />;
    case 'create-join':
      return <CreateJoinGroup />;
    case 'settings':
      return <Settings />;
    default:
      return <Landing />;
  }
}
