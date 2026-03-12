import React, { useState, useEffect } from 'react';
import DesignTool from './components/DesignTool';
import LandingPage from './components/LandingPage';

export default function App() {
  const [page, setPage] = useState(() =>
    window.location.hash === '#/studio' ? 'studio' : 'landing'
  );

  useEffect(() => {
    const handler = () => {
      setPage(window.location.hash === '#/studio' ? 'studio' : 'landing');
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const goToStudio = () => {
    window.location.hash = '#/studio';
    setPage('studio');
    window.scrollTo({ top: 0 });
  };

  const goToLanding = () => {
    window.location.hash = '';
    setPage('landing');
    window.scrollTo({ top: 0 });
  };

  if (page === 'studio') return <DesignTool onBack={goToLanding} />;
  return <LandingPage onEnter={goToStudio} />;
}
