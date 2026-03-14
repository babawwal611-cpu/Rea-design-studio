import React, { useState, useEffect, useRef } from 'react';
import DesignTool from './components/DesignTool';
import LandingPage from './components/LandingPage';
import PredictiveSizing from './components/PredictiveSizing';
import ToolSelection from './components/ToolSelection';

function getPage(hash) {
  if (hash === '#/studio')  return 'studio';
  if (hash === '#/sizing')  return 'sizing';
  if (hash === '#/select')  return 'select';
  return 'landing';
}

export default function App() {
  const [page, setPage] = useState(() => getPage(window.location.hash));
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

  const goToLanding    = () => nav('',         'landing');
  const goToSelect     = () => nav('#/select',  'select');
  const goToStudio     = () => nav('#/studio',  'studio');
  const goToSizing     = () => nav('#/sizing',  'sizing');

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
      onBack={goToSelect}
      onPushToSimulation={handlePushToSimulation}
    />
  );

  if (page === 'select') return (
    <ToolSelection
      onSelectStudio={goToStudio}
      onSelectSizing={goToSizing}
      onBack={goToLanding}
    />
  );

  // Landing page — both buttons route to the selection screen
  return <LandingPage onEnter={goToSelect} onOpenSizing={goToSelect} />;
}
