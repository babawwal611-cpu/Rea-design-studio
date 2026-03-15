/**
 * SolarStep.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Solar resource step for the MIRIDA simulation wizard.
 *
 * Architecture:
 *  • Embedded atlas (solarAtlas.js) loads instantly — always works, no API needed
 *  • Live PVGIS or NASA fetch is optional — improves accuracy, shown as upgrade
 *  • Cached live results (IndexedDB) restore automatically on revisit
 *
 * Usage in DesignTool.js:
 *  1. Import: import SolarStep from './SolarStep';
 *  2. Replace {step === 2 && (...)} block with:
 *       {step === 2 && (
 *         <SolarStep
 *           lat={project.lat}
 *           lon={project.lng}
 *           solar={solar}
 *           sol={sol}
 *         />
 *       )}
 *  3. Update solar state initialiser:
 *       const [solar, setSolar] = useState({
 *         solarData:  null,
 *         avg_ghi:    0,
 *         avg_temp:   25,
 *         source:     '',
 *         fetched:    false,
 *         fetching:   false,
 *         fetchError: '',
 *         liveSource: 'pvgis',   // 'pvgis' | 'nasa'
 *         isLive:     false,     // true when data is from live API (not atlas)
 *       });
 *  4. In runSimulation, solar data is already set — no change needed.
 *     The canProceed() for step 2 should be: return solar.fetched;
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useCallback } from 'react';
import {
  getSolarData,
  fetchLiveSolarData,
  getAtlasData,
  atlasToHourly,
} from '../utils/solarAtlas';

const C = {
  bg:      '#F4F7FB', surface: '#FFFFFF', border: '#E2EAF2', borderHi: '#C5D5E8',
  blue:    '#0070CC', blueDim: '#EAF3FC',
  green:   '#059669', greenDim: '#D1FAE5',
  amber:   '#D97706', amberDim: '#FEF3C7',
  red:     '#DC2626', redDim:   '#FEE2E2',
  text:    '#1A2B3C', textMid: '#4A6580', textDim: '#94A3B8',
};
const FONT = "'DM Sans', sans-serif";

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, ...style }}>
    {children}
  </div>
);

const Label = ({ children, hint }) => (
  <div style={{ marginBottom: 6 }}>
    <span style={{ fontSize: 10, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: FONT }}>{children}</span>
    {hint && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 8, fontFamily: FONT }}>{hint}</span>}
  </div>
);

/* ── Mini monthly GHI bar chart ─────────────────────────────────────────── */
function MonthlyChart({ monthly }) {
  if (!monthly || monthly.length < 12) return null;
  const max = Math.max(...monthly.map(m => m.ghi), 0.1);
  const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56 }}>
      {monthly.map((m, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 9, color: C.textDim, fontFamily: FONT }}>{m.ghi.toFixed(1)}</div>
          <div style={{ width: '100%', height: `${(m.ghi / max) * 36}px`, background: C.blue, opacity: 0.75, borderRadius: '2px 2px 0 0', minHeight: 2 }} />
          <div style={{ fontSize: 8, color: C.textDim, fontFamily: FONT }}>{MONTHS[i]}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Source badge ───────────────────────────────────────────────────────── */
function SourceBadge({ source, isLive }) {
  const color = isLive ? C.green : C.amber;
  const bg    = isLive ? C.greenDim : C.amberDim;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: '3px 10px', borderRadius: 6, fontFamily: FONT }}>
      {source}
    </span>
  );
}

/* ── Main SolarStep component ───────────────────────────────────────────── */
export default function SolarStep({ lat, lon, solar, sol }) {
  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);
  const validCoords = !isNaN(parsedLat) && !isNaN(parsedLon)
    && parsedLat >= -90 && parsedLat <= 90
    && parsedLon >= -180 && parsedLon <= 180;

  /* ── Auto-load atlas data when valid coordinates are present ─────────── */
  useEffect(() => {
    if (!validCoords || solar.fetched) return;

    // Load from atlas (or cache) immediately — no spinner for instant data
    getSolarData(parsedLat, parsedLon).then(result => {
      sol('solarData',  result.hourly);
      sol('avg_ghi',    result.avg_ghi);
      sol('avg_temp',   result.avg_temp);
      sol('source',     result.source);
      sol('monthly',    result.monthly);
      sol('fetched',    true);
      sol('isLive',     result.source !== 'Atlas (NASA SSE)');
    });
  }, [validCoords, parsedLat, parsedLon]); // eslint-disable-line

  /* ── Live API fetch ─────────────────────────────────────────────────── */
  const handleLiveFetch = useCallback(async () => {
    if (!validCoords) return;
    sol('fetching',   true);
    sol('fetchError', '');
    try {
      const result = await fetchLiveSolarData(parsedLat, parsedLon, solar.liveSource || 'pvgis');
      sol('solarData',  result.hourly);
      sol('avg_ghi',    result.avg_ghi);
      sol('avg_temp',   result.avg_temp);
      sol('source',     result.source);
      sol('monthly',    result.monthly);
      sol('fetched',    true);
      sol('isLive',     true);
    } catch (err) {
      sol('fetchError', err.message);
    } finally {
      sol('fetching', false);
    }
  }, [validCoords, parsedLat, parsedLon, solar.liveSource]); // eslint-disable-line

  /* ── Manual GHI entry ───────────────────────────────────────────────── */
  const handleManualApply = useCallback(() => {
    const ghi  = parseFloat(solar.manual_ghi)  || 5.0;
    const temp = parseFloat(solar.manual_temp) || 25.0;
    const atlas = getAtlasData(parsedLat || 0, parsedLon || 0);
    // Scale the atlas monthly profile proportionally to the user's annual average
    const atlasMean = atlas.monthly.reduce((s, m) => s + m.ghi, 0) / 12;
    const scale = atlasMean > 0 ? ghi / atlasMean : 1;
    const scaledMonthly = atlas.monthly.map(m => ({
      ghi:  Math.round(m.ghi * scale * 10) / 10,
      temp: temp,
    }));
    const hourly = atlasToHourly({ monthly: scaledMonthly });
    sol('solarData',  hourly);
    sol('avg_ghi',    ghi);
    sol('avg_temp',   temp);
    sol('source',     'Manual entry');
    sol('monthly',    scaledMonthly);
    sol('fetched',    true);
    sol('isLive',     false);
  }, [parsedLat, parsedLon, solar.manual_ghi, solar.manual_temp]); // eslint-disable-line

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Section header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 2, textTransform: 'uppercase', fontFamily: FONT, marginBottom: 4 }}>Step 3</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text, fontFamily: FONT, letterSpacing: -0.5 }}>Solar Resource</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textMid, fontFamily: FONT }}>
          Define the hourly solar irradiance for the project site.
        </p>
      </div>

      {/* Coordinates missing warning */}
      {!validCoords && (
        <Card style={{ background: C.amberDim, border: `1px solid ${C.amber}30`, marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.amber, fontFamily: FONT }}>
            Enter valid coordinates in Step 1 to load solar resource data automatically.
          </p>
        </Card>
      )}

      {/* ── Status card — always shown once data is loaded ── */}
      {solar.fetched && solar.avg_ghi > 0 && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: C.text, fontFamily: FONT, letterSpacing: -1 }}>
                  {solar.avg_ghi.toFixed(2)}
                </span>
                <span style={{ fontSize: 13, color: C.textMid }}>kWh/m²/day</span>
                <SourceBadge source={solar.source || 'Atlas'} isLive={solar.isLive} />
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12, color: C.textMid }}>
                <span>Avg temp: <strong style={{ color: C.text }}>{solar.avg_temp}°C</strong></span>
                <span>Coordinates: <strong style={{ color: C.text }}>{parsedLat?.toFixed(3) ?? '—'}, {parsedLon?.toFixed(3) ?? '—'}</strong></span>
              </div>
            </div>
            {!solar.isLive && validCoords && (
              <div style={{ fontSize: 11, color: C.amber, background: C.amberDim, padding: '6px 10px', borderRadius: 8, maxWidth: 180, lineHeight: 1.5 }}>
                Using embedded atlas. Fetch live data below for higher accuracy.
              </div>
            )}
            {solar.isLive && (
              <div style={{ fontSize: 11, color: C.green, background: C.greenDim, padding: '6px 10px', borderRadius: 8, maxWidth: 200, lineHeight: 1.5 }}>
                {solar.source?.includes('NASA')
                  ? `Real daily data loaded (${new Date().getFullYear() - 1}). Highest accuracy.`
                  : 'TMY satellite data loaded. Highest accuracy available.'
                }
              </div>
            )}
          </div>

          {/* Monthly chart */}
          {solar.monthly && (
            <div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8, fontFamily: FONT }}>Monthly GHI profile (kWh/m²/day)</div>
              <MonthlyChart monthly={solar.monthly} />
            </div>
          )}
        </Card>
      )}

      {/* ── Live API fetch (optional upgrade) ── */}
      {validCoords && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: FONT }}>
            Fetch higher-resolution data
          </div>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 16, lineHeight: 1.6 }}>
            Optional. Downloads real satellite-measured solar data for this location.
            PVGIS provides a Typical Meteorological Year (TMY) profile. NASA POWER provides
            actual daily measured values for the most recent complete year — the same data
            source used by HOMER Pro. Results are cached locally — subsequent visits load instantly.
          </div>

          {/* Source selector */}
          <div style={{ marginBottom: 14 }}>
            <Label>Data source</Label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { id: 'pvgis', label: 'PVGIS (EU JRC)', desc: 'Best for Europe, Africa, Asia' },
                { id: 'nasa',  label: 'NASA POWER',     desc: 'Real daily data from 1984 — global coverage' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => sol('liveSource', s.id)}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: solar.liveSource === s.id ? C.blueDim : C.bg,
                    border: `1.5px solid ${solar.liveSource === s.id ? C.blue : C.border}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: solar.liveSource === s.id ? C.blue : C.text, fontFamily: FONT }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, fontFamily: FONT }}>{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fetch button */}
          <button
            onClick={handleLiveFetch}
            disabled={solar.fetching || !validCoords}
            style={{
              padding: '11px 24px', borderRadius: 9, cursor: solar.fetching ? 'wait' : 'pointer',
              background: solar.fetching ? C.border : C.blue, color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 600, fontFamily: FONT,
              opacity: solar.fetching ? 0.7 : 1, transition: 'all 0.15s',
            }}
          >
            {solar.fetching ? 'Fetching... (may take 20–30 seconds)' : `Fetch from ${solar.liveSource === 'pvgis' ? 'PVGIS' : 'NASA POWER'}`}
          </button>

          {/* Progress message */}
          {solar.fetching && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: C.blueDim, borderRadius: 8, fontSize: 12, color: C.blue, fontFamily: FONT }}>
              {solar.liveSource === 'pvgis'
                ? 'Contacting PVGIS (EU JRC)... Calculating Typical Meteorological Year profile. This takes 20–30 seconds.'
                : `Contacting NASA POWER... Downloading daily solar data for ${new Date().getFullYear() - 1}. This takes 15–25 seconds.`
              }
              {' '}The simulation will proceed with embedded atlas data if this times out.
            </div>
          )}

          {/* Error with helpful fallback message */}
          {solar.fetchError && !solar.fetching && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: C.redDim, borderRadius: 8, fontSize: 12, color: C.red, fontFamily: FONT, lineHeight: 1.6 }}>
              {solar.fetchError}
              {solar.fetched && (
                <span> — Simulation will proceed using embedded atlas data (±15% accuracy).</span>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Manual entry (fallback for unusual locations) ── */}
      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: FONT }}>
          Enter GHI manually
        </div>
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 14, lineHeight: 1.6 }}>
          If you have measured or design-tool solar data for this site, enter it here. Overrides the atlas and live fetch.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <Label hint="annual average">GHI (kWh/m²/day)</Label>
            <input
              type="number" min={0.5} max={9} step={0.01}
              value={solar.manual_ghi ?? solar.avg_ghi ?? ''}
              onChange={e => sol('manual_ghi', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <Label hint="annual average">Temperature (°C)</Label>
            <input
              type="number" min={-20} max={50} step={0.5}
              value={solar.manual_temp ?? solar.avg_temp ?? ''}
              onChange={e => sol('manual_temp', e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: 14, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button
            onClick={handleManualApply}
            style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}
          >
            Apply
          </button>
        </div>
      </Card>
    </div>
  );
}
