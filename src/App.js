import React, { useState, useEffect, useRef } from 'react';
import DesignTool from './components/DesignTool';
import LandingPage from './components/LandingPage';
import PredictiveSizing from './components/PredictiveSizing';

function getPage(hash) {
  if (hash === '#/studio')  return 'studio';
  if (hash === '#/sizing')  return 'sizing';
  return 'landing';
}

export default function App() {
  const [page, setPage] = useState(() => getPage(window.location.hash));
  // Sizing results to pre-fill studio when user "pushes" from sizing tool
  const sizingPreload = useRef(null);

  useEffect(() => {
    const handler = () => setPage(getPage(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const nav = (hash, p) => {
    window.location.hash = hash;
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  const goToStudio  = ()       => nav('#/studio', 'studio');
  const goToSizing  = ()       => nav('#/sizing', 'sizing');
  const goToLanding = ()       => nav('',         'landing');

  const handlePushToSimulation = (sizingResult) => {
    sizingPreload.current = sizingResult;
    goToStudio();
  };

  if (page === 'studio') return (
    <DesignTool
      onBack={goToLanding}
      onOpenSizing={goToSizing}
      sizingPreload={sizingPreload.current}
      onClearPreload={() => { sizingPreload.current = null; }}
    />
  );

  if (page === 'sizing') return (
    <PredictiveSizing
      onBack={goToStudio}
      onPushToSimulation={handlePushToSimulation}
    />
  );

  return <LandingPage onEnter={goToStudio} onOpenSizing={goToSizing} />;
}
