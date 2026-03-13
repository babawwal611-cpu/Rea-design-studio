import React, { useEffect, useRef, useState } from 'react';

const C = {
  border: '#E2EAF2', cyan: '#0070CC', cyanDim: '#EAF3FC',
  textMid: '#4A6580', textDim: '#94A3B8', text: '#1A2B3C', surface: '#FFFFFF',
};

/* Dynamically load Leaflet from CDN */
function loadLeaflet() {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    document.head.appendChild(script);
  });
}

export default function SiteMap({ lat, lng, projectName, location }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markerRef       = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const validCoords = !isNaN(parsedLat) && !isNaN(parsedLng) &&
    parsedLat >= -90 && parsedLat <= 90 &&
    parsedLng >= -180 && parsedLng <= 180;

  /* Initialise or update map whenever coords change */
  useEffect(() => {
    if (!validCoords) return;

    setStatus('loading');

    loadLeaflet().then((L) => {
      if (!mapContainerRef.current) return;

      /* First initialisation */
      if (!mapRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [parsedLat, parsedLng],
          zoom: 13,
          zoomControl: true,
          attributionControl: true,
        });

        /* Satellite layer via Esri World Imagery */
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          { attribution: 'Tiles © Esri — Source: Esri, DigitalGlobe, GeoEye, Earthstar, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, GIS Community', maxZoom: 19 }
        ).addTo(map);

        /* Labels overlay on top of satellite */
        L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          { attribution: '', maxZoom: 19, opacity: 0.8 }
        ).addTo(map);

        mapRef.current = map;
      } else {
        /* Map already exists — just pan */
        mapRef.current.setView([parsedLat, parsedLng], 13, { animate: true });
      }

      /* Custom SVG marker */
      const svgIcon = L.divIcon({
        html: `
          <div style="position:relative;width:36px;height:44px">
            <svg viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000040"/>
                </filter>
              </defs>
              <path d="M18 2C10.3 2 4 8.3 4 16c0 10 14 26 14 26S32 26 32 16c0-7.7-6.3-14-14-14z"
                fill="#0070CC" stroke="white" stroke-width="2" filter="url(#shadow)"/>
              <circle cx="18" cy="16" r="6" fill="white"/>
              <circle cx="18" cy="16" r="3.5" fill="#0070CC"/>
            </svg>
            ${projectName ? `
            <div style="position:absolute;top:-28px;left:50%;transform:translateX(-50%);
              background:#0070CC;color:white;padding:3px 8px;border-radius:4px;
              font-size:10px;font-family:DM Sans,sans-serif;font-weight:600;
              white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">
              ${projectName}
            </div>` : ''}
          </div>`,
        className: '',
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -48],
      });

      /* Place / update marker */
      if (markerRef.current) {
        markerRef.current.setLatLng([parsedLat, parsedLng]);
        markerRef.current.setIcon(svgIcon);
      } else {
        const marker = L.marker([parsedLat, parsedLng], { icon: svgIcon }).addTo(mapRef.current);
        marker.bindPopup(`
          <div style="font-family:'DM Sans',sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#1A2B3C;margin-bottom:4px">
              ${projectName || 'Project Site'}
            </div>
            ${location ? `<div style="font-size:11px;color:#4A6580;margin-bottom:6px">${location}</div>` : ''}
            <div style="font-size:11px;color:#94A3B8;font-family:'IBM Plex Mono',monospace">
              ${parsedLat.toFixed(5)}°, ${parsedLng.toFixed(5)}°
            </div>
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid #E2EAF2;
              font-size:10px;color:#4A6580">
              ☀️ Solar resource analysis site
            </div>
          </div>
        `);
        markerRef.current = marker;
      }

      setStatus('ready');
    }).catch(() => setStatus('error'));
  }, [parsedLat, parsedLng, projectName, location, validCoords]);

  /* Destroy map on unmount */
  useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  /* Fix Leaflet tile rendering after container resize */
  useEffect(() => {
    if (mapRef.current && status === 'ready') {
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }
  }, [status]);

  if (!validCoords) {
    return (
      <div style={{
        height: 280, borderRadius: 12, border: `2px dashed ${C.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#F8FAFC', gap: 10,
      }}>
        <div style={{ fontSize: 32 }}>🗺️</div>
        <div style={{ fontSize: 13, color: C.textMid, fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
          Enter coordinates above to view site location
        </div>
        <div style={{ fontSize: 11, color: C.textDim, fontFamily: "'IBM Plex Mono',monospace" }}>
          Latitude · Longitude (decimal degrees)
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 2px 12px rgba(0,112,204,0.08)' }}>
      {/* Loading overlay */}
      {status === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(244,247,251,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8,
        }}>
          <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.cyan, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 12, color: C.textMid, fontFamily: "'DM Sans',sans-serif" }}>Loading satellite imagery…</div>
        </div>
      )}

      {/* Map container */}
      <div ref={mapContainerRef} style={{ height: 280, width: '100%' }} />

      {/* Coordinate badge */}
      {status === 'ready' && (
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 400,
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
          border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '5px 10px', fontSize: 11,
          fontFamily: "'IBM Plex Mono',monospace", color: C.textMid,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
          {parsedLat.toFixed(5)}°N · {parsedLng.toFixed(5)}°E
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
