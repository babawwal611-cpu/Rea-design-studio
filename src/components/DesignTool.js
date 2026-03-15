import React, { useState, useCallback, useRef, useEffect } from 'react';
import LoadProfileStep from './LoadProfileStep';

import {
  simulateSystem,
  calculateFinancials,
  parseLoadCSV,
  generateLoadProfile,
  fetchPVGISSolar,
  generateSyntheticSolar,
  NIGERIA_DEFAULTS,
  NIGERIA_CITIES_SOLAR,
} from '../utils/simulateSystem';
import SiteMap from './SiteMap';
import EnergyFlowSimulator from './EnergyFlow';

/* ─── Design Tokens — Light Theme ───────────────────────────────────────── */
const C = {
  bg:        '#F4F7FB',
  surface:   '#FFFFFF',
  panel:     '#FFFFFF',
  border:    '#E2EAF2',
  borderHi:  '#C5D5E8',
  cyan:      '#0070CC',
  cyanDark:  '#005099',
  cyanDim:   '#EAF3FC',
  blue:      '#2563EB',
  blueBright:'#3B9EFF',
  gold:      '#D97706',
  goldDim:   '#FEF3C7',
  red:       '#DC2626',
  purple:    '#7C3AED',
  text:      '#1A2B3C',
  textMid:   '#4A6580',
  textDim:   '#94A3B8',
  white:     '#FFFFFF',
};

const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap";

/* ─── Utility ────────────────────────────────────────────────────────────── */
const fmt  = (n, dec = 0) => typeof n === 'number' && isFinite(n) ? n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—';
const fmtN = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}k` : fmt(n);

/* ─── Sub-components ─────────────────────────────────────────────────────── */
const Label = ({ children, hint }) => (
  <div style={{ marginBottom: 6 }}>
    <span style={{ fontSize: 10, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{children}</span>
    {hint && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 8, fontFamily: "'DM Sans', sans-serif" }}>{hint}</span>}
  </div>
);

const Input = ({ value, onChange, type = 'number', min, max, step, placeholder, unit, style = {} }) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      min={min} max={max} step={step} placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 14px', paddingRight: unit ? 48 : 14,
        background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif",
        outline: 'none', transition: 'border 0.2s, box-shadow 0.2s',
        ...style,
      }}
      onFocus={e => { e.target.style.borderColor = C.cyan; e.target.style.boxShadow = `0 0 0 3px ${C.cyan}18`; e.target.style.background = '#fff'; }}
      onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
    />
    {unit && <span style={{ position: 'absolute', right: 12, fontSize: 10, color: C.textDim, fontFamily: "'DM Sans', sans-serif", pointerEvents: 'none' }}>{unit}</span>}
  </div>
);

const Select = ({ value, onChange, options, style = {} }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{
    width: '100%', padding: '10px 14px', background: '#F8FAFC',
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: 'none', cursor: 'pointer', ...style,
  }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Toggle = ({ checked, onChange, color = C.cyan }) => (
  <button onClick={() => onChange(!checked)} style={{
    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
    background: checked ? color : C.border, position: 'relative', transition: 'all 0.2s', flexShrink: 0,
    boxShadow: checked ? `0 2px 6px ${color}40` : 'none',
  }}>
    <span style={{
      position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18,
      borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    }} />
  </button>
);

const Btn = ({ children, onClick, variant = 'primary', disabled, style = {}, icon }) => {
  const variants = {
    primary:   { background: `linear-gradient(135deg, ${C.cyanDark}, ${C.cyan})`, color: '#fff', border: 'none', boxShadow: `0 2px 8px ${C.cyan}40` },
    secondary: { background: 'transparent', color: C.cyan, border: `1px solid ${C.cyan}` },
    ghost:     { background: 'transparent', color: C.textMid, border: `1px solid ${C.border}` },
    danger:    { background: 'transparent', color: C.red,  border: `1px solid ${C.red}44` },
    gold:      { background: `linear-gradient(135deg, #92400e, ${C.gold})`, color: '#fff', border: 'none' },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v, padding: '10px 20px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
      letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 7,
      opacity: disabled ? 0.4 : 1, transition: 'all 0.2s', whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
};

const Card = ({ children, style = {}, glow }) => (
  <div style={{
    background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
    padding: '20px',
    boxShadow: glow ? `0 0 0 1px ${glow}20, 0 4px 16px ${glow}10` : '0 1px 4px rgba(0,0,0,0.05)',
    ...style,
  }}>
    {children}
  </div>
);

const SectionHead = ({ icon, title, sub }) => (
  <div style={{ marginBottom: 4 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text, fontFamily: "'DM Sans', sans-serif", letterSpacing: -0.5 }}>{title}</h2>
    {sub && <p style={{ margin: 0, fontSize: 12, color: C.textMid, fontFamily: "'DM Sans', sans-serif", paddingLeft: 30 }}>{sub}</p>}
  </div>
);

/* Mini sparkline using SVG */

/* Radial gauge for renewable fraction */
const Gauge = ({ value, max = 100, color = C.cyan, label, size = 120 }) => {
  const r = size * 0.38;
  const cx = size / 2, cy = size / 2;
  const pct = Math.min(value / max, 1);
  const startAngle = Math.PI;
  const endAngle   = Math.PI + pct * Math.PI;
  const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
  const largeArc = pct > 0.5 ? 1 : 0;
  return (
    <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
      <defs>
        <filter id="gaugeGlow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={C.border} strokeWidth={8} strokeLinecap="round" />
      {pct > 0 && <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" filter="url(#gaugeGlow)" />}
      <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize={size * 0.18} fontWeight={700} fontFamily="'DM Sans', sans-serif">{fmt(value, 1)}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={C.textDim} fontSize={size * 0.09} fontFamily="'DM Sans', sans-serif">{label}</text>
    </svg>
  );
};

/* ─── Bar Chart ──────────────────────────────────────────────────────────── */
const MonthlyBarChart = ({ monthly }) => {
  if (!monthly) return null;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const maxVal = Math.max(...monthly.map(m => Math.max(m.pv_kwh, m.load_kwh)));
  const W = 520, H = 140, padL = 40, padB = 20;
  const barW = (W - padL) / 12 - 4;

  return (
    <svg id="chart-monthly" width="100%" viewBox={`0 0 ${W} ${H + padB}`} style={{ display: 'block' }}>
      <defs> {/* ← ADD THIS MISSING OPENING TAG */}
        <linearGradient id="pvBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={C.cyanDark} stopOpacity="0.5"/>
        </linearGradient>
      </defs>
      {monthly.map((m, i) => {
        const x   = padL + i * ((W - padL) / 12);
        const pvH  = maxVal > 0 ? (m.pv_kwh  / maxVal) * H : 0;
        const ldH  = maxVal > 0 ? (m.load_kwh / maxVal) * H : 0;
        const genH = maxVal > 0 ? (m.gen_kwh  / maxVal) * H : 0;
        return (
          <g key={i}>
            <rect x={x + 1} y={H - ldH} width={barW - 2} height={ldH} fill="none" stroke={C.borderHi} strokeWidth={1} rx={2} />
            <rect x={x + 2} y={H - pvH} width={barW - 4} height={pvH} fill="url(#pvBarGrad)" rx={2} />
            {genH > 0 && <rect x={x + 2} y={H - ldH} width={barW - 4} height={genH} fill={C.gold} fillOpacity={0.8} rx={2} />}
            {m.excess_kwh > 0 && <rect x={x + 2} y={H - pvH} width={barW - 4} height={Math.min(4, pvH)} fill={C.blueBright} fillOpacity={0.8} />}
            <text x={x + barW / 2} y={H + padB - 2} textAnchor="middle" fill={C.textDim} fontSize={9} fontFamily="'DM Sans',sans-serif">{MONTHS[i]}</text>
          </g>
        );
      })}
      <text x={4} y={8} fill={C.textDim} fontSize={8} fontFamily="'DM Sans',sans-serif">kWh</text>
    </svg>
  );
};

/* ─── SOC Profile Chart (annual, sampled every 24h) ─────────────────────── */
const SOCChart = ({ soc_array, capacity_kwh, dod }) => {
  if (!soc_array) return null;
  const W = 520, H = 100, padL = 40, padB = 20;
  const samples = Array.from({ length: 365 }, (_, d) => soc_array[d * 24] || 0);
  const pctSamples = samples.map(v => (v / capacity_kwh) * 100);
  const minSOC = capacity_kwh * (1 - dod);
  const minPct = (minSOC / capacity_kwh) * 100;
  const toX = i => padL + (i / 364) * (W - padL);
  const toY = v => H - (v / 100) * H;
  const pts = pctSamples.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  const MONTH_DAYS = [0,31,59,90,120,151,181,212,243,273,304,334];
  return (
    <svg id="chart-soc" width="100%" viewBox={`0 0 ${W} ${H + padB}`} style={{ display: 'block' }}>
        <defs> {/* ← ADD THIS MISSING OPENING TAG */}
        <linearGradient id="socGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.blueBright} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={C.blueBright} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <line x1={padL} y1={toY(minPct)} x2={W} y2={toY(minPct)} stroke={`${C.red}60`} strokeWidth={1} strokeDasharray="4,3" />
      <text x={padL - 2} y={toY(minPct) + 3} textAnchor="end" fill={C.red} fontSize={7} fontFamily="'DM Sans',sans-serif">DoD</text>
      <line x1={padL} y1={toY(100)} x2={W} y2={toY(100)} stroke={`${C.borderHi}`} strokeWidth={0.5} />
      <polygon points={`${toX(0)},${H} ${pts} ${toX(364)},${H}`} fill="url(#socGrad)" />
      <polyline points={pts} fill="none" stroke={C.blueBright} strokeWidth={1.5} />
      {MONTHS.map((m, i) => (
        <text key={m} x={toX(MONTH_DAYS[i])} y={H + padB - 2} fill={C.textDim} fontSize={8} fontFamily="'DM Sans',sans-serif">{m}</text>
      ))}
      {[0,50,100].map(v => (
        <text key={v} x={padL - 4} y={toY(v) + 3} textAnchor="end" fill={C.textDim} fontSize={7} fontFamily="'DM Sans',sans-serif">{v}%</text>
      ))}
    </svg>
  );
};

/* ─── Hourly Power Balance Chart (one sample week) ──────────────────────── */
const HourlyChart = ({ hourly, weekStart = 0 }) => {
  if (!hourly) return null;
  const W = 520, H = 120, padL = 40, padB = 20;
  const HOURS = 168;
  const start = weekStart * 24;
  const load   = Array.from(hourly.load).slice(start, start + HOURS);
  const pv     = Array.from(hourly.pv_output).slice(start, start + HOURS);
  const gen    = Array.from(hourly.gen_output).slice(start, start + HOURS);
  const bDisc  = Array.from(hourly.battery_discharge).slice(start, start + HOURS);
  const maxVal = Math.max(...load, 0.001);
  const toX = i => padL + (i / (HOURS - 1)) * (W - padL);
  const toY = v => H - Math.min((v / maxVal) * H, H);
  const line = (arr, color, width = 1.2) => {
    const pts = arr.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
    return <polyline points={pts} fill="none" stroke={color} strokeWidth={width} />;
  };
  const days = Array.from({ length: 7 }, (_, d) => d);
  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const startDay = Math.floor(start / 24) % 7;
  return (
    <svg id="chart-hourly" width="100%" viewBox={`0 0 ${W} ${H + padB}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="pvAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.cyan} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={C.cyan} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {days.map(d => (
        <g key={d}>
          <line x1={toX(d * 24)} y1={0} x2={toX(d * 24)} y2={H} stroke={C.border} strokeWidth={0.5} />
          <text x={toX(d * 24 + 12)} y={H + padB - 2} textAnchor="middle" fill={C.textDim} fontSize={8} fontFamily="'DM Sans',sans-serif">{DAY_LABELS[(startDay + d) % 7]}</text>
        </g>
      ))}
      <polygon
        points={`${toX(0)},${H} ${pv.map((v,i) => `${toX(i)},${toY(v)}`).join(' ')} ${toX(HOURS-1)},${H}`}
        fill="url(#pvAreaGrad)"
      />
      {line(pv, C.cyan, 1.5)}
      {line(gen, C.red, 1)}
      {line(bDisc, C.blueBright, 1)}
      {line(load, C.gold, 2)}
      <text x={4} y={10} fill={C.textDim} fontSize={7} fontFamily="'DM Sans',sans-serif">kW</text>
      <text x={padL - 4} y={toY(maxVal) + 3} textAnchor="end" fill={C.textDim} fontSize={7} fontFamily="'DM Sans',sans-serif">{fmt(maxVal,1)}</text>
    </svg>
  );
};

/* ─── Energy Mix Donut Chart ─────────────────────────────────────────────── */
const DonutChart = ({ slices, size = 140 }) => {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.35, innerR = size * 0.22;
  let angle = -Math.PI / 2;
  const paths = slices.filter(s => s.value > 0).map(s => {
    const sweep = (s.value / total) * 2 * Math.PI;
    const x1o = cx + r * Math.cos(angle),       y1o = cy + r * Math.sin(angle);
    const x1i = cx + innerR * Math.cos(angle),   y1i = cy + innerR * Math.sin(angle);
    angle += sweep;
    const x2o = cx + r * Math.cos(angle),        y2o = cy + r * Math.sin(angle);
    const x2i = cx + innerR * Math.cos(angle),   y2i = cy + innerR * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return {
      d: `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${innerR} ${innerR} 0 ${large} 0 ${x1i} ${y1i} Z`,
      color: s.color, label: s.label, pct: ((s.value / total) * 100).toFixed(1),
    };
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {paths.map((p, i) => <path key={i} d={p.d} fill={p.color} stroke={C.panel} strokeWidth={1.5} />)}
        <text x={cx} y={cy + 4} textAnchor="middle" fill={C.textMid} fontSize={size * 0.09} fontFamily="'DM Sans',sans-serif">Energy</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={C.textMid} fontSize={size * 0.09} fontFamily="'DM Sans',sans-serif">Mix</text>
      </svg>
      <div>
        {paths.map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: C.textMid, fontFamily: "'DM Sans',sans-serif" }}>{p.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: p.color, fontFamily: "'DM Sans', sans-serif", marginLeft: 'auto', minWidth: 40, textAlign: 'right' }}>{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Battery cycle count helper ────────────────────────────────────────── */
const countBatteryCycles = (soc_array, capacity_kwh) => {
  // Count full equivalent cycles: total charge throughput / capacity
  let totalCharge = 0;
  for (let h = 1; h < soc_array.length; h++) {
    const delta = soc_array[h] - soc_array[h - 1];
    if (delta > 0) totalCharge += delta;
  }
  return capacity_kwh > 0 ? Math.round(totalCharge / capacity_kwh) : 0;
};

/* ─── Loss of Load Probability helper ───────────────────────────────────── */
const calcLOLP = (unserved_array) => {
  const hoursWithUnserved = Array.from(unserved_array).filter(v => v > 0.001).length;
  return parseFloat(((hoursWithUnserved / 8760) * 100).toFixed(2));
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const STEPS = [
  { id: 'project',  label: 'Project',   },
  { id: 'load',     label: 'Load',      },
  { id: 'solar',    label: 'Solar',     },
  { id: 'system',   label: 'System',    },
  { id: 'finance',  label: 'Finance',   },
  { id: 'simulate', label: 'Simulate',  },
  { id: 'results',  label: 'Results',   },
];

const DesignTool = ({ onBack, onOpenSizing, sizingPreload, onClearPreload }) => {
  const [step, setStep] = useState(0);
  const [sim,  setSim]  = useState(null);
  const [fin,  setFin]  = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [simLog, setSimLog] = useState([]);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef();

  /* ── Project config ── */
  const [project, setProject] = useState({
    name:        '',
    location:    '',
    lat:         '',
    lng:         '',
    description: '',
    currency:    '₦',
  });

  /* ── Load config ── */
  const [load, setLoad] = useState({
  method:          'community',          // 'community' | 'facility' | 'csv' | 'custom'
  template:        'community_100hh',
  daily_kwh:       137,
  shape_key:       'community_100hh',    // maps to LOAD_SHAPES key (or community_ key)
  profile_type:    'community_100hh',    // kept for backward compat
  csvData:         null,
  csvName:         '',
  customProfile:   null,
  customSegments:  { morning: 0.4, daytime: 0.3, evening: 1.0, night: 0.2 },
  load_growth_rate: 0,                   // annual demand growth (0 = no growth)
  });

  /* ── Solar config ── */
  const [solar, setSolar] = useState({
    method:     'pvgis',
    cityIndex:  0,
    avg_ghi:    5.5,
    avg_temp:   29,
    solarData:  null,
    fetching:   false,
    fetchError: '',
    fetched:    false,
    dataSource: '',   // 'PVGIS' | 'NASA POWER' | 'Synthetic' | 'City Preset'
  });

  /* ── System config ── */
  const [system, setSystem] = useState({
    pv_capacity_kw:        50,
    pv_tilt:               15,
    pv_alpha:              -0.004,
    pv_derating:           0.85,       // system derating factor (soiling, wiring, mismatch)
    inverter_capacity_kw:  40,         // inverter/charge controller rated capacity
    inverter_efficiency:   0.96,       // inverter conversion efficiency
    battery_capacity_kwh:  100,
    battery_type:          'lithium',
    battery_dod:           0.85,
    battery_eta_charge:    0.95,
    battery_eta_discharge: 0.95,
    battery_c_rate:        0.5,
    gen_enabled:           true,
    gen_capacity_kw:       30,
    gen_min_load_pct:      0.30,       // minimum operating load (30% of rated)
    gen_cycle_charging:    false,
  });

  /* ── Financial config ── */
  const [finance, setFinance] = useState({
    pv_cost_per_kw:       ,
    battery_cost_per_kwh: 1000000,
    gen_cost_per_kw:      320000,
    inverter_cost_per_kw: 200000,
    bos_pct:              0.17,
    installation_pct:     0.12,
    om_pct_annual:        0.015,
    fuel_price_per_litre: 1200,
    discount_rate:        0.12,
    project_lifetime:     20,
    tariff_per_kwh:       150,
  });

  const proj = (k, v) => setProject(p => ({ ...p, [k]: v }));
  const ld   = (k, v) => setLoad(p => ({ ...p, [k]: v }));
  const sol  = (k, v) => setSolar(p => ({ ...p, [k]: v }));
  const sys  = (k, v) => setSystem(p => ({ ...p, [k]: v }));
  const fin_ = (k, v) => setFinance(p => ({ ...p, [k]: v }));

  /* ── Load battery defaults when type changes ── */
  useEffect(() => {
    if (system.battery_type === 'lithium') {
      sys('battery_dod', 0.85);
      sys('battery_eta_charge', 0.96);
      sys('battery_eta_discharge', 0.96);
      sys('battery_c_rate', 0.5);
      fin_('battery_cost_per_kwh', 1000000);
    } else {
      sys('battery_dod', 0.50);
      sys('battery_eta_charge', 0.85);
      sys('battery_eta_discharge', 0.85);
      sys('battery_c_rate', 0.2);
      fin_('battery_cost_per_kwh', 400000);
    }
  // eslint-disable-next-line
  }, [system.battery_type]);

  /* ── Apply sizing preload from Predictive Sizing tool ── */
  useEffect(() => {
    if (!sizingPreload) return;
    if (sizingPreload.pv_capacity_kw)       sys('pv_capacity_kw',       sizingPreload.pv_capacity_kw);
    if (sizingPreload.battery_capacity_kwh) sys('battery_capacity_kwh', sizingPreload.battery_capacity_kwh);
    if (sizingPreload.inverter_capacity_kw) sys('inverter_capacity_kw', sizingPreload.inverter_capacity_kw);
    if (sizingPreload.gen_capacity_kw)      sys('gen_capacity_kw',      sizingPreload.gen_capacity_kw);
    if (typeof sizingPreload.gen_enabled === 'boolean') sys('gen_enabled', sizingPreload.gen_enabled);
    if (sizingPreload.daily_kwh) {
      ld('method', 'manual');
      ld('daily_kwh', sizingPreload.daily_kwh);
    }
    // Jump to system step so user sees pre-filled values
    setStep(3);
    if (onClearPreload) onClearPreload();
  // eslint-disable-next-line
  }, [sizingPreload]);

  /* ── CSV upload handler ── */
  const handleCSV = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const profile = parseLoadCSV(ev.target.result);
        ld('csvData', profile);
        ld('csvName', file.name);
        ld('method', 'csv');
        const daily = Array.from(profile).reduce((a, b) => a + b, 0) / 365;
        ld('daily_kwh', parseFloat(daily.toFixed(1)));
      } catch (err) {
        setErrors(er => ({ ...er, csv: err.message }));
      }
    };
    reader.readAsText(file);
  }, []);

  /* ── Fetch solar data (PVGIS → NASA POWER → Synthetic cascade) ── */
  const fetchSolar = useCallback(async () => {
    const lat = parseFloat(solar.method === 'pvgis' ? project.lat : NIGERIA_CITIES_SOLAR[solar.cityIndex].lat);
    const lng = parseFloat(solar.method === 'pvgis' ? project.lng : NIGERIA_CITIES_SOLAR[solar.cityIndex].lng);

    if (solar.method === 'pvgis' && (isNaN(lat) || isNaN(lng))) {
      setErrors(er => ({ ...er, solar: 'Please enter valid coordinates first (Step 1)' }));
      return;
    }

    sol('fetching', true);
    sol('fetchError', '');
    sol('fetched', false);
    sol('dataSource', '');

    try {
      const data = await fetchPVGISSolar(lat, lng);
      // Detect which source was used from the first record's `source` tag
      const source = data[0]?.source || 'PVGIS';
      sol('solarData', data);
      sol('dataSource', source);
      const avgGHI = data.reduce((s, h) => s + h.ghi, 0) / (8760 * 1000);
      sol('avg_ghi', parseFloat((avgGHI * 24).toFixed(2)));
      sol('fetched', true);
    } catch (err) {
      // Both PVGIS and NASA failed — fall back to embedded city-based synthetic
      sol('fetchError', `Remote APIs unavailable. Using synthetic data based on nearest city profile.`);
      const cityData = NIGERIA_CITIES_SOLAR.find(c => {
        const dLat = Math.abs(c.lat - lat), dLng = Math.abs(c.lng - lng);
        return dLat < 3 && dLng < 3;
      }) || NIGERIA_CITIES_SOLAR[0];
      const data = generateSyntheticSolar(cityData.avg_ghi, cityData.avg_temp);
      sol('solarData', data);
      sol('avg_ghi', cityData.avg_ghi);
      sol('dataSource', 'Synthetic');
      sol('fetched', true);
    } finally {
      sol('fetching', false);
    }
  }, [solar.method, solar.cityIndex, project.lat, project.lng]);

  /* ── Select city preset ── */
  const selectCity = useCallback((idx) => {
    const city = NIGERIA_CITIES_SOLAR[idx];
    sol('cityIndex', idx);
    sol('avg_ghi', city.avg_ghi);
    sol('avg_temp', city.avg_temp);
    const data = generateSyntheticSolar(city.avg_ghi, city.avg_temp);
    sol('solarData', data);
    sol('fetched', true);
    if (solar.method === 'city') {
      proj('lat', city.lat.toString());
      proj('lng', city.lng.toString());
    }
  }, [solar.method]);

  /* ── Run simulation ── */
  const runSimulation = useCallback(async () => {
    setSimRunning(true);
    setSimProgress(0);
    setSimLog([]);
    setSim(null);
    setFin(null);

    const log = (msg) => setSimLog(l => [...l, `${new Date().toISOString().slice(11,19)} ${msg}`]);

    try {
      log('Preparing load profile...');
      setSimProgress(10);

      // Build load profile
      let loadProfile;
      if (load.method === 'csv' && load.csvData) {
        loadProfile = load.csvData;
        log(`Loaded CSV: ${load.csvName} (${loadProfile.length} hours)`);
 
      } else if (load.method === 'custom' && load.customSegments) {
        // Custom demand builder — generate profile from segment sliders
        const SEGMENT_HOURS = {
          night: [0,1,2,3,4,5], morning: [6,7,8,9],
          daytime: [10,11,12,13,14,15,16], evening: [17,18,19,20,21,22,23],
        };
        const shape24 = new Array(24).fill(0);
        Object.entries(SEGMENT_HOURS).forEach(([seg, hours]) => {
          hours.forEach(h => { shape24[h] = load.customSegments[seg]; });
        });
        const growthOpts = { loadGrowthRate: parseFloat(load.load_growth_rate) || 0, targetYear: 1 };
        loadProfile = generateLoadProfile(parseFloat(load.daily_kwh), 'rural_village', growthOpts);
        // Re-scale to match custom shape
        const stdShape = [0.15,0.10,0.08,0.07,0.08,0.12,0.30,0.55,0.50,0.45,0.42,0.40,0.45,0.42,0.40,0.45,0.60,0.80,1.00,0.95,0.85,0.70,0.45,0.25];
        const stdSum = stdShape.reduce((a,b) => a+b,0);
        const customSum = shape24.reduce((a,b) => a+b,0);
        for (let h = 0; h < 8760; h++) {
          const hr = h % 24;
          loadProfile[h] = loadProfile[h] * (shape24[hr] / (stdShape[hr] || 0.01)) * (stdSum / (customSum || 1));
        }
        log(`Generated custom demand builder profile: ${load.daily_kwh} kWh/day`);
 
      } else {
        // Community or facility template
        const tpl = NIGERIA_DEFAULTS.load_templates.find(t => t.id === load.template);
        const dailyKWh = parseFloat(load.daily_kwh) || (tpl?.daily_kwh || 120);
        // Use shape_key from load state (set by LoadProfileStep when template is selected)
        const shapeKey = load.shape_key || tpl?.shape_key || 'rural_village';
        const growthOpts = {
          loadGrowthRate: parseFloat(load.load_growth_rate) || 0,
          targetYear: 1,
        };
        loadProfile = generateLoadProfile(dailyKWh, shapeKey, growthOpts);
        const growthNote = growthOpts.loadGrowthRate > 0 ? ` (${(growthOpts.loadGrowthRate * 100).toFixed(1)}%/yr growth)` : '';
        log(`Generated ${shapeKey} load profile: ${dailyKWh} kWh/day${growthNote}`);
      }

      log('Loading solar resource data...');
      setSimProgress(25);

      // Build solar data
      let solarData = solar.solarData;
      if (!solarData) {
        log('No solar data fetched — using synthetic data from GHI input');
        solarData = generateSyntheticSolar(parseFloat(solar.avg_ghi), parseFloat(solar.avg_temp));
      }
      const peakGHI = Math.max(...solarData.map(h => typeof h === 'object' ? h.ghi : h));
      log(`Solar data ready. Peak GHI: ${peakGHI.toFixed(0)} W/m²`);

      log('Configuring system components...');
      setSimProgress(40);

      const pvConfig = {
        capacity_kw:  parseFloat(system.pv_capacity_kw),
        alpha:        parseFloat(system.pv_alpha),
        derating:     parseFloat(system.pv_derating),
        inverter_kw:  parseFloat(system.inverter_capacity_kw),
        inverter_eta: parseFloat(system.inverter_efficiency),
      };
      const batteryConfig = {
        capacity_kwh:     parseFloat(system.battery_capacity_kwh),
        dod:              parseFloat(system.battery_dod),
        eta_charge:       parseFloat(system.battery_eta_charge),
        eta_discharge:    parseFloat(system.battery_eta_discharge),
        c_rate:           parseFloat(system.battery_c_rate),
      };
      const genConfig = {
        enabled:        system.gen_enabled,
        capacity_kw:    parseFloat(system.gen_capacity_kw),
        min_load_pct:   parseFloat(system.gen_min_load_pct),
        cycleCharging:  system.gen_cycle_charging,
        fuel_price:     parseFloat(finance.fuel_price_per_litre),
      };

      log(`PV: ${pvConfig.capacity_kw} kWp (derating ${pvConfig.derating}) | Inverter: ${pvConfig.inverter_kw} kW | Battery: ${batteryConfig.capacity_kwh} kWh | Gen: ${genConfig.enabled ? genConfig.capacity_kw + ' kW (min ' + Math.round(genConfig.min_load_pct*100) + '%)' : 'disabled'}`);

      log('Running 8760-hour dispatch simulation...');
      setSimProgress(55);

      // Use setTimeout to yield to React render cycle
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = simulateSystem({ loadProfile, solarData, pvConfig, batteryConfig, genConfig });

      log(`Simulation complete. RF: ${result.annual.renewable_fraction}% | Unmet: ${result.annual.unmet_load_fraction}%`);
      setSimProgress(75);

      log('Running financial analysis...');

      const systemConfig = {
        pv_capacity_kw:       pvConfig.capacity_kw,
        battery_capacity_kwh: batteryConfig.capacity_kwh,
        gen_capacity_kw:      genConfig.capacity_kw,
        gen_enabled:          genConfig.enabled,
        inverter_capacity_kw: pvConfig.inverter_kw,
      };
      const financialConfig = {
        pv_cost_per_kw:        parseFloat(finance.pv_cost_per_kw),
        battery_cost_per_kwh:  parseFloat(finance.battery_cost_per_kwh),
        gen_cost_per_kw:       parseFloat(finance.gen_cost_per_kw),
        inverter_cost_per_kw:  parseFloat(finance.inverter_cost_per_kw),
        bos_pct:               parseFloat(finance.bos_pct),
        installation_pct:      parseFloat(finance.installation_pct),
        om_pct_annual:         parseFloat(finance.om_pct_annual),
        fuel_price_per_litre:  parseFloat(finance.fuel_price_per_litre),
        discount_rate:         parseFloat(finance.discount_rate),
        project_lifetime_years: parseInt(finance.project_lifetime),
        tariff_per_kwh:        parseFloat(finance.tariff_per_kwh),
        currency:              project.currency,
      };

      const finResult = calculateFinancials({ simResult: result, systemConfig, financialConfig });
      log(`CapEx: ${project.currency}${fmtN(finResult.capex.total)} | LCOE: ${project.currency}${fmt(finResult.metrics.lcoe, 2)}/kWh`);

      setSimProgress(95);
      await new Promise(resolve => setTimeout(resolve, 100));

      setSim(result);
      setFin(finResult);
      setSimProgress(100);
      log('Analysis complete. Viewing results...');

      setTimeout(() => setStep(6), 600);
    } catch (err) {
      log(`❌ Error: ${err.message}`);
      setErrors(er => ({ ...er, sim: err.message }));
    } finally {
      setSimRunning(false);
    }
  }, [load, solar, system, finance, project.currency]);

  /* ── Nav helpers ── */
  const canProceed = useCallback(() => {
    switch(step) {
      case 0: return project.name.trim().length > 0;
      case 1: return load.method === 'csv' ? !!load.csvData : load.daily_kwh > 0;
      case 2: return solar.fetched || solar.method === 'manual';
      case 3: return system.pv_capacity_kw > 0 && system.battery_capacity_kwh > 0;
      case 4: return true;
      default: return true;
    }
  }, [step, project, load, solar, system]);

  /* ── Export results CSV ── */
  const exportCSV = useCallback(() => {
    if (!sim) return;
    const rows = ['hour,load_kw,pv_kw,battery_discharge_kw,battery_charge_kw,generator_kw,excess_kw,unserved_kw,soc_kwh'];
    for (let h = 0; h < 8760; h++) {
      rows.push([
        h+1,
        sim.hourly.load[h]?.toFixed(3) || 0,
        sim.hourly.pv_output[h].toFixed(3),
        sim.hourly.battery_discharge[h].toFixed(3),
        sim.hourly.battery_charge[h].toFixed(3),
        sim.hourly.gen_output[h].toFixed(3),
        sim.hourly.excess_energy[h].toFixed(3),
        sim.hourly.unserved_load[h].toFixed(3),
        sim.hourly.battery_soc[h].toFixed(3),
      ].join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${project.name || 'minigrid'}-hourly-results.csv`; a.click();
  }, [sim, project.name]);

  /* ── Export PDF Report ── */
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const exportPDF = useCallback(async () => {
    if (!sim || !fin) return;
    setPdfGenerating(true);

    try {
      // Dynamically load jsPDF and html2canvas from CDN
      const loadScript = (src) => new Promise((res, rej) => {
        if (document.querySelector(`script[src="${src}"]`)) return res();
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });

      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, H = 297;
      const margin = 16;
      const contentW = W - margin * 2;
      let y = margin;

      const cycles = countBatteryCycles(sim.hourly.battery_soc, system.battery_capacity_kwh);
      const lolp   = calcLOLP(sim.hourly.unserved_load);

      // ── Helpers ──────────────────────────────────────────────────────────
      const checkPage = (needed = 20) => {
        if (y + needed > H - margin) { doc.addPage(); y = margin; return true; }
        return false;
      };

      const drawHRule = (color = [226,234,242]) => {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.3);
        doc.line(margin, y, W - margin, y);
        y += 4;
      };

      const sectionTitle = (text) => {
        checkPage(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 112, 204);
        doc.text(text.toUpperCase(), margin, y);
        y += 1;
        doc.setDrawColor(0, 112, 204);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + contentW, y);
        y += 5;
        doc.setTextColor(26, 43, 60);
      };

      const kpiRow = (items) => {
        // items: [{label, value, color?}] — up to 4 per row
        const colW = contentW / items.length;
        items.forEach((item, i) => {
          const x = margin + i * colW;
          // Box
          doc.setFillColor(244, 247, 251);
          doc.setDrawColor(226, 234, 242);
          doc.roundedRect(x, y, colW - 3, 16, 2, 2, 'FD');
          // Value
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          if (item.color) doc.setTextColor(...item.color);
          else doc.setTextColor(26, 43, 60);
          doc.text(String(item.value), x + 3, y + 7);
          // Label
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(74, 101, 128);
          doc.text(item.label, x + 3, y + 13);
        });
        y += 20;
      };

      // Capture an SVG element as image and embed in PDF
      const svgToImage = async (svgEl) => {
        const svgData  = new XMLSerializer().serializeToString(svgEl);
        const canvas   = document.createElement('canvas');
        const bbox     = svgEl.getBoundingClientRect();
        const scale    = 2;
        canvas.width   = bbox.width  * scale;
        canvas.height  = bbox.height * scale;
        const ctx      = canvas.getContext('2d');
        const img      = new Image();
        const svgBlob  = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url      = URL.createObjectURL(svgBlob);
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
        URL.revokeObjectURL(url);
        return { dataUrl: canvas.toDataURL('image/png'), w: bbox.width, h: bbox.height };
      };

      // ── PAGE 1 — Cover ────────────────────────────────────────────────────
      // Header banner
      doc.setFillColor(0, 80, 153);
      doc.rect(0, 0, W, 42, 'F');
      doc.setFillColor(0, 112, 204);
      doc.rect(0, 38, W, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('Mini-Grid Pre-Feasibility Report', margin, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(200, 220, 240);
      doc.text(`${project.name || 'Unnamed Project'} · ${project.location || ''}`, margin, 28);
      doc.text(`Prepared by MIRIDA  ·  ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`, margin, 35);

      y = 52;
      doc.setTextColor(26, 43, 60);

      // Project info box
      doc.setFillColor(234, 243, 252);
      doc.setDrawColor(0, 112, 204);
      doc.roundedRect(margin, y, contentW, 28, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 80, 153);
      doc.text('PROJECT INFORMATION', margin + 5, y + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(26, 43, 60);
      const info = [
        `Location: ${project.location || '—'}  |  Coordinates: ${project.lat || '—'}, ${project.lng || '—'}`,
        `Solar Data Source: ${solar.dataSource || 'Synthetic'}  |  Avg GHI: ${solar.avg_ghi} kWh/m²/day`,
        `Report Date: ${new Date().toISOString().slice(0,10)}`,
      ];
      info.forEach((line, i) => doc.text(line, margin + 5, y + 13 + i * 5));
      y += 34;

      // ── System Configuration ─────────────────────────────────────────────
      sectionTitle('System Configuration');
      kpiRow([
        { label: 'PV Capacity',     value: `${system.pv_capacity_kw} kWp`                           },
        { label: 'Inverter',        value: `${system.inverter_capacity_kw} kVA`                     },
        { label: 'Battery',         value: `${system.battery_capacity_kwh} kWh (${system.battery_type === 'lithium' ? 'Li-ion' : 'Lead-Acid'})` },
        { label: 'Generator',       value: system.gen_enabled ? `${system.gen_capacity_kw} kW` : 'None' },
      ]);
      kpiRow([
        { label: 'Derating Factor', value: system.pv_derating                                       },
        { label: 'Battery DoD',     value: `${Math.round(system.battery_dod * 100)}%`               },
        { label: 'Usable Storage',  value: `${fmt(system.battery_capacity_kwh * system.battery_dod, 1)} kWh` },
        { label: 'Gen Min Load',    value: `${Math.round(system.gen_min_load_pct * 100)}%`          },
      ]);

      // ── Engineering Results ───────────────────────────────────────────────
      sectionTitle('Engineering Performance');
      kpiRow([
        { label: 'Annual PV Generation',  value: `${fmtN(sim.annual.pv_kwh)} kWh`,                    color: [0,112,204]  },
        { label: 'Annual Load Demand',    value: `${fmtN(sim.annual.load_kwh)} kWh`,                   color: [37,99,235]  },
        { label: 'Generator Output',      value: `${fmtN(sim.annual.gen_kwh)} kWh`,                    color: [217,119,6]  },
        { label: 'Unserved Load',         value: `${fmt(sim.annual.unmet_load_fraction, 2)}%`,          color: sim.annual.unmet_load_fraction > 2 ? [220,38,38] : [5,150,105] },
      ]);
      kpiRow([
        { label: 'Renewable Fraction',    value: `${fmt(sim.annual.renewable_fraction, 1)}%`,           color: [0,112,204]  },
        { label: 'PV Capacity Factor',    value: `${fmt(sim.annual.capacity_factor_pv, 1)}%`,           color: [37,99,235]  },
        { label: 'Battery Cycles/Year',   value: `${cycles}`,                                           color: cycles > 365 ? [217,119,6] : [5,150,105] },
        { label: 'Loss of Load Prob.',    value: `${fmt(lolp, 2)}%`,                                    color: lolp > 2 ? [220,38,38] : [5,150,105] },
      ]);
      kpiRow([
        { label: 'Fuel Consumed',         value: `${fmtN(sim.annual.fuel_litres)} L/yr`                },
        { label: 'Battery Throughput',    value: `${fmtN(sim.annual.batt_discharge_kwh)} kWh/yr`       },
        { label: 'Peak Load',             value: `${fmt(sim.annual.peak_load_kw, 2)} kW`               },
        { label: 'Avg Daily Load',        value: `${fmt(sim.annual.avg_load_kw * 24, 1)} kWh/day`      },
      ]);

      // ── Financial Results ─────────────────────────────────────────────────
      sectionTitle('Financial Analysis');
      kpiRow([
        { label: 'Total CapEx',       value: `${project.currency}${fmtN(fin.capex.total)}`,            color: [0,80,153]   },
        { label: 'LCOE',              value: `${project.currency}${fmt(fin.metrics.lcoe,2)}/kWh`,      color: fin.metrics.lcoe < finance.tariff_per_kwh ? [5,150,105] : [220,38,38] },
        { label: 'Project NPV',       value: `${project.currency}${fmtN(fin.metrics.npv)}`,            color: fin.metrics.npv > 0 ? [5,150,105] : [220,38,38] },
        { label: 'Simple Payback',    value: fin.metrics.simple_payback === Infinity ? 'N/A' : `${fmt(fin.metrics.simple_payback,1)} yr`, color: fin.metrics.simple_payback < 10 ? [5,150,105] : [217,119,6] },
      ]);
      kpiRow([
        { label: 'Annual Revenue',    value: `${project.currency}${fmtN(fin.annual.revenue)}/yr`       },
        { label: 'Annual O&M+Fuel',   value: `${project.currency}${fmtN(fin.annual.opex)}/yr`          },
        { label: 'CO₂ Avoided',       value: `${fmtN(fin.metrics.co2_avoided_kg)} kg/yr`              },
        { label: 'Beneficiaries',     value: `~${fmtN(fin.metrics.beneficiaries)} people`             },
      ]);

      // CapEx breakdown table
      checkPage(50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(74,101,128);
      doc.text('CapEx Breakdown', margin, y); y += 5;
      const capexItems = [
        ['Solar PV Array',    fin.capex.pv],
        ['Battery Storage',   fin.capex.battery],
        ['Generator',         fin.capex.generator],
        ['Inverter/Control',  fin.capex.inverter],
        ['Balance of System', fin.capex.bos],
        ['Installation',      fin.capex.install],
      ].filter(([,v]) => v > 0);
      capexItems.forEach(([label, value]) => {
        const pct = fin.capex.total > 0 ? (value / fin.capex.total) * 100 : 0;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(26,43,60);
        doc.text(label, margin, y + 3);
        doc.text(`${project.currency}${fmtN(value)}`, margin + 90, y + 3);
        doc.text(`${pct.toFixed(1)}%`, margin + 120, y + 3);
        // bar
        doc.setFillColor(226,234,242);
        doc.rect(margin + 135, y, 50, 5, 'F');
        doc.setFillColor(0,112,204);
        doc.rect(margin + 135, y, pct * 0.5, 5, 'F');
        y += 8;
      });
      // Total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0,80,153);
      doc.text(`TOTAL CapEx: ${project.currency}${fmtN(fin.capex.total)}`, margin, y + 4);
      y += 10;

      // ── PAGE 2 — Charts ───────────────────────────────────────────────────
      doc.addPage();
      y = margin;

      // Re-draw header strip
      doc.setFillColor(0,80,153);
      doc.rect(0, 0, W, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255,255,255);
      doc.text(`${project.name || 'Mini-Grid'} · Charts & Visualisations`, margin, 9);
      y = 22;
      doc.setTextColor(26,43,60);

      // Capture and embed the 4 SVG charts from the results page
      const chartIds = [
        { selector: '#chart-monthly',  label: 'Monthly Energy Balance',       height: 52 },
        { selector: '#chart-hourly',   label: 'Hourly Power Balance (Week 1)',  height: 52 },
        { selector: '#chart-soc',      label: 'Battery SOC — Annual Profile',   height: 40 },
      ];

      for (const { selector, label, height } of chartIds) {
        const el = document.querySelector(selector);
        if (!el) continue;
        checkPage(height + 12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(74,101,128);
        doc.text(label.toUpperCase(), margin, y);
        y += 4;
        try {
          const { dataUrl, w, h: svgH } = await svgToImage(el);
          const aspect = svgH / w;
          const imgW   = contentW;
          const imgH   = Math.min(imgW * aspect, height);
          doc.addImage(dataUrl, 'PNG', margin, y, imgW, imgH);
          y += imgH + 6;
        } catch (e) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(148,163,184);
          doc.text('[Chart capture unavailable]', margin, y + 4);
          y += 10;
        }
        drawHRule();
      }

      // ── Recommendation ────────────────────────────────────────────────────
      checkPage(30);
      const recColor = sim.annual.unmet_load_fraction > 5 ? [220,38,38] : sim.annual.renewable_fraction < 50 ? [217,119,6] : [5,150,105];
      const recText  = sim.annual.unmet_load_fraction > 5 ? 'System Undersized' : sim.annual.renewable_fraction < 50 ? 'Viable — Low Renewable Fraction' : 'System Design Viable';
      doc.setFillColor(...recColor.map(v => Math.min(255, v + 200)));
      doc.setDrawColor(...recColor);
      doc.roundedRect(margin, y, contentW, 20, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...recColor);
      doc.text(`Engineering Assessment: ${recText}`, margin + 5, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(26,43,60);
      doc.text(`RF: ${fmt(sim.annual.renewable_fraction,1)}%  |  Unmet: ${fmt(sim.annual.unmet_load_fraction,2)}%  |  LCOE: ${project.currency}${fmt(fin.metrics.lcoe,2)}/kWh  |  NPV: ${project.currency}${fmtN(fin.metrics.npv)}`, margin + 5, y + 15);
      y += 26;

      // ── Disclaimer ────────────────────────────────────────────────────────
      checkPage(16);
      doc.setFillColor(249,250,251);
      doc.setDrawColor(226,234,242);
      doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148,163,184);
      doc.text('Pre-feasibility disclaimer: Results are indicative only (±15–20% accuracy). Not suitable for procurement or investment decisions', margin + 3, y + 5);
      doc.text('without a detailed engineering study. Solar data based on typical meteorological year. Generated by MIRIDA.', margin + 3, y + 10);

      // ── Footer on all pages ───────────────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(248,250,252);
        doc.rect(0, H - 10, W, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(148,163,184);
        doc.text(`MIRIDA  ·  ${project.name || 'Report'}  ·  Page ${p} of ${totalPages}`, margin, H - 3);
        doc.text(new Date().toLocaleDateString('en-GB'), W - margin, H - 3, { align: 'right' });
      }

      doc.save(`${(project.name || 'minigrid').replace(/\s+/g,'-')}-prefeasibility-report.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed: ' + err.message);
    } finally {
      setPdfGenerating(false);
    }
  }, [sim, fin, project, system, solar, finance]);

  /* ─── RENDER ─────────────────────────────────────────────────────────── */

  return (
    <>
      <link href={FONT_URL} rel="stylesheet" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #F4F7FB; }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #F1F5F9; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: #CBD5E1; }
        select option { background: #fff; color: #1A2B3C; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .step-content { animation: fadeIn 0.3s cubic-bezier(0.22,1,0.36,1); }
        .sim-log-entry { animation: fadeIn 0.15s ease; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif", position: 'relative', zIndex: 1 }}>

        {/* ── Top Bar ── */}
        <div style={{
          padding: '0 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${C.border}`,
          height: 60,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {/* Left — wordmark + back link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button onClick={onBack} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: C.textMid, fontFamily: "'DM Sans', sans-serif",
            }}>
              <span style={{ opacity: 0.5 }}>←</span> Home
            </button>
            <div style={{ width: 1, height: 18, background: C.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{
                  fontSize: 16, fontWeight: 700, color: C.text,
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: -0.3, lineHeight: 1,
                }}>MIRIDA</div>
                <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginTop: 1 }}>
                  Mini-Grid Resource Integration & Design Analyzer
                </div>
              </div>
            </div>
          </div>

          {/* Center — step label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {project.name && (
              <span style={{
                fontSize: 11, color: C.textMid, fontFamily: "'DM Sans', sans-serif",
                padding: '4px 12px', borderRadius: 20,
                border: `1px solid ${C.border}`,
                background: C.surface,
              }}>
                {project.name}
              </span>
            )}
          </div>

          {/* Right — actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onOpenSizing && (
              <Btn variant="secondary" onClick={onOpenSizing} style={{ padding: '6px 14px', fontSize: 11, borderRadius: 20 }}>
                Quick Size
              </Btn>
            )}
            {sim && (
              <Btn variant="ghost" onClick={exportCSV} style={{ padding: '6px 14px', fontSize: 11, borderRadius: 20 }}>
                CSV
              </Btn>
            )}
            {sim && (
              <Btn variant="primary" onClick={exportPDF} disabled={pdfGenerating} style={{ padding: '6px 14px', fontSize: 11, borderRadius: 20 }}>
                {pdfGenerating ? 'Generating...' : 'Export PDF'}
              </Btn>
            )}
            <div style={{
              fontSize: 10, color: C.textDim, fontFamily: "'DM Sans', sans-serif",
              padding: '4px 12px', borderRadius: 20, border: `1px solid ${C.border}`,
            }}>
              v1.0
            </div>
          </div>
        </div>

        {/* ── Step Indicator ── */}
        <div style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: '0 28px',
          display: 'flex', gap: 0, overflowX: 'auto',
        }}>
          {STEPS.map((s, i) => {
            const active   = i === step;
            const done     = i < step;
            const canClick = i <= step || (i === step + 1 && canProceed());
            return (
              <button key={s.id} onClick={() => canClick && setStep(i)} style={{
                padding: '13px 22px',
                background: 'none', border: 'none',
                cursor: canClick ? 'pointer' : 'default',
                borderBottom: `2px solid ${active ? C.cyan : 'transparent'}`,
                color: active ? C.cyan : done ? C.textMid : C.textDim,
                fontSize: 11, fontWeight: active ? 600 : 400,
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap', transition: 'all 0.2s',
                letterSpacing: 0.3,
              }}>
                <span style={{ fontSize: 11 }}>{done ? '✓' : i + 1}</span>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* ── Main Content ── */}
        <div style={{ flex: 1, padding: '28px', maxWidth: 900, margin: '0 auto', width: '100%' }}>

          {/* ════════════════════════════════ STEP 0: PROJECT ══════════════════════════════ */}
          {step === 0 && (
            <div className="step-content">
              <SectionHead title="Project Setup" sub="Define the project site and basic information." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <Label>Project Name *</Label>
                      <Input type="text" value={project.name} onChange={v => proj('name', v)} placeholder="e.g. Rimi Village Mini-Grid" />
                    </div>
                    <div>
                      <Label>Location / Community</Label>
                      <Input type="text" value={project.location} onChange={v => proj('location', v)} placeholder="e.g. Rimi LGA, Katsina State" />
                    </div>
                    <div>
                      <Label hint="decimal degrees">Latitude</Label>
                      <Input value={project.lat} onChange={v => proj('lat', v)} placeholder="e.g. 12.18" step="0.0001" />
                    </div>
                    <div>
                      <Label hint="decimal degrees">Longitude</Label>
                      <Input value={project.lng} onChange={v => proj('lng', v)} placeholder="e.g. 7.49" step="0.0001" />
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <Label>Description</Label>
                    <textarea value={project.description} onChange={e => proj('description', e.target.value)}
                      placeholder="Community description, project objectives..." rows={3}
                      style={{ width: '100%', padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "'DM Sans', sans-serif", resize: 'vertical', outline: 'none' }}
                    />
                  </div>
                </Card>

                {/* Quick-select Nigerian city */}
                <Card style={{ gridColumn: '1 / -1' }}>
                  <Label>Quick-select a Nigerian Location</Label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {NIGERIA_CITIES_SOLAR.map((city, i) => (
                      <button key={i} onClick={() => {
                        proj('lat', city.lat.toString());
                        proj('lng', city.lng.toString());
                        proj('location', city.name);
                      }} style={{
                        padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`,
                        background: project.location === city.name ? C.cyanDim : 'transparent',
                        color: project.location === city.name ? C.cyan : C.textMid,
                        fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                        transition: 'all 0.15s',
                      }}>
                        {city.name}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Site Map */}
                <Card style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <Label>Site Location Map</Label>
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: "'DM Sans', sans-serif" }}>
                      Satellite imagery · OpenStreetMap
                    </span>
                  </div>
                  <SiteMap
                    lat={project.lat}
                    lng={project.lng}
                    projectName={project.name}
                    location={project.location}
                  />
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════ STEP 1: LOAD ═════════════════════════════════ */}
          {step === 1 && (
            <LoadProfileStep
              load={load}
              ld={ld}
              fileInputRef={fileInputRef}
              handleCSV={handleCSV}
              errors={errors}
            />
          )}

          {/* ════════════════════════════════ STEP 2: SOLAR ════════════════════════════════ */}
          {step === 2 && (
            <div className="step-content">
              <SectionHead title="Solar Resource" sub="Retrieve or define the hourly solar irradiance for the project site." />

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { id: 'pvgis', label: 'Fetch Online' },
                  { id: 'city',  label: 'Nigerian City Preset' },
                  { id: 'manual',label: 'Enter GHI Manually'   },
                ].map(m => (
                  <button key={m.id} onClick={() => sol('method', m.id)} style={{
                    padding: '9px 18px', borderRadius: 8, cursor: 'pointer',
                    background: solar.method === m.id ? C.cyanDim : 'transparent',
                    border: `1px solid ${solar.method === m.id ? C.cyan : C.border}`,
                    color: solar.method === m.id ? C.cyan : C.textMid,
                    fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                  }}>{m.label}</button>
                ))}
              </div>

              {solar.method === 'pvgis' && (
                <Card>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 12, lineHeight: 1.7 }}>
                    Automatically tries <strong style={{ color: C.text }}>PVGIS (EU JRC)</strong> first, then falls back to <strong style={{ color: C.text }}>NASA POWER</strong>, then local synthetic data. Coordinates from Step 1: <strong style={{ color: C.cyan }}>{project.lat || '—'}, {project.lng || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    {['PVGIS (EU JRC)', 'NASA POWER', 'Synthetic fallback'].map((src, i) => (
                      <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textDim }}>
                        {i > 0 && <span style={{ color: C.textDim }}>→</span>}
                        <span style={{
                          padding: '2px 8px', borderRadius: 4,
                          border: `1px solid ${solar.dataSource === src.split(' ')[0] ? C.cyan : C.border}`,
                          color: solar.dataSource === src.split(' ')[0] ? C.cyan : C.textDim,
                          background: solar.dataSource === src.split(' ')[0] ? `${C.cyan}15` : 'transparent',
                        }}>{src}</span>
                      </div>
                    ))}
                  </div>
                  <Btn onClick={fetchSolar} disabled={solar.fetching || !project.lat || !project.lng}>
                    {solar.fetching ? 'Fetching solar data...' : 'Fetch Solar Resource Data'}
                  </Btn>
                  {solar.fetchError && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 8, fontSize: 11, color: C.gold }}>⚠️ {solar.fetchError}</div>
                  )}
                  {solar.fetched && (
                    <div style={{ marginTop: 16, padding: '14px', background: `${C.cyan}08`, border: `1px solid ${C.cyan}30`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: C.cyan, fontWeight: 700, marginBottom: 4 }}>
                        Solar data ready · Source: <span style={{ fontFamily: "'DM Sans', sans-serif" }}>{solar.dataSource || 'PVGIS'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.textMid }}>8,760 hourly values · Avg GHI: <strong style={{ color: C.text }}>{solar.avg_ghi} kWh/m²/day</strong></div>
                    </div>
                  )}
                </Card>
              )}

              {solar.method === 'city' && (
                <Card>
                  <Label>Select Nearest Nigerian City</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                    {NIGERIA_CITIES_SOLAR.map((city, i) => (
                      <button key={i} onClick={() => selectCity(i)} style={{
                        padding: '12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        background: solar.cityIndex === i ? C.cyanDim : C.surface,
                        border: `1px solid ${solar.cityIndex === i ? C.cyan : C.border}`,
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: solar.cityIndex === i ? C.cyan : C.text, fontFamily: "'DM Sans', sans-serif" }}>{city.name}</div>
                        <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'DM Sans', sans-serif", marginTop: 3 }}>
                          GHI {city.avg_ghi} · {city.avg_temp}°C
                        </div>
                      </button>
                    ))}
                  </div>
                  {solar.fetched && (
                    <div style={{ marginTop: 16, padding: '10px 14px', background: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 8, fontSize: 11, color: C.cyan }}>
                      Synthetic TMY generated for {NIGERIA_CITIES_SOLAR[solar.cityIndex].name}
                    </div>
                  )}
                </Card>
              )}

              {solar.method === 'manual' && (
                <Card>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <Label hint="annual average">Global Horizontal Irradiance</Label>
                      <Input value={solar.avg_ghi} onChange={v => sol('avg_ghi', v)} min={1} max={9} step={0.01} unit="kWh/m²/d" />
                      <div style={{ marginTop: 6, fontSize: 10, color: C.textDim }}>Nigeria range: 4.2 (South) — 6.4 (North)</div>
                    </div>
                    <div>
                      <Label hint="annual average ambient">Temperature</Label>
                      <Input value={solar.avg_temp} onChange={v => sol('avg_temp', v)} min={15} max={45} step={0.5} unit="°C" />
                    </div>
                  </div>
                  <Btn onClick={() => {
                    const data = generateSyntheticSolar(parseFloat(solar.avg_ghi), parseFloat(solar.avg_temp));
                    sol('solarData', data); sol('fetched', true);
                  }} style={{ marginTop: 16 }}>Generate Synthetic TMY</Btn>
                  {solar.fetched && <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.cyan}10`, border: `1px solid ${C.cyan}30`, borderRadius: 8, fontSize: 11, color: C.cyan }}>✅ Synthetic hourly TMY generated from GHI = {solar.avg_ghi} kWh/m²/day</div>}
                </Card>
              )}
            </div>
          )}

          {/* ════════════════════════════════ STEP 3: SYSTEM ═══════════════════════════════ */}
          {step === 3 && (
            <div className="step-content">
              <SectionHead title="System Configuration" sub="Define the size and parameters of each system component." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* PV Array */}
                <Card glow={C.gold}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>☀️ PV Array</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <Label>Installed Capacity</Label>
                      <Input value={system.pv_capacity_kw} onChange={v => sys('pv_capacity_kw', v)} min={1} step={1} unit="kWp" />
                    </div>
                    <div>
                      <Label hint="from horizontal">Panel Tilt Angle</Label>
                      <Input value={system.pv_tilt} onChange={v => sys('pv_tilt', v)} min={0} max={90} step={1} unit="°" />
                    </div>
                    <div>
                      <Label hint="soiling, wiring, mismatch losses">System Derating Factor</Label>
                      <Input value={system.pv_derating} onChange={v => sys('pv_derating', v)} min={0.5} max={1} step={0.01} unit="—" />
                      <div style={{ marginTop: 4, fontSize: 10, color: C.textDim }}>Effective output: {fmt(system.pv_capacity_kw * system.pv_derating, 1)} kWp. Typical range: 0.75–0.90</div>
                    </div>
                    <div>
                      <Label hint="typical: −0.004 for c-Si">Temp Coefficient (α)</Label>
                      <Input value={system.pv_alpha} onChange={v => sys('pv_alpha', v)} step={0.001} unit="/°C" />
                    </div>
                  </div>
                </Card>

                {/* Battery */}
                <Card glow={C.blue}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>🔋 Battery Storage</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <Label>Battery Technology</Label>
                      <Select value={system.battery_type} onChange={v => sys('battery_type', v)} options={[
                        { value: 'lithium',   label: 'Li-ion / LFP (Lithium)' },
                        { value: 'lead_acid', label: 'Lead-Acid (VRLA/AGM)' },
                      ]} />
                    </div>
                    <div>
                      <Label>Total Capacity</Label>
                      <Input value={system.battery_capacity_kwh} onChange={v => sys('battery_capacity_kwh', v)} min={1} step={5} unit="kWh" />
                    </div>
                    <div>
                      <Label hint="max usable fraction">Depth of Discharge</Label>
                      <Input value={system.battery_dod} onChange={v => sys('battery_dod', v)} min={0.1} max={1} step={0.05} unit="—" />
                      <div style={{ marginTop: 4, fontSize: 10, color: C.textDim }}>Usable: {fmt(system.battery_capacity_kwh * system.battery_dod, 1)} kWh</div>
                    </div>
                  </div>
                </Card>

                {/* Generator */}
                <Card style={{ gridColumn: '1 / -1' }} glow={system.gen_enabled ? C.gold : undefined}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: system.gen_enabled ? C.gold : C.textDim, display: 'flex', alignItems: 'center', gap: 8 }}>
                      Diesel Generator (Backup)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: C.textMid }}>Enable</span>
                      <Toggle checked={system.gen_enabled} onChange={v => sys('gen_enabled', v)} color={C.gold} />
                    </div>
                  </div>
                  {system.gen_enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div>
                        <Label>Rated Power</Label>
                        <Input value={system.gen_capacity_kw} onChange={v => sys('gen_capacity_kw', v)} min={1} step={5} unit="kW" />
                      </div>
                      <div>
                        <Label hint="prevents wet-stacking below this threshold">Min Operating Load</Label>
                        <Input value={system.gen_min_load_pct} onChange={v => sys('gen_min_load_pct', v)} min={0.1} max={0.5} step={0.05} unit="—" />
                        <div style={{ marginTop: 4, fontSize: 10, color: C.textDim }}>Min = {fmt(system.gen_capacity_kw * system.gen_min_load_pct, 1)} kW. Typical: 25–30%</div>
                      </div>
                      <div>
                        <Label hint="run generator at full capacity to charge battery">Cycle Charging</Label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                          <Toggle checked={system.gen_cycle_charging} onChange={v => sys('gen_cycle_charging', v)} color={C.gold} />
                          <span style={{ fontSize: 11, color: C.textMid }}>{system.gen_cycle_charging ? 'Enabled' : 'Load Following'}</span>
                        </div>
                      </div>
                      <div>
                        <Label hint="L/hr per kW at full load">Fuel Consumption</Label>
                        <div style={{ padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 12, color: C.textMid, fontFamily: "'DM Sans', sans-serif" }}>
                          ~{fmt(0.246 * system.gen_capacity_kw, 1)} L/hr @ full
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                {/* Inverter / Charge Controller */}
                <Card style={{ gridColumn: '1 / -1' }} glow={C.cyan}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.cyan, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                     Inverter
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <Label hint="AC output rating">Inverter Capacity</Label>
                      <Input value={system.inverter_capacity_kw} onChange={v => sys('inverter_capacity_kw', v)} min={1} step={1} unit="kVA" />
                      <div style={{ marginTop: 4, fontSize: 10, color: C.textDim }}>
                        Sizing rule: ≥ peak load ({fmt(load.daily_kwh / 18, 1)} kW est.)
                        {parseFloat(system.inverter_capacity_kw) < parseFloat(load.daily_kwh) / 18
                          ? <span style={{ color: C.red }}> ⚠️ Undersized</span>
                          : <span style={{ color: C.cyan }}> ✓ OK</span>
                        }
                      </div>
                    </div>
                    <div>
                      <Label hint="DC→AC conversion">Inverter Efficiency</Label>
                      <Input value={system.inverter_efficiency} onChange={v => sys('inverter_efficiency', v)} min={0.8} max={1} step={0.01} unit="—" />
                      <div style={{ marginTop: 4, fontSize: 10, color: C.textDim }}>Typical: 0.93–0.98 for modern inverters</div>
                    </div>
                    <div style={{ padding: '10px 14px', background: C.surface, borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>Inverter Loading Ratio</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.cyan, fontFamily: "'JetBrains Mono',monospace" }}>
                        {fmt((system.pv_capacity_kw / system.inverter_capacity_kw), 2)}
                      </div>
                      <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>PV:Inverter ratio (0.9–1.2 ideal)</div>
                    </div>
                  </div>
                </Card>

                <Card style={{ gridColumn: '1 / -1', background: C.cyanDim, border: `1px solid ${C.cyan}30` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>System Summary</div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {[
                      { label: 'PV Capacity',        value: `${system.pv_capacity_kw} kWp`,                                                      color: C.gold   },
                      { label: 'Effective PV Output', value: `${fmt(system.pv_capacity_kw * system.pv_derating, 1)} kWp (derating ${system.pv_derating})`, color: C.gold },
                      { label: 'Inverter',            value: `${system.inverter_capacity_kw} kVA @ ${(system.inverter_efficiency*100).toFixed(0)}% η`, color: C.cyan },
                      { label: 'Battery',             value: `${system.battery_capacity_kwh} kWh (${system.battery_type === 'lithium' ? 'Li-ion' : 'Lead-Acid'})`, color: C.blue },
                      { label: 'Usable Storage',      value: `${fmt(system.battery_capacity_kwh * system.battery_dod, 1)} kWh`,                   color: C.blue   },
                      { label: 'Generator',           value: system.gen_enabled ? `${system.gen_capacity_kw} kW (min ${Math.round(system.gen_min_load_pct*100)}%)` : 'PV+Battery only', color: C.gold },
                      { label: 'PV:Inverter ratio',   value: `${fmt(system.pv_capacity_kw / system.inverter_capacity_kw, 2)}`,                    color: C.cyan  },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════ STEP 4: FINANCE ══════════════════════════════ */}
          {step === 4 && (
            <div className="step-content">
              <SectionHead title="Financial Parameters" sub="Set equipment costs and economic assumptions. Nigerian market defaults are pre-loaded." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 14 }}> Equipment Costs ({project.currency})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><Label hint="per kWp installed">Solar PV</Label><Input value={finance.pv_cost_per_kw} onChange={v => fin_('pv_cost_per_kw', v)} unit={`${project.currency}/kWp`} /></div>
                    <div><Label hint="per kWh capacity">Battery ({system.battery_type === 'lithium' ? 'Li-ion' : 'Lead-Acid'})</Label><Input value={finance.battery_cost_per_kwh} onChange={v => fin_('battery_cost_per_kwh', v)} unit={`${project.currency}/kWh`} /></div>
                    {system.gen_enabled && <div><Label hint="per kW rated">Diesel Generator</Label><Input value={finance.gen_cost_per_kw} onChange={v => fin_('gen_cost_per_kw', v)} unit={`${project.currency}/kW`} /></div>}
                    <div><Label hint="per kW PV capacity">Inverter / Charge Ctrl</Label><Input value={finance.inverter_cost_per_kw} onChange={v => fin_('inverter_cost_per_kw', v)} unit={`${project.currency}/kW`} /></div>
                    <div><Label hint="wiring, mounting, civil works">BOS (% of PV cost)</Label><Input value={finance.bos_pct} onChange={v => fin_('bos_pct', v)} min={0} max={0.5} step={0.01} unit="%" /></div>
                    <div><Label hint="labour, commissioning">Installation (% of hardware)</Label><Input value={finance.installation_pct} onChange={v => fin_('installation_pct', v)} min={0} max={0.3} step={0.01} unit="%" /></div>
                  </div>
                </Card>

                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 14 }}> Economic Assumptions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div><Label hint="% of CapEx per year">Annual O&M</Label><Input value={finance.om_pct_annual} onChange={v => fin_('om_pct_annual', v)} min={0} max={0.1} step={0.001} unit="%" /></div>
                    <div><Label>Diesel Fuel Price</Label><Input value={finance.fuel_price_per_litre} onChange={v => fin_('fuel_price_per_litre', v)} unit={`${project.currency}/L`} /></div>
                    <div><Label hint="WACC or opportunity cost">Discount Rate</Label><Input value={finance.discount_rate} onChange={v => fin_('discount_rate', v)} min={0} max={0.5} step={0.01} unit="%" /></div>
                    <div><Label>Project Lifetime</Label><Input value={finance.project_lifetime} onChange={v => fin_('project_lifetime', v)} min={5} max={40} step={1} unit="years" /></div>
                    <div><Label hint="energy tariff charged to users">Electricity Tariff</Label><Input value={finance.tariff_per_kwh} onChange={v => fin_('tariff_per_kwh', v)} unit={`${project.currency}/kWh`} /></div>
                    <div>
                      <Label>Currency Display</Label>
                      <Select value={project.currency} onChange={v => proj('currency', v)} options={[{ value:'₦', label:'₦ Nigerian Naira' }, { value:'$', label:'$ US Dollar' }, { value:'€', label:'€ Euro' }]} />
                    </div>
                  </div>
                </Card>

                {/* Quick CapEx estimate */}
                <Card style={{ gridColumn: '1 / -1', background: C.cyanDim, border: `1px solid ${C.cyan}30` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.cyan, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Estimated CapEx Preview</div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {(() => {
                      const pv   = system.pv_capacity_kw * finance.pv_cost_per_kw;
                      const bat  = system.battery_capacity_kwh * finance.battery_cost_per_kwh;
                      const gen  = system.gen_enabled ? system.gen_capacity_kw * finance.gen_cost_per_kw : 0;
                      const inv  = system.pv_capacity_kw * finance.inverter_cost_per_kw;
                      const bos  = pv * finance.bos_pct;
                      const inst = (pv + bat + gen + inv) * finance.installation_pct;
                      const tot  = pv + bat + gen + inv + bos + inst;
                      return [
                        { label: 'PV Array',    value: pv,  color: C.gold },
                        { label: 'Battery',     value: bat, color: C.blue },
                        { label: 'Generator',   value: gen, color: C.gold },
                        { label: 'Inverter',    value: inv, color: C.cyan },
                        { label: 'BOS+Install', value: bos+inst, color: C.textMid },
                        { label: 'TOTAL',       value: tot, color: C.cyan, big: true },
                      ].map(({ label, value, color, big }) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: C.textDim }}>{label}</div>
                          <div style={{ fontSize: big ? 20 : 14, fontWeight: 800, color, fontFamily: "'DM Sans', sans-serif" }}>{project.currency}{fmtN(value)}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════ STEP 5: SIMULATE ═════════════════════════════ */}
          {step === 5 && (
            <div className="step-content">
              <SectionHead title="Run Simulation" sub="Execute the 8760-hour hourly dispatch model." />

              {/* Pre-sim checklist */}
              <Card style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMid, marginBottom: 14 }}>Pre-Simulation Checklist</div>
                {[
                  { ok: project.name.trim().length > 0,               label: `Project: ${project.name || 'Not set'}` },
                  { ok: load.method !== 'csv' ? load.daily_kwh > 0 : !!load.csvData,
                    label: `Load: ${load.method === 'csv' ? (load.csvData ? load.csvName : 'CSV not uploaded') : `${fmt(load.daily_kwh, 1)} kWh/day (${load.method})`}` },
                  { ok: solar.fetched || solar.method === 'manual',    label: `Solar: ${solar.fetched ? `${solar.avg_ghi} kWh/m²/day` : 'Not fetched'}` },
                  { ok: system.pv_capacity_kw > 0,                     label: `PV: ${system.pv_capacity_kw} kWp` },
                  { ok: system.battery_capacity_kwh > 0,               label: `Battery: ${system.battery_capacity_kwh} kWh` },
                  { ok: true,                                           label: `Generator: ${system.gen_enabled ? system.gen_capacity_kw + ' kW' : 'Disabled'}` },
                ].map(({ ok, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: ok ? C.cyan : C.red, fontSize: 16 }}>{ok ? '✓' : '✗'}</span>
                    <span style={{ color: ok ? C.text : C.red }}>{label}</span>
                  </div>
                ))}
              </Card>

              {/* Simulation progress */}
              {simRunning && (
                <Card style={{ marginBottom: 20 }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: C.textMid }}>Simulation Progress</span>
                      <span style={{ fontSize: 12, color: C.cyan, fontFamily: "'DM Sans', sans-serif" }}>{simProgress}%</span>
                    </div>
                    <div style={{ height: 6, background: C.surface, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${simProgress}%`, background: `linear-gradient(90deg, ${C.cyanDark}, ${C.cyan})`, transition: 'width 0.3s', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, padding: '12px', maxHeight: 160, overflowY: 'auto', fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
                    {simLog.map((line, i) => (
                      <div key={i} className="sim-log-entry" style={{ color: line.includes('✅') ? C.cyan : line.includes('❌') ? C.red : C.textMid, lineHeight: 1.8 }}>{line}</div>
                    ))}
                  </div>
                </Card>
              )}

              {!simRunning && simLog.length > 0 && (
                <Card style={{ marginBottom: 20, background: C.cyanDim, border: `1px solid ${C.cyan}30` }}>
                  <div style={{ background: C.bg, borderRadius: 8, padding: '12px', maxHeight: 120, overflowY: 'auto', fontFamily: "'DM Sans', sans-serif", fontSize: 11 }}>
                    {simLog.map((line, i) => (
                      <div key={i} style={{ color: line.includes('✅') ? C.cyan : line.includes('❌') ? C.red : C.textMid, lineHeight: 1.8 }}>{line}</div>
                    ))}
                  </div>
                </Card>
              )}

              {errors.sim && (
                <div style={{ marginBottom: 20, padding: '14px', background: `${C.red}10`, border: `1px solid ${C.red}40`, borderRadius: 8, fontSize: 12, color: C.red }}>❌ {errors.sim}</div>
              )}

              <div style={{ display: 'flex', gap: 12 }}>
                <Btn onClick={runSimulation} disabled={simRunning} icon={simRunning ? '⏳' : '▶'} style={{ padding: '14px 28px', fontSize: 14 }}>
                  {simRunning ? 'Simulating...' : 'Run 8760-Hour Simulation'}
                </Btn>
                {sim && <Btn variant="secondary" onClick={() => setStep(6)}>View Results</Btn>}
              </div>

              <div style={{ marginTop: 20, padding: '12px 16px', background: C.surface, borderRadius: 8, fontSize: 11, color: C.textDim, lineHeight: 1.8 }}>
                <strong style={{ color: C.textMid }}>ℹ️ Pre-feasibility accuracy:</strong> ±15–20% vs detailed design. Results are suitable for project screening and preliminary sizing, not for procurement or bankable feasibility studies.
              </div>
            </div>
          )}

          {/* ════════════════════════════════ STEP 6: RESULTS ══════════════════════════════ */}
          {step === 6 && sim && fin && (
            <div className="step-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <SectionHead title="Simulation Results" sub={`${project.name || 'Mini-Grid'} · ${project.location || ''}`} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="secondary" onClick={exportCSV} icon="↓" style={{ fontSize: 11 }}>Hourly CSV</Btn>
                  <Btn variant="primary" onClick={exportPDF} disabled={pdfGenerating} icon={pdfGenerating ? '⏳' : '📄'} style={{ fontSize: 11 }}>
                    {pdfGenerating ? 'Generating PDF...' : 'Export Report PDF'}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setStep(5)} icon="↺" style={{ fontSize: 11 }}>Re-run</Btn>
                </div>
              </div>

              {/* ── Key Performance Indicators ── */}
              {(() => {
                const cycles = countBatteryCycles(sim.hourly.battery_soc, system.battery_capacity_kwh);
                const lolp   = calcLOLP(sim.hourly.unserved_load);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                    {[
                      { label: 'Annual PV Generation',   value: `${fmtN(sim.annual.pv_kwh)} kWh`,    color: C.gold,    icon: '☀️' },
                      { label: 'Load Demand',            value: `${fmtN(sim.annual.load_kwh)} kWh`,   color: C.blue,    icon: '⚡' },
                      { label: 'Generator Output',       value: `${fmtN(sim.annual.gen_kwh)} kWh`,    color: sim.annual.gen_kwh > 0 ? C.gold : C.textDim, icon: '🔌' },
                      { label: 'Excess / Curtailed',     value: `${fmtN(sim.annual.excess_kwh)} kWh`, color: C.blue,    icon: '↑'  },
                      { label: 'Unserved Load',          value: `${fmtN(sim.annual.unserved_kwh)} kWh (${fmt(sim.annual.unmet_load_fraction, 2)}%)`, color: sim.annual.unmet_load_fraction > 2 ? C.red : C.cyan, icon: '⚠️' },
                      { label: 'PV Capacity Factor',     value: `${fmt(sim.annual.capacity_factor_pv, 1)}%`, color: C.gold, icon: '📈' },
                      { label: 'Battery Cycles / Year',  value: `${cycles}`,                          color: cycles > 365 ? C.gold : C.cyan, icon: '🔋' },
                      { label: 'Loss of Load Prob.',     value: `${fmt(lolp, 2)}%`,                   color: lolp > 2 ? C.red : lolp > 0.5 ? C.gold : C.cyan, icon: '📉' },
                      { label: 'Fuel Consumed',          value: `${fmtN(sim.annual.fuel_litres)} L`,  color: C.textMid, icon: '⛽' },
                      { label: 'Avg Daily Load',         value: `${fmt(sim.annual.avg_load_kw, 2)} kW`, color: C.blue,  icon: '〰' },
                      { label: 'Peak Load',              value: `${fmt(sim.annual.peak_load_kw, 2)} kW`, color: C.blue, icon: '📊' },
                      { label: 'Batt Throughput',        value: `${fmtN(sim.annual.batt_discharge_kwh)} kWh`, color: C.blue, icon: '↔' },
                    ].map(({ label, value, color, icon }) => (
                      <Card key={label} style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.2 }}>{value}</div>
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{label}</div>
                      </Card>
                    ))}
                  </div>
                );
              })()}

              {/* ── Gauge + Energy Mix Donut ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, marginBottom: 16 }}>
                <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                  <Gauge value={sim.annual.renewable_fraction} color={sim.annual.renewable_fraction > 70 ? C.cyan : sim.annual.renewable_fraction > 40 ? C.gold : C.red} label="Renewable Fraction" size={150} />
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 8, textAlign: 'center' }}>
                    {sim.annual.renewable_fraction > 80 ? '🟢 Excellent' : sim.annual.renewable_fraction > 60 ? '🟡 Good' : '🔴 Low — consider more PV/battery'}
                  </div>
                </Card>
                <Card>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Annual Energy Mix</div>
                  <DonutChart slices={[
                    { label: 'Solar PV (direct)',    value: Math.max(0, sim.annual.pv_kwh - sim.annual.batt_charge_kwh - sim.annual.excess_kwh), color: C.cyan   },
                    { label: 'Battery discharge',    value: sim.annual.batt_discharge_kwh,  color: C.blueBright },
                    { label: 'Generator',            value: sim.annual.gen_kwh,             color: C.red    },
                    { label: 'Excess PV (curtailed)',value: sim.annual.excess_kwh,           color: C.textDim},
                  ]} size={130} />
                </Card>
              </div>

              {/* ── Monthly Energy Balance ── */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Monthly Energy Balance</div>
                <MonthlyBarChart monthly={sim.monthly} />
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  {[{c:C.cyan,l:'PV Generation'},{c:C.gold,l:'Generator'},{c:C.blueBright,l:'Excess PV'}].map(({c,l}) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:c, display:'inline-block' }} />
                      <span style={{ fontSize:10, color:C.textDim }}>{l}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:10, height:10, borderRadius:2, border:`1px solid ${C.borderHi}`, display:'inline-block' }} />
                    <span style={{ fontSize:10, color:C.textDim }}>Load Demand</span>
                  </div>
                </div>
              </Card>

              {/* ── Hourly Power Balance (sample week) ── */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase' }}>Hourly Power Balance — Sample Week</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Hours 1–168 (Week 1, January)</div>
                </div>
                <HourlyChart hourly={sim.hourly} weekStart={0} />
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  {[{c:C.gold,l:'Load (kW)'},{c:C.cyan,l:'PV output'},{c:C.red,l:'Generator'},{c:C.blueBright,l:'Battery discharge'}].map(({c,l}) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:10, height:3, borderRadius:1, background:c, display:'inline-block' }} />
                      <span style={{ fontSize:10, color:C.textDim }}>{l}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* ── Battery SOC Profile ── */}
              <Card style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Battery State of Charge — Annual Profile</div>
                <SOCChart
                  soc_array={sim.hourly.battery_soc}
                  capacity_kwh={system.battery_capacity_kwh}
                  dod={system.battery_dod}
                />
                <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:14, height:2, background:C.blue, display:'inline-block' }} />
                    <span style={{ fontSize:10, color:C.textDim }}>SOC (%)</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:14, height:2, background:`${C.red}60`, display:'inline-block', borderTop:`1px dashed ${C.red}` }} />
                    <span style={{ fontSize:10, color:C.textDim }}>DoD minimum</span>
                  </div>
                </div>
              </Card>

              {/* ── Financial Results ── */}
              <Card style={{ marginBottom: 16 }} glow={C.gold}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Financial Analysis</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>

                  {/* CapEx Breakdown */}
                  <div>
                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 10 }}>Capital Expenditure Breakdown</div>
                    {[
                      { label: 'Solar PV Array',   value: fin.capex.pv,        color: C.gold  },
                      { label: 'Battery Storage',  value: fin.capex.battery,   color: C.blue  },
                      { label: 'Generator',        value: fin.capex.generator, color: C.gold  },
                      { label: 'Inverter/Ctrl',    value: fin.capex.inverter,  color: C.cyan },
                      { label: 'BOS',              value: fin.capex.bos,       color: C.textMid },
                      { label: 'Installation',     value: fin.capex.install,   color: C.textMid },
                    ].map(({ label, value, color }) => {
                      const pct_ = fin.capex.total > 0 ? (value / fin.capex.total) * 100 : 0;
                      return value > 0 ? (
                        <div key={label} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: C.textMid }}>{label}</span>
                            <span style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color }}>{project.currency}{fmtN(value)}</span>
                          </div>
                          <div style={{ height: 4, background: C.surface, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct_}%`, background: color, borderRadius: 2, opacity: 0.7 }} />
                          </div>
                        </div>
                      ) : null;
                    })}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>TOTAL CapEx</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, fontFamily: "'DM Sans', sans-serif" }}>{project.currency}{fmtN(fin.capex.total)}</span>
                    </div>
                  </div>

                  {/* Key Financial Metrics */}
                  <div>
                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 10 }}>Key Economic Metrics</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'LCOE', value: `${project.currency}${fmt(fin.metrics.lcoe, 2)}/kWh`, color: fin.metrics.lcoe < finance.tariff_per_kwh ? C.cyan : C.red, hint: `Tariff: ${project.currency}${finance.tariff_per_kwh}/kWh` },
                        { label: 'Project NPV', value: `${project.currency}${fmtN(fin.metrics.npv)}`, color: fin.metrics.npv > 0 ? C.cyan : C.red, hint: `${finance.discount_rate*100}% discount, ${finance.project_lifetime}yr` },
                        { label: 'Simple Payback', value: fin.metrics.simple_payback === Infinity ? 'Not viable' : `${fmt(fin.metrics.simple_payback, 1)} years`, color: fin.metrics.simple_payback < 10 ? C.cyan : fin.metrics.simple_payback < 20 ? C.gold : C.red, hint: '' },
                        { label: 'Annual O&M + Fuel', value: `${project.currency}${fmtN(fin.annual.opex)}/yr`, color: C.textMid, hint: '' },
                        { label: 'Annual Revenue', value: `${project.currency}${fmtN(fin.annual.revenue)}/yr`, color: C.cyan, hint: '' },
                        { label: 'Beneficiaries Est.', value: `~${fmtN(fin.metrics.beneficiaries)} people`, color: C.blue, hint: '' },
                        { label: 'CO₂ Avoided', value: `${fmtN(fin.metrics.co2_avoided_kg)} kg/yr`, color: C.cyan, hint: 'vs diesel baseline' },
                      ].map(({ label, value, color, hint }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.surface, borderRadius: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, color: C.textMid }}>{label}</div>
                            {hint && <div style={{ fontSize: 9, color: C.textDim }}>{hint}</div>}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* ── System Recommendation ── */}
              <Card style={{ marginBottom: 16, background: sim.annual.unmet_load_fraction > 5 ? `${C.red}08` : sim.annual.renewable_fraction < 50 ? `${C.gold}08` : `${C.cyan}08`, border: `1px solid ${sim.annual.unmet_load_fraction > 5 ? C.red : sim.annual.renewable_fraction < 50 ? C.gold : C.cyan}30` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sim.annual.unmet_load_fraction > 5 ? C.red : sim.annual.renewable_fraction < 50 ? C.gold : C.cyan, marginBottom: 10 }}>
                  {sim.annual.unmet_load_fraction > 5 ? '⚠️ System Undersized' : sim.annual.renewable_fraction < 50 ? '🟡 System Viable — Low Renewable Fraction' : '✅ System Design Viable'}
                </div>
                <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.8 }}>
                  {sim.annual.unmet_load_fraction > 5 && `Unmet load of ${fmt(sim.annual.unmet_load_fraction, 1)}% is above the 5% threshold. Consider increasing PV capacity to ${Math.round(system.pv_capacity_kw * 1.3)} kWp or battery to ${Math.round(system.battery_capacity_kwh * 1.25)} kWh. `}
                  {sim.annual.renewable_fraction < 50 && `Renewable fraction of ${fmt(sim.annual.renewable_fraction, 1)}% is low. Increasing PV to ${Math.round(system.pv_capacity_kw * 1.4)} kWp and battery to ${Math.round(system.battery_capacity_kwh * 1.3)} kWh may significantly improve RE fraction. `}
                  {sim.annual.excess_kwh > sim.annual.pv_kwh * 0.3 && `Excess energy (${fmtN(sim.annual.excess_kwh)} kWh = ${fmt(sim.annual.excess_kwh/sim.annual.pv_kwh*100,0)}% of PV generation) is high — consider reducing PV capacity or adding productive use loads. `}
                  {sim.annual.unmet_load_fraction <= 5 && sim.annual.renewable_fraction >= 50 && `LCOE of ${project.currency}${fmt(fin.metrics.lcoe,2)}/kWh vs tariff of ${project.currency}${finance.tariff_per_kwh}/kWh. NPV of ${project.currency}${fmtN(fin.metrics.npv)} over ${finance.project_lifetime} years. Proceed to detailed feasibility study.`}
                </div>
              </Card>

              <div style={{ marginTop: 8, padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 10, color: C.textDim, lineHeight: 1.8 }}>
                ⚠️ <strong>Pre-feasibility disclaimer:</strong> Results are indicative only (±15–20% accuracy). Not suitable for procurement or investment decisions without detailed engineering study. Solar data based on typical meteorological year. Financial projections assume constant tariff and fuel prices over project lifetime.
              </div>

              {/* ── Energy Flow Simulator ── */}
              <Card style={{ marginTop: 24 }}>
                <EnergyFlowSimulator sim={sim} system={system} />
              </Card>
            </div>
          )}

          {/* ── Step Navigation ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
            <Btn variant="ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} icon="←">Back</Btn>
            <div style={{ display: 'flex', gap: 8 }}>
              {step < 5 && <Btn onClick={() => canProceed() && setStep(s => s + 1)} disabled={!canProceed()} icon="→" style={{ flexDirection: 'row-reverse' }}>
                {step === 4 ? 'Go to Simulation' : 'Next'}
              </Btn>}
              {step === 5 && !simRunning && !sim && <Btn onClick={runSimulation} icon="▶">Run Simulation</Btn>}
              {step === 5 && sim && <Btn onClick={() => setStep(6)} icon="📊">View Results</Btn>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DesignTool;
