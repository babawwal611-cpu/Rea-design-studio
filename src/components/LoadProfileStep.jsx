/**
 * LoadProfileStep.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in replacement for the load step (step === 1) in DesignTool.js
 *
 * Implements all 4 modes from the MIRIDA Load Profile Module Specification:
 *   Mode 1 — Upload Load Data (CSV)
 *   Mode 2 — Community Templates  (village scale, diversity factors shown)
 *   Mode 3 — Facility Templates   (single buildings / institutions)
 *   Mode 4 — Custom Demand Builder (interactive 24-hr slider chart)
 *
 * Also implements:
 *   - Full 24-hr load curve preview for all modes
 *   - Peak demand / average load / load factor metrics shown at profile step
 *   - Load growth rate input (optional)
 *
 * ─── Usage in DesignTool.js ──────────────────────────────────────────────────
 * 1. Import at top:
 *      import LoadProfileStep from './LoadProfileStep';
 *
 * 2. Replace the existing {step === 1 && ( ... )} block with:
 *      {step === 1 && (
 *        <LoadProfileStep
 *          load={load}
 *          ld={ld}
 *          fileInputRef={fileInputRef}
 *          handleCSV={handleCSV}
 *          errors={errors}
 *        />
 *      )}
 *
 * 3. Update load state initialiser in DesignTool to add new fields:
 *      const [load, setLoad] = useState({
 *        method:         'community',   // 'community' | 'facility' | 'csv' | 'custom'
 *        template:       'community_100hh',
 *        daily_kwh:      137,
 *        shape_key:      'community_100hh',
 *        profile_type:   'community_100hh',  // kept for backward compat
 *        csvData:        null,
 *        csvName:        '',
 *        customProfile:  null,
 *        customSegments: { morning: 0.4, daytime: 0.3, evening: 1.0, night: 0.2 },
 *        load_growth_rate: 0,
 *      });
 *
 * 4. Update runSimulation to pass shape_key and growth options:
 *      const profileType = load.method === 'csv'    ? null
 *                        : load.method === 'custom'  ? 'custom'
 *                        : load.shape_key || load.profile_type;
 *      const growthOpts = {
 *        loadGrowthRate: parseFloat(load.load_growth_rate) || 0,
 *        targetYear: 1,
 *      };
 *      loadProfile = load.method === 'custom' && load.customProfile
 *        ? load.customProfile
 *        : generateLoadProfile(dailyKWh, profileType, growthOpts);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useMemo } from 'react';
import { NIGERIA_DEFAULTS, LOAD_SHAPES } from '../utils/simulateSystem';

/* ─── Design tokens (match DesignTool.js) ───────────────────────────────── */
const C = {
  bg: '#F4F7FB', surface: '#FFFFFF', border: '#E2EAF2', borderHi: '#C5D5E8',
  cyan: '#0070CC', cyanDark: '#005099', cyanDim: '#EAF3FC',
  gold: '#D97706', goldDim: '#FEF3C7',
  green: '#059669', greenDim: '#D1FAE5',
  red: '#DC2626',
  text: '#1A2B3C', textMid: '#4A6580', textDim: '#94A3B8',
};
const FONT = "'DM Sans', sans-serif";
const MONO = "'IBM Plex Mono', monospace";

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const fmt = (n, dec = 0) =>
  typeof n === 'number' && isFinite(n)
    ? n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : '—';

/* ─── Sub-components ────────────────────────────────────────────────────── */
const Label = ({ children, hint }) => (
  <div style={{ marginBottom: 6 }}>
    <span style={{ fontSize: 10, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: FONT }}>{children}</span>
    {hint && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 8, fontFamily: FONT }}>{hint}</span>}
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px', ...style }}>
    {children}
  </div>
);

/* ─── 24-hr Load Curve SVG Preview ─────────────────────────────────────── */
function LoadCurvePreview({ values, color = C.cyan, height = 100, showHours = true }) {
  if (!values || values.length < 24) return null;
  const max = Math.max(...values, 0.001);
  const w = 480;
  const h = height;
  const pad = { l: 36, r: 8, t: 8, b: showHours ? 22 : 6 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const barW   = chartW / 24;

  const bars = values.map((v, i) => {
    const barH = (v / max) * chartH;
    const x = pad.l + i * barW;
    const y = pad.t + chartH - barH;
    return { x, y, w: barW - 1.5, h: barH, v };
  });

  // Smooth polyline
  const points = values.map((v, i) => {
    const cx = pad.l + i * barW + barW / 2;
    const cy = pad.t + chartH - (v / max) * chartH;
    return `${cx},${cy}`;
  }).join(' ');

  const HOURS_LABEL = ['12a','','','3a','','','6a','','','9a','','','12p','','','3p','','','6p','','','9p','',''];

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.t + chartH * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y}
              stroke={C.border} strokeWidth={0.5} />
            {f > 0 && (
              <text x={pad.l - 4} y={y + 3} textAnchor="end"
                fontSize={9} fill={C.textDim} fontFamily={MONO}>
                {fmt(max * f, 1)}
              </text>
            )}
          </g>
        );
      })}

      {/* Bars */}
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h}
          fill={color} opacity={0.18} rx={1} />
      ))}

      {/* Smooth line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.8}
        strokeLinejoin="round" strokeLinecap="round" />

      {/* Hour labels */}
      {showHours && HOURS_LABEL.map((label, i) =>
        label ? (
          <text key={i}
            x={pad.l + i * barW + barW / 2}
            y={h - 4}
            textAnchor="middle" fontSize={8} fill={C.textDim} fontFamily={FONT}>
            {label}
          </text>
        ) : null
      )}

      {/* kW axis label */}
      <text x={pad.l - 28} y={pad.t + chartH / 2} textAnchor="middle"
        fontSize={8} fill={C.textDim} fontFamily={FONT}
        transform={`rotate(-90, ${pad.l - 28}, ${pad.t + chartH / 2})`}>
        kW
      </text>
    </svg>
  );
}

/* ─── Load Metrics Bar ─────────────────────────────────────────────────── */
function LoadMetrics({ values, dailyKwh }) {
  const peak    = Math.max(...values);
  const avg     = values.reduce((a, b) => a + b, 0) / values.length;
  const lf      = peak > 0 ? avg / peak : 0;
  const annualKwh = dailyKwh * 365;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14 }}>
      {[
        { label: 'Peak demand',   value: fmt(peak, 2),        unit: 'kW',     color: C.red },
        { label: 'Average load',  value: fmt(avg, 2),         unit: 'kW',     color: C.cyan },
        { label: 'Load factor',   value: fmt(lf * 100, 1),    unit: '%',      color: C.gold },
        { label: 'Annual energy', value: fmt(annualKwh),      unit: 'kWh/yr', color: C.text },
      ].map(({ label, value, unit, color }) => (
        <div key={label} style={{ background: C.bg, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color, fontFamily: MONO }}>{value}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{unit}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Mode selector tab ─────────────────────────────────────────────────── */
function ModeTab({ id, label, icon, active, onClick }) {
  return (
    <button onClick={() => onClick(id)} style={{
      padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: FONT,
      background: active ? C.cyanDim : 'transparent',
      border: `1px solid ${active ? C.cyan : C.border}`,
      color: active ? C.cyan : C.textMid,
      fontSize: 12, fontWeight: 600,
      display: 'flex', alignItems: 'center', gap: 6,
      transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span> {label}
    </button>
  );
}

/* ─── Mode 2 & 3 Template grid ─────────────────────────────────────────── */
function TemplateGrid({ templates, selectedId, onSelect, color = C.cyan }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
      {templates.map(t => {
        const active = selectedId === t.id;
        return (
          <button key={t.id} onClick={() => onSelect(t)} style={{
            padding: '14px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
            background: active ? C.cyanDim : C.surface,
            border: `1.5px solid ${active ? color : C.border}`,
            transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: active ? color : C.text, fontFamily: FONT, lineHeight: 1.3 }}>{t.label}</div>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, fontFamily: MONO }}>{t.daily_kwh} kWh/day</div>
            {t.note && <div style={{ fontSize: 9, color: C.textMid, marginTop: 3 }}>{t.note}</div>}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Mode 4: Custom Demand Builder ─────────────────────────────────────── */
// Defined outside the component — stable constant, never changes
const SEGMENT_HOURS = {
  night:   [0, 1, 2, 3, 4, 5],
  morning: [6, 7, 8, 9],
  daytime: [10, 11, 12, 13, 14, 15, 16],
  evening: [17, 18, 19, 20, 21, 22, 23],
};

function CustomDemandBuilder({ segments, onChange, dailyKwh }) {
  // segments = { morning, daytime, evening, night }  each 0–1 (relative fraction)

  // Build 24-hr shape from segments
  const shape24 = useMemo(() => {
    const arr = new Array(24).fill(0);
    Object.entries(SEGMENT_HOURS).forEach(([seg, hours]) => {
      hours.forEach(h => { arr[h] = segments[seg]; });
    });
    return arr;
  }, [segments]);

  const peakKwEstimate = dailyKwh > 0
    ? dailyKwh / shape24.reduce((a, b) => a + b, 0.001)
    : 0;

  const curveValues = shape24.map(f => f * peakKwEstimate);

  const SEGS = [
    { key: 'night',   label: 'Night load',    hours: '12am – 6am', color: '#6366f1' },
    { key: 'morning', label: 'Morning load',  hours: '6am – 10am', color: C.gold },
    { key: 'daytime', label: 'Daytime load',  hours: '10am – 5pm', color: '#f59e0b' },
    { key: 'evening', label: 'Evening peak',  hours: '5pm – 12am', color: C.cyan },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 4 }}>
          Adjust each time period relative to your peak. The system converts this into an 8,760-hour annual profile.
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        {SEGS.map(({ key, label, hours, color }) => (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
                <span style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>{hours}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontFamily: MONO, fontWeight: 600, color, minWidth: 36, textAlign: 'right' }}>
                  {fmt(segments[key] * 100, 0)}%
                </span>
                <span style={{ fontSize: 11, color: C.textDim, minWidth: 48 }}>
                  ~{fmt(segments[key] * peakKwEstimate, 1)} kW
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: C.textDim, width: 28 }}>0%</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={segments[key]}
                onChange={e => onChange({ ...segments, [key]: parseFloat(e.target.value) })}
                style={{ flex: 1, accentColor: color }}
              />
              <span style={{ fontSize: 11, color: C.textDim, width: 34 }}>100%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Live curve */}
      <div style={{ background: C.bg, borderRadius: 10, padding: '14px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.textMid, marginBottom: 8 }}>Live 24-hr load curve preview</div>
        <LoadCurvePreview values={curveValues} color={C.cyan} height={90} />
      </div>

      <div style={{ fontSize: 11, color: C.textDim, padding: '8px 12px', background: `${C.gold}15`, borderRadius: 8 }}>
        ⚠ Custom profile uses a simplified 4-segment shape. For precise demand modelling, use the CSV upload option with a measured or design-tool load profile.
      </div>
    </div>
  );
}

/* ─── Main LoadProfileStep Component ─────────────────────────────────────── */
export default function LoadProfileStep({ load, ld, fileInputRef, handleCSV, errors }) {
  // Resolve the current shape values for preview
  const previewShape = useMemo(() => {
    if (load.method === 'csv' && load.csvData) {
      // For CSV: show first 24 hours as preview
      return Array.from(load.csvData).slice(0, 24);
    }
    if (load.method === 'custom') {
      const segs = load.customSegments || { morning: 0.4, daytime: 0.3, evening: 1.0, night: 0.2 };
      const SEGMENT_HOURS = {
        night: [0,1,2,3,4,5], morning: [6,7,8,9],
        daytime: [10,11,12,13,14,15,16], evening: [17,18,19,20,21,22,23],
      };
      const arr = new Array(24).fill(0);
      Object.entries(SEGMENT_HOURS).forEach(([seg, hours]) => {
        hours.forEach(h => { arr[h] = segs[seg]; });
      });
      const sum = arr.reduce((a, b) => a + b, 0.001);
      const peak = (load.daily_kwh || 10) / sum;
      return arr.map(f => f * peak);
    }
    const shapeKey = load.shape_key || load.profile_type || 'rural_village';
    const resolvedKey = shapeKey.startsWith('community_') ? 'rural_village' : shapeKey;
    const shape = LOAD_SHAPES[resolvedKey]?.values || LOAD_SHAPES.rural_village.values;
    const shapeSum = shape.reduce((a, b) => a + b, 0);
    const peakKw = (load.daily_kwh || 10) / shapeSum;
    return shape.map(f => f * peakKw);
  }, [load.method, load.csvData, load.customSegments, load.shape_key, load.profile_type, load.daily_kwh]);

  const showPreview = (load.method === 'csv' && load.csvData)
    || load.method === 'community'
    || load.method === 'facility'
    || load.method === 'custom';

  return (
    <div className="step-content">
      {/* Section header — matches DesignTool SectionHead component */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.textDim, letterSpacing: 2, textTransform: 'uppercase', fontFamily: MONO, marginBottom: 4 }}>Step 2</div>
        <h2 style={{ fontSize: 22, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', color: C.text, margin: 0 }}>
          Load Profile
        </h2>
        <p style={{ fontSize: 13, color: C.textMid, marginTop: 4 }}>
          Define the community's hourly electricity demand for a full year.
        </p>
      </div>

      {/* ── Mode selector ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <ModeTab id="community" label="Community Templates" active={load.method === 'community'} onClick={m => ld('method', m)} />
        <ModeTab id="facility"  label="Facility Templates"  active={load.method === 'facility'}  onClick={m => ld('method', m)} />
        <ModeTab id="csv"       label="Upload CSV"          active={load.method === 'csv'}       onClick={m => ld('method', m)} />
        <ModeTab id="custom"    label="Custom Builder"      active={load.method === 'custom'}    onClick={m => ld('method', m)} />
      </div>

      {/* ══════════════════ MODE 2: COMMUNITY TEMPLATES ══════════════════ */}
      {load.method === 'community' && (
        <Card>
          <Label>Select Community size</Label>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 10, lineHeight: 1.6 }}>
            Community-scale loads include a <strong>diversity factor</strong> 
          </div>

          <TemplateGrid
            templates={NIGERIA_DEFAULTS.community_templates}
            selectedId={load.template}
            onSelect={t => { ld('template', t.id); ld('daily_kwh', t.daily_kwh); ld('shape_key', t.shape_key); ld('profile_type', t.shape_key); }}
          />

          {/* Diversity factor explanation */}
          {load.template && (() => {
            const t = NIGERIA_DEFAULTS.community_templates.find(x => x.id === load.template);
            if (!t) return null;
            const DFS = { community_50hh: 0.65, community_100hh: 0.55, community_250hh: 0.45, community_500hh: 0.38 };
            const df = DFS[t.id] || 1;
            return (
              <div style={{ marginTop: 14, padding: '12px 14px', background: C.cyanDim, borderRadius: 8, fontSize: 12, color: C.cyanDark }}>
                <strong>{t.label}</strong> · Diversity factor {df} · {t.hh_count} households × 2.5 kWh/HH × {df} DF = <strong>{t.daily_kwh} kWh/day</strong> total demand
              </div>
            );
          })()}
        </Card>
      )}

      {/* ══════════════════ MODE 3: FACILITY TEMPLATES ══════════════════ */}
      {load.method === 'facility' && (
        <Card>
          <Label>Select facility type</Label>
          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 10 }}>
            Single-building or institution loads.
          </div>
          <TemplateGrid
            templates={NIGERIA_DEFAULTS.facility_templates}
            selectedId={load.template}
            onSelect={t => { ld('template', t.id); ld('daily_kwh', t.daily_kwh); ld('shape_key', t.shape_key); ld('profile_type', t.shape_key); }}
            color={C.gold}
          />
          {load.template && (() => {
            const t = NIGERIA_DEFAULTS.facility_templates.find(x => x.id === load.template);
            if (!t) return null;
            const shapeObj = LOAD_SHAPES[t.shape_key];
            return (
              <div style={{ marginTop: 14, padding: '12px 14px', background: `${C.gold}15`, borderRadius: 8, fontSize: 12, color: C.gold }}>
                Load shape: <strong>{shapeObj?.label || t.shape_key}</strong> — {shapeObj?.desc || ''}
              </div>
            );
          })()}
        </Card>
      )}

      {/* ══════════════════ MODE 1: CSV UPLOAD ══════════════════ */}
      {load.method === 'csv' && (
        <Card>
          <div
            style={{ border: `2px dashed ${C.borderHi}`, borderRadius: 10, padding: '32px', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSV} style={{ display: 'none' }} />
            {load.csvData ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.cyan }}>{load.csvName}</div>
                <div style={{ fontSize: 11, color: C.textMid, marginTop: 4 }}>8760 hours loaded · Daily avg: {fmt(load.daily_kwh, 1)} kWh</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>Click to upload hourly load CSV</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>Must contain 8760 rows of hourly load in kW · Comma, semicolon, or tab delimited</div>
              </>
            )}
          </div>
          {errors?.csv && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, fontSize: 12, color: C.red }}>
              {errors.csv}
            </div>
          )}
          <div style={{ marginTop: 14, padding: '12px 14px', background: C.surface, borderRadius: 8, fontSize: 11, color: C.textDim, lineHeight: 1.7 }}>
            <strong style={{ color: C.textMid }}>CSV format:</strong> One kW value per row, Hour 1 = 1 Jan 00:00. Optional header row auto-skipped. Multiple columns: last numeric column is used.
          </div>
        </Card>
      )}

      {/* ══════════════════ MODE 4: CUSTOM BUILDER ══════════════════ */}
      {load.method === 'custom' && (
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Label>Daily energy demand</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <input
                type="number" min={0.1} step={0.5}
                value={load.daily_kwh}
                onChange={e => ld('daily_kwh', parseFloat(e.target.value) || 0)}
                style={{ width: 110, padding: '9px 12px', fontSize: 16, fontFamily: MONO, fontWeight: 600, border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.text, outline: 'none' }}
              />
              <span style={{ fontSize: 14, color: C.textMid }}>kWh/day</span>
            </div>
          </div>
          <CustomDemandBuilder
            segments={load.customSegments || { morning: 0.4, daytime: 0.3, evening: 1.0, night: 0.2 }}
            onChange={segs => ld('customSegments', segs)}
            dailyKwh={parseFloat(load.daily_kwh) || 0}
          />
        </Card>
      )}

      {/* ══════════════════ LOAD CURVE PREVIEW ══════════════════ */}
      {showPreview && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, textTransform: 'uppercase', letterSpacing: 1 }}>24-hr Load Curve</div>
              {load.method !== 'csv' && (
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                  {load.method === 'custom' ? 'Based on custom segment inputs' : `Shape: ${LOAD_SHAPES[load.shape_key?.startsWith('community_') ? 'rural_village' : (load.shape_key || 'rural_village')]?.label || 'Rural Evening Peak'}`}
                </div>
              )}
              {load.method === 'csv' && (
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>First 24 hours of uploaded CSV</div>
              )}
            </div>
            <div style={{ fontSize: 22, fontFamily: MONO, fontWeight: 600, color: C.cyan }}>
              {fmt(load.daily_kwh, 1)} <span style={{ fontSize: 12, color: C.textMid }}>kWh/day</span>
            </div>
          </div>

          <LoadCurvePreview values={previewShape} color={C.cyan} height={110} />
          <LoadMetrics values={previewShape} dailyKwh={parseFloat(load.daily_kwh) || 0} />
        </Card>
      )}

      {/* ══════════════════ LOAD GROWTH (all modes) ══════════════════ */}
      <Card style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Label hint="optional">Load growth modelling</Label>
            <div style={{ fontSize: 12, color: C.textMid, maxWidth: 420 }}>
              Annual demand growth rate. Scales the base year profile by compound growth for NPV cashflow projections. Set to 0 for no growth.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <input
              type="number" min={0} max={0.20} step={0.01}
              value={load.load_growth_rate || 0}
              onChange={e => ld('load_growth_rate', parseFloat(e.target.value) || 0)}
              style={{ width: 80, padding: '8px 10px', fontSize: 14, fontFamily: MONO, border: `1.5px solid ${C.border}`, borderRadius: 8, color: C.text, textAlign: 'center', outline: 'none' }}
            />
            <span style={{ fontSize: 13, color: C.textMid }}>%/yr</span>
          </div>
        </div>
        {(load.load_growth_rate > 0) && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.gold}15`, borderRadius: 8, fontSize: 12, color: C.gold }}>
            At {fmt(load.load_growth_rate * 100, 1)}%/yr growth — year 10 demand will be ~{fmt(load.daily_kwh * Math.pow(1 + load.load_growth_rate, 9), 1)} kWh/day
            · year 20 demand ~{fmt(load.daily_kwh * Math.pow(1 + load.load_growth_rate, 19), 1)} kWh/day
          </div>
        )}
      </Card>
    </div>
  );
}
