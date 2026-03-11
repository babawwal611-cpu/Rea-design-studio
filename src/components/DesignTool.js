import React, { useState, useCallback, useRef, useEffect } from 'react';
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

/* ─── Design Tokens ──────────────────────────────────────────────────────── */
const C = {
  bg:        '#0A0F0D',
  surface:   '#111916',
  panel:     '#161E18',
  border:    '#1E3025',
  borderHi:  '#2A4A35',
  green:     '#00C48C',
  greenDark: '#00843D',
  greenDim:  '#0D3320',
  gold:      '#F5A623',
  goldDim:   '#3A2800',
  red:       '#FF4757',
  blue:      '#3B82F6',
  purple:    '#A855F7',
  text:      '#E2EDE7',
  textMid:   '#6B9E80',
  textDim:   '#2D5240',
  white:     '#FFFFFF',
};

const FONT_URL = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@700;800&display=swap";

/* ─── Utility ────────────────────────────────────────────────────────────── */
const fmt  = (n, dec = 0) => typeof n === 'number' && isFinite(n) ? n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—';
const fmtN = (n) => n >= 1e6 ? `${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `${(n/1e3).toFixed(1)}k` : fmt(n);

/* ─── Sub-components ─────────────────────────────────────────────────────── */
const Label = ({ children, hint }) => (
  <div style={{ marginBottom: 6 }}>
    <span style={{ fontSize: 11, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: "'Space Grotesk', sans-serif" }}>{children}</span>
    {hint && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 8, fontFamily: "'Space Grotesk', sans-serif" }}>{hint}</span>}
  </div>
);

const Input = ({ value, onChange, type = 'number', min, max, step, placeholder, unit, style = {} }) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      min={min} max={max} step={step} placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 14px', paddingRight: unit ? 48 : 14,
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.text, fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
        outline: 'none', transition: 'border 0.15s',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = C.green}
      onBlur={e  => e.target.style.borderColor = C.border}
    />
    {unit && <span style={{ position: 'absolute', right: 12, fontSize: 11, color: C.textDim, fontFamily: "'Space Grotesk', sans-serif", pointerEvents: 'none' }}>{unit}</span>}
  </div>
);

const Select = ({ value, onChange, options, style = {} }) => (
  <select value={value} onChange={e => onChange(e.target.value)} style={{
    width: '100%', padding: '10px 14px', background: C.surface,
    border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
    fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", outline: 'none', cursor: 'pointer', ...style,
  }}>
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Toggle = ({ checked, onChange, color = C.green }) => (
  <button onClick={() => onChange(!checked)} style={{
    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
    background: checked ? color : C.border, position: 'relative', transition: 'all 0.2s', flexShrink: 0,
  }}>
    <span style={{
      position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18,
      borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block',
    }} />
  </button>
);

const Btn = ({ children, onClick, variant = 'primary', disabled, style = {}, icon }) => {
  const variants = {
    primary:   { background: `linear-gradient(135deg, ${C.greenDark}, ${C.green})`, color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: C.green, border: `1px solid ${C.borderHi}` },
    ghost:     { background: 'transparent', color: C.textMid, border: `1px solid ${C.border}` },
    danger:    { background: 'transparent', color: C.red,  border: `1px solid ${C.red}44` },
    gold:      { background: `linear-gradient(135deg, #8B5E00, ${C.gold})`, color: '#fff', border: 'none' },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...v, padding: '10px 20px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: 12, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
      letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 7,
      opacity: disabled ? 0.4 : 1, transition: 'all 0.15s', whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
};

const Card = ({ children, style = {}, glow }) => (
  <div style={{
    background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: '20px', boxShadow: glow ? `0 0 24px ${glow}18` : 'none', ...style,
  }}>
    {children}
  </div>
);

const SectionHead = ({ icon, title, sub }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.text, fontFamily: "'Syne', sans-serif", letterSpacing: -0.5 }}>{title}</h2>
    </div>
    {sub && <p style={{ margin: 0, fontSize: 13, color: C.textMid, fontFamily: "'Space Grotesk', sans-serif", paddingLeft: 30 }}>{sub}</p>}
  </div>
);

/* Mini sparkline using SVG */
const Sparkline = ({ data, color = C.green, height = 40 }) => {
  if (!data || data.length === 0) return null;
  const w = 200, h = height;
  const max = Math.max(...data, 0.001);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

/* Radial gauge for renewable fraction */
const Gauge = ({ value, max = 100, color = C.green, label, size = 120 }) => {
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
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={C.border} strokeWidth={8} strokeLinecap="round" />
      {pct > 0 && <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />}
      <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize={size * 0.18} fontWeight={700} fontFamily="'JetBrains Mono', monospace">{fmt(value, 1)}%</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={C.textDim} fontSize={size * 0.09} fontFamily="'Space Grotesk', sans-serif">{label}</text>
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
    <svg width="100%" viewBox={`0 0 ${W} ${H + padB}`} style={{ display: 'block' }}>
      {monthly.map((m, i) => {
        const x   = padL + i * ((W - padL) / 12);
        const pvH  = maxVal > 0 ? (m.pv_kwh  / maxVal) * H : 0;
        const ldH  = maxVal > 0 ? (m.load_kwh / maxVal) * H : 0;
        const genH = maxVal > 0 ? (m.gen_kwh  / maxVal) * H : 0;
        return (
          <g key={i}>
            {/* Load outline */}
            <rect x={x + 1} y={H - ldH} width={barW - 2} height={ldH} fill="none" stroke={C.borderHi} strokeWidth={1} rx={2} />
            {/* PV fill */}
            <rect x={x + 2} y={H - pvH} width={barW - 4} height={pvH} fill={C.green} fillOpacity={0.75} rx={2} />
            {/* Generator */}
            {genH > 0 && <rect x={x + 2} y={H - ldH} width={barW - 4} height={genH} fill={C.gold} fillOpacity={0.8} rx={2} />}
            {/* Excess */}
            {m.excess_kwh > 0 && <rect x={x + 2} y={H - pvH} width={barW - 4} height={Math.min(4, pvH)} fill={C.blue} fillOpacity={0.8} />}
            <text x={x + barW / 2} y={H + padB - 2} textAnchor="middle" fill={C.textDim} fontSize={9} fontFamily="'Space Grotesk',sans-serif">{MONTHS[i]}</text>
          </g>
        );
      })}
      {/* Y-axis label */}
      <text x={4} y={8} fill={C.textDim} fontSize={8} fontFamily="'Space Grotesk',sans-serif">kWh</text>
    </svg>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const STEPS = [
  { id: 'project',  label: 'Project',   icon: '📋' },
  { id: 'load',     label: 'Load',      icon: '⚡' },
  { id: 'solar',    label: 'Solar',     icon: '☀️' },
  { id: 'system',   label: 'System',    icon: '⚙️' },
  { id: 'finance',  label: 'Finance',   icon: '₦'  },
  { id: 'simulate', label: 'Simulate',  icon: '▶'  },
  { id: 'results',  label: 'Results',   icon: '📊' },
];

const DesignTool = () => {
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
    method:       'template',   // 'template' | 'csv' | 'manual'
    template:     'village_100hh',
    daily_kwh:    120,
    profile_type: 'rural_village',
    csvData:      null,
    csvName:      '',
    customProfile: null,
  });

  /* ── Solar config ── */
  const [solar, setSolar] = useState({
    method:     'pvgis',        // 'pvgis' | 'city' | 'manual'
    cityIndex:  0,
    avg_ghi:    5.5,
    avg_temp:   29,
    solarData:  null,
    fetching:   false,
    fetchError: '',
    fetched:    false,
  });

  /* ── System config ── */
  const [system, setSystem] = useState({
    pv_capacity_kw:      50,
    pv_tilt:             15,
    pv_alpha:            -0.004,
    battery_capacity_kwh: 100,
    battery_type:        'lithium',   // 'lithium' | 'lead_acid'
    battery_dod:         0.85,
    battery_eta_charge:  0.95,
    battery_eta_discharge: 0.95,
    battery_c_rate:      0.5,
    gen_enabled:         true,
    gen_capacity_kw:     30,
    gen_cycle_charging:  false,
  });

  /* ── Financial config ── */
  const [finance, setFinance] = useState({
    pv_cost_per_kw:       400000,
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

  /* ── Fetch PVGIS solar data ── */
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

    try {
      const data = await fetchPVGISSolar(lat, lng);
      sol('solarData', data);
      const avgGHI = data.reduce((s, h) => s + h.ghi, 0) / (8760 * 1000); // convert to kWh/m²/day avg
      sol('avg_ghi', parseFloat((avgGHI * 24).toFixed(2)));
      sol('fetched', true);
    } catch (err) {
      sol('fetchError', `PVGIS unavailable: ${err.message}. Using synthetic data.`);
      // Fall back to synthetic data
      const cityData = NIGERIA_CITIES_SOLAR.find(c => {
        const dLat = Math.abs(c.lat - lat), dLng = Math.abs(c.lng - lng);
        return dLat < 3 && dLng < 3;
      }) || NIGERIA_CITIES_SOLAR[0];
      const data = generateSyntheticSolar(cityData.avg_ghi, cityData.avg_temp);
      sol('solarData', data);
      sol('avg_ghi', cityData.avg_ghi);
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
      } else {
        const tpl = NIGERIA_DEFAULTS.load_templates.find(t => t.id === load.template);
        const dailyKWh = load.method === 'manual' ? parseFloat(load.daily_kwh) : (tpl?.daily_kwh || 120);
        const profileType = load.method === 'manual' ? load.profile_type : (load.template.includes('school') ? 'school' : load.template.includes('clinic') ? 'health_clinic' : load.template.includes('borehole') ? 'borehole' : load.template.includes('market') ? 'market' : 'rural_village');
        loadProfile = generateLoadProfile(dailyKWh, profileType);
        log(`Generated ${profileType} load profile: ${dailyKWh} kWh/day average`);
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
        capacity_kw: parseFloat(system.pv_capacity_kw),
        alpha: parseFloat(system.pv_alpha),
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
        cycleCharging:  system.gen_cycle_charging,
        fuel_price:     parseFloat(finance.fuel_price_per_litre),
      };

      log(`PV: ${pvConfig.capacity_kw} kWp | Battery: ${batteryConfig.capacity_kwh} kWh | Gen: ${genConfig.enabled ? genConfig.capacity_kw + ' kW' : 'disabled'}`);

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
      log('✅ Analysis complete. Viewing results...');

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
      case 1: return load.method === 'csv' ? !!load.csvData : true;
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

  /* ─── RENDER ─────────────────────────────────────────────────────────── */

  const glass = (extra = {}) => ({
    background: 'rgba(17,25,22,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    ...extra,
  });

  return (
    <>
      <link href={FONT_URL} rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${C.bg}; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: ${C.borderHi}; border-radius: 2px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: ${C.textDim}; }
        select option { background: ${C.panel}; color: ${C.text}; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes progress { from{width:0} }
        .step-content { animation: fadeIn 0.25s ease; }
        .sim-log-entry { animation: fadeIn 0.15s ease; }
      `}</style>

      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: "'Space Grotesk', sans-serif" }}>

        {/* ── Top Bar ── */}
        <div style={{ ...glass({ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }), padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/" style={{ textDecoration: 'none', color: C.textMid, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              ← Operations Map
            </a>
            <div style={{ width: 1, height: 20, background: C.border }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: "'Syne', sans-serif", letterSpacing: -0.5, lineHeight: 1 }}>
                ⚡ REA Mini-Grid Design Studio
              </div>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1, textTransform: 'uppercase' }}>
                Pre-Feasibility Simulation Tool · v1.0
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {project.name && <span style={{ fontSize: 12, color: C.textMid, fontWeight: 500 }}>📋 {project.name}</span>}
            {sim && <Btn variant="secondary" onClick={exportCSV} icon="↓" style={{ padding: '7px 14px', fontSize: 11 }}>Export CSV</Btn>}
          </div>
        </div>

        {/* ── Step Indicator ── */}
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 28px', display: 'flex', gap: 0, overflowX: 'auto' }}>
          {STEPS.map((s, i) => {
            const active   = i === step;
            const done     = i < step;
            const canClick = i <= step || (i === step + 1 && canProceed());
            return (
              <button key={s.id} onClick={() => canClick && setStep(i)} style={{
                padding: '12px 20px', background: 'none', border: 'none', cursor: canClick ? 'pointer' : 'default',
                borderBottom: `2px solid ${active ? C.green : 'transparent'}`,
                color: active ? C.green : done ? C.textMid : C.textDim,
                fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: "'Space Grotesk', sans-serif",
                display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: done ? 12 : 13 }}>{done ? '✓' : s.icon}</span>
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
              <SectionHead icon="📋" title="Project Setup" sub="Define the project site and basic information." />
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
                      style={{ width: '100%', padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", resize: 'vertical', outline: 'none' }}
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
                        background: project.location === city.name ? C.greenDim : 'transparent',
                        color: project.location === city.name ? C.green : C.textMid,
                        fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                        transition: 'all 0.15s',
                      }}>
                        {city.name}
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ════════════════════════════════ STEP 1: LOAD ═════════════════════════════════ */}
          {step === 1 && (
            <div className="step-content">
              <SectionHead icon="⚡" title="Load Profile" sub="Define the community's hourly electricity demand for a full year." />

              {/* Method selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { id: 'template', label: '📋 Use Template' },
                  { id: 'csv',      label: '📂 Upload CSV'   },
                  { id: 'manual',   label: '✏️ Manual Input'  },
                ].map(m => (
                  <button key={m.id} onClick={() => ld('method', m.id)} style={{
                    padding: '9px 18px', borderRadius: 8, cursor: 'pointer',
                    background: load.method === m.id ? C.greenDim : 'transparent',
                    border: `1px solid ${load.method === m.id ? C.green : C.border}`,
                    color: load.method === m.id ? C.green : C.textMid,
                    fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
                  }}>{m.label}</button>
                ))}
              </div>

              {load.method === 'template' && (
                <div>
                  <Card>
                    <Label>Select Community Type</Label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
                      {NIGERIA_DEFAULTS.load_templates.map(t => (
                        <button key={t.id} onClick={() => { ld('template', t.id); ld('daily_kwh', t.daily_kwh); }} style={{
                          padding: '14px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                          background: load.template === t.id ? C.greenDim : C.surface,
                          border: `1px solid ${load.template === t.id ? C.green : C.border}`,
                          transition: 'all 0.15s',
                        }}>
                          <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: load.template === t.id ? C.green : C.text, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.3 }}>{t.label}</div>
                          <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{t.daily_kwh} kWh/day</div>
                        </button>
                      ))}
                    </div>
                  </Card>
                  {load.template && (
                    <Card style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 12, color: C.textMid, marginBottom: 2 }}>Selected daily demand</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: C.green, fontFamily: "'JetBrains Mono', monospace" }}>
                            {load.daily_kwh} <span style={{ fontSize: 14, color: C.textMid }}>kWh/day</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.textDim }}>≈ {fmt(load.daily_kwh * 365)} kWh/year · Peak ≈ {fmt(load.daily_kwh / 18, 1)} kW</div>
                        </div>
                        <Sparkline data={Array.from({length:24}, (_,h) => {
                          const shapes = [0.15,0.10,0.08,0.07,0.08,0.12,0.30,0.55,0.50,0.45,0.42,0.40,0.45,0.42,0.40,0.45,0.60,0.80,1.00,0.95,0.85,0.70,0.45,0.25];
                          return shapes[h] * (load.daily_kwh / 18);
                        })} color={C.green} height={60} />
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {load.method === 'csv' && (
                <Card>
                  <div style={{ border: `2px dashed ${C.borderHi}`, borderRadius: 10, padding: '32px', textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => fileInputRef.current?.click()}>
                    <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleCSV} style={{ display: 'none' }} />
                    {load.csvData ? (
                      <>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.green }}>{load.csvName}</div>
                        <div style={{ fontSize: 11, color: C.textMid, marginTop: 4 }}>8760 hours loaded · Daily avg: {fmt(load.daily_kwh, 1)} kWh</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid }}>Click to upload hourly load CSV</div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>Must contain 8760 rows of hourly load in kW<br/>Comma, semicolon, or tab delimited</div>
                      </>
                    )}
                  </div>
                  {errors.csv && <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, fontSize: 12, color: C.red }}>{errors.csv}</div>}
                  <div style={{ marginTop: 16, padding: '12px 14px', background: C.surface, borderRadius: 8, fontSize: 11, color: C.textDim, lineHeight: 1.7 }}>
                    <strong style={{ color: C.textMid }}>CSV Format:</strong> One numeric value per row (kW demand each hour, Hour 1 = Jan 1 00:00). Optional header row is auto-skipped. Multiple columns: last numeric column is used.
                  </div>
                </Card>
              )}

              {load.method === 'manual' && (
                <Card>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <Label hint="average daily demand">Daily Energy (kWh/day)</Label>
                      <Input value={load.daily_kwh} onChange={v => ld('daily_kwh', v)} min={0.1} step={0.5} unit="kWh/d" />
                    </div>
                    <div>
                      <Label>Load Shape Profile</Label>
                      <Select value={load.profile_type} onChange={v => ld('profile_type', v)} options={[
                        { value: 'rural_village', label: 'Rural Village (evening peak)' },
                        { value: 'school',        label: 'School (daytime)' },
                        { value: 'health_clinic', label: 'Health Clinic (flat 24hr)' },
                        { value: 'market',        label: 'Market (daytime peak)' },
                        { value: 'borehole',      label: 'Borehole (daytime pump)' },
                      ]} />
                    </div>
                  </div>
                  <div style={{ marginTop: 16, padding: '10px 14px', background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 8, fontSize: 11, color: C.gold }}>
                    ⚠️ Manual input generates a synthetic hourly profile using Nigerian load shape templates with ±5% random variation.
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ════════════════════════════════ STEP 2: SOLAR ════════════════════════════════ */}
          {step === 2 && (
            <div className="step-content">
              <SectionHead icon="☀️" title="Solar Resource" sub="Retrieve or define the hourly solar irradiance for the project site." />

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[
                  { id: 'pvgis', label: '🌍 PVGIS API (Recommended)' },
                  { id: 'city',  label: '📍 Nigerian City Preset'     },
                  { id: 'manual',label: '✏️ Enter GHI Manually'        },
                ].map(m => (
                  <button key={m.id} onClick={() => sol('method', m.id)} style={{
                    padding: '9px 18px', borderRadius: 8, cursor: 'pointer',
                    background: solar.method === m.id ? C.greenDim : 'transparent',
                    border: `1px solid ${solar.method === m.id ? C.green : C.border}`,
                    color: solar.method === m.id ? C.green : C.textMid,
                    fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
                  }}>{m.label}</button>
                ))}
              </div>

              {solar.method === 'pvgis' && (
                <Card>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 16, lineHeight: 1.7 }}>
                    PVGIS (EU JRC) provides free Typical Meteorological Year data with actual hourly irradiance and temperature. Using coordinates from Step 1: <strong style={{ color: C.text }}>{project.lat || '—'}, {project.lng || '—'}</strong>
                  </div>
                  <Btn onClick={fetchSolar} disabled={solar.fetching || !project.lat || !project.lng} icon={solar.fetching ? '⏳' : '🌍'}>
                    {solar.fetching ? 'Fetching from PVGIS...' : 'Fetch Solar Data from PVGIS'}
                  </Btn>
                  {solar.fetchError && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 8, fontSize: 11, color: C.gold }}>{solar.fetchError}</div>
                  )}
                  {solar.fetched && (
                    <div style={{ marginTop: 16, padding: '14px', background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 4 }}>✅ Solar data ready</div>
                      <div style={{ fontSize: 11, color: C.textMid }}>8760 hourly values loaded · Avg GHI: <strong style={{ color: C.text }}>{solar.avg_ghi} kWh/m²/day</strong></div>
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
                        background: solar.cityIndex === i ? C.greenDim : C.surface,
                        border: `1px solid ${solar.cityIndex === i ? C.green : C.border}`,
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: solar.cityIndex === i ? C.green : C.text, fontFamily: "'Space Grotesk', sans-serif" }}>{city.name}</div>
                        <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
                          GHI {city.avg_ghi} · {city.avg_temp}°C
                        </div>
                      </button>
                    ))}
                  </div>
                  {solar.fetched && (
                    <div style={{ marginTop: 16, padding: '10px 14px', background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 8, fontSize: 11, color: C.green }}>
                      ✅ Synthetic TMY generated for {NIGERIA_CITIES_SOLAR[solar.cityIndex].name}
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
                  }} style={{ marginTop: 16 }} icon="⚙️">Generate Synthetic TMY</Btn>
                  {solar.fetched && <div style={{ marginTop: 12, padding: '10px 14px', background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 8, fontSize: 11, color: C.green }}>✅ Synthetic hourly TMY generated from GHI = {solar.avg_ghi} kWh/m²/day</div>}
                </Card>
              )}
            </div>
          )}

          {/* ════════════════════════════════ STEP 3: SYSTEM ═══════════════════════════════ */}
          {step === 3 && (
            <div className="step-content">
              <SectionHead icon="⚙️" title="System Configuration" sub="Define the size and parameters of each system component." />
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
                      🔌 Diesel Generator (Backup)
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
                        <Label hint="run generator at full capacity to charge battery">Cycle Charging</Label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                          <Toggle checked={system.gen_cycle_charging} onChange={v => sys('gen_cycle_charging', v)} color={C.gold} />
                          <span style={{ fontSize: 11, color: C.textMid }}>{system.gen_cycle_charging ? 'Enabled' : 'Load Following'}</span>
                        </div>
                      </div>
                      <div>
                        <Label hint="L/hr per kW at full load">Fuel Consumption</Label>
                        <div style={{ padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 12, color: C.textMid, fontFamily: "'JetBrains Mono', monospace" }}>
                          ~{fmt(0.246 * system.gen_capacity_kw, 1)} L/hr @ full
                        </div>
                      </div>
                    </div>
                  )}
                </Card>

                {/* System Summary */}
                <Card style={{ gridColumn: '1 / -1', background: C.greenDim, border: `1px solid ${C.green}30` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>System Summary</div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {[
                      { label: 'PV Capacity',      value: `${system.pv_capacity_kw} kWp`,                      color: C.gold   },
                      { label: 'Battery',           value: `${system.battery_capacity_kwh} kWh (${system.battery_type === 'lithium' ? 'Li-ion' : 'Lead-Acid'})`, color: C.blue },
                      { label: 'Usable Storage',    value: `${fmt(system.battery_capacity_kwh * system.battery_dod, 1)} kWh`, color: C.blue },
                      { label: 'Generator',         value: system.gen_enabled ? `${system.gen_capacity_kw} kW diesel` : 'PV+Battery only', color: C.gold },
                      { label: 'PV:Battery ratio',  value: `1 : ${fmt(system.battery_capacity_kwh / system.pv_capacity_kw, 2)}`, color: C.green },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: C.textDim, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
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
              <SectionHead icon="₦" title="Financial Parameters" sub="Set equipment costs and economic assumptions. Nigerian market defaults are pre-loaded." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                <Card>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 14 }}>💰 Equipment Costs ({project.currency})</div>
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 14 }}>📈 Economic Assumptions</div>
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
                <Card style={{ gridColumn: '1 / -1', background: C.greenDim, border: `1px solid ${C.green}30` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Estimated CapEx Preview</div>
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
                        { label: 'Inverter',    value: inv, color: C.green },
                        { label: 'BOS+Install', value: bos+inst, color: C.textMid },
                        { label: 'TOTAL',       value: tot, color: C.green, big: true },
                      ].map(({ label, value, color, big }) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: C.textDim }}>{label}</div>
                          <div style={{ fontSize: big ? 20 : 14, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{project.currency}{fmtN(value)}</div>
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
              <SectionHead icon="▶" title="Run Simulation" sub="Execute the 8760-hour hourly dispatch model." />

              {/* Pre-sim checklist */}
              <Card style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMid, marginBottom: 14 }}>Pre-Simulation Checklist</div>
                {[
                  { ok: project.name.trim().length > 0,               label: `Project: ${project.name || 'Not set'}` },
                  { ok: load.method !== 'csv' || !!load.csvData,       label: `Load: ${load.method === 'csv' ? (load.csvData ? load.csvName : 'CSV not uploaded') : `${load.daily_kwh} kWh/day`}` },
                  { ok: solar.fetched || solar.method === 'manual',    label: `Solar: ${solar.fetched ? `${solar.avg_ghi} kWh/m²/day` : 'Not fetched'}` },
                  { ok: system.pv_capacity_kw > 0,                     label: `PV: ${system.pv_capacity_kw} kWp` },
                  { ok: system.battery_capacity_kwh > 0,               label: `Battery: ${system.battery_capacity_kwh} kWh` },
                  { ok: true,                                           label: `Generator: ${system.gen_enabled ? system.gen_capacity_kw + ' kW' : 'Disabled'}` },
                ].map(({ ok, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <span style={{ color: ok ? C.green : C.red, fontSize: 16 }}>{ok ? '✓' : '✗'}</span>
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
                      <span style={{ fontSize: 12, color: C.green, fontFamily: "'JetBrains Mono', monospace" }}>{simProgress}%</span>
                    </div>
                    <div style={{ height: 6, background: C.surface, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${simProgress}%`, background: `linear-gradient(90deg, ${C.greenDark}, ${C.green})`, transition: 'width 0.3s', borderRadius: 3 }} />
                    </div>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, padding: '12px', maxHeight: 160, overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                    {simLog.map((line, i) => (
                      <div key={i} className="sim-log-entry" style={{ color: line.includes('✅') ? C.green : line.includes('❌') ? C.red : C.textMid, lineHeight: 1.8 }}>{line}</div>
                    ))}
                  </div>
                </Card>
              )}

              {!simRunning && simLog.length > 0 && (
                <Card style={{ marginBottom: 20, background: C.greenDim, border: `1px solid ${C.green}30` }}>
                  <div style={{ background: C.bg, borderRadius: 8, padding: '12px', maxHeight: 120, overflowY: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                    {simLog.map((line, i) => (
                      <div key={i} style={{ color: line.includes('✅') ? C.green : line.includes('❌') ? C.red : C.textMid, lineHeight: 1.8 }}>{line}</div>
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
                {sim && <Btn variant="secondary" onClick={() => setStep(6)} icon="📊">View Results</Btn>}
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
                <SectionHead icon="📊" title="Simulation Results" sub={`${project.name || 'Mini-Grid'} · ${project.location || ''}`} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="secondary" onClick={exportCSV} icon="↓" style={{ fontSize: 11 }}>Hourly CSV</Btn>
                  <Btn variant="ghost" onClick={() => setStep(5)} icon="↺" style={{ fontSize: 11 }}>Re-run</Btn>
                </div>
              </div>

              {/* ── Key Performance Indicators ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Annual PV Generation',   value: `${fmtN(sim.annual.pv_kwh)} kWh`,    color: C.gold,   icon: '☀️' },
                  { label: 'Load Demand',            value: `${fmtN(sim.annual.load_kwh)} kWh`,   color: C.blue,   icon: '⚡' },
                  { label: 'Generator Output',       value: `${fmtN(sim.annual.gen_kwh)} kWh`,    color: sim.annual.gen_kwh > 0 ? C.gold : C.textDim, icon: '🔌' },
                  { label: 'Excess / Curtailed',     value: `${fmtN(sim.annual.excess_kwh)} kWh`, color: C.blue,   icon: '↑'  },
                  { label: 'Unserved Load',          value: `${fmtN(sim.annual.unserved_kwh)} kWh (${fmt(sim.annual.unmet_load_fraction, 2)}%)`, color: sim.annual.unmet_load_fraction > 2 ? C.red : C.green, icon: '⚠️' },
                  { label: 'PV Capacity Factor',     value: `${fmt(sim.annual.capacity_factor_pv, 1)}%`, color: C.gold, icon: '📈' },
                  { label: 'Fuel Consumed',          value: `${fmtN(sim.annual.fuel_litres)} L`,  color: C.textMid, icon: '⛽' },
                  { label: 'Peak Load',              value: `${fmt(sim.annual.peak_load_kw, 2)} kW`, color: C.blue, icon: '📊' },
                ].map(({ label, value, color, icon }) => (
                  <Card key={label} style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.2 }}>{value}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>{label}</div>
                  </Card>
                ))}
              </div>

              {/* ── Renewable Fraction Gauge + Energy Balance ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, marginBottom: 16 }}>
                <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                  <Gauge value={sim.annual.renewable_fraction} color={sim.annual.renewable_fraction > 70 ? C.green : sim.annual.renewable_fraction > 40 ? C.gold : C.red} label="Renewable Fraction" size={150} />
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 8, textAlign: 'center' }}>
                    {sim.annual.renewable_fraction > 80 ? '🟢 Excellent' : sim.annual.renewable_fraction > 60 ? '🟡 Good' : '🔴 Low — consider more PV/battery'}
                  </div>
                </Card>
                <Card>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Monthly Energy Balance</div>
                  <MonthlyBarChart monthly={sim.monthly} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    {[{c:C.green,l:'PV Generation'},{c:C.gold,l:'Generator'},{c:C.blue,l:'Excess PV'}].map(({c,l}) => (
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
              </div>

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
                      { label: 'Inverter/Ctrl',    value: fin.capex.inverter,  color: C.green },
                      { label: 'BOS',              value: fin.capex.bos,       color: C.textMid },
                      { label: 'Installation',     value: fin.capex.install,   color: C.textMid },
                    ].map(({ label, value, color }) => {
                      const pct_ = fin.capex.total > 0 ? (value / fin.capex.total) * 100 : 0;
                      return value > 0 ? (
                        <div key={label} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: C.textMid }}>{label}</span>
                            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color }}>{project.currency}{fmtN(value)}</span>
                          </div>
                          <div style={{ height: 4, background: C.surface, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct_}%`, background: color, borderRadius: 2, opacity: 0.7 }} />
                          </div>
                        </div>
                      ) : null;
                    })}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>TOTAL CapEx</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: C.gold, fontFamily: "'JetBrains Mono', monospace" }}>{project.currency}{fmtN(fin.capex.total)}</span>
                    </div>
                  </div>

                  {/* Key Financial Metrics */}
                  <div>
                    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 10 }}>Key Economic Metrics</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { label: 'LCOE', value: `${project.currency}${fmt(fin.metrics.lcoe, 2)}/kWh`, color: fin.metrics.lcoe < finance.tariff_per_kwh ? C.green : C.red, hint: `Tariff: ${project.currency}${finance.tariff_per_kwh}/kWh` },
                        { label: 'Project NPV', value: `${project.currency}${fmtN(fin.metrics.npv)}`, color: fin.metrics.npv > 0 ? C.green : C.red, hint: `${finance.discount_rate*100}% discount, ${finance.project_lifetime}yr` },
                        { label: 'Simple Payback', value: fin.metrics.simple_payback === Infinity ? 'Not viable' : `${fmt(fin.metrics.simple_payback, 1)} years`, color: fin.metrics.simple_payback < 10 ? C.green : fin.metrics.simple_payback < 20 ? C.gold : C.red, hint: '' },
                        { label: 'Annual O&M + Fuel', value: `${project.currency}${fmtN(fin.annual.opex)}/yr`, color: C.textMid, hint: '' },
                        { label: 'Annual Revenue', value: `${project.currency}${fmtN(fin.annual.revenue)}/yr`, color: C.green, hint: '' },
                        { label: 'Beneficiaries Est.', value: `~${fmtN(fin.metrics.beneficiaries)} people`, color: C.blue, hint: '' },
                        { label: 'CO₂ Avoided', value: `${fmtN(fin.metrics.co2_avoided_kg)} kg/yr`, color: C.green, hint: 'vs diesel baseline' },
                      ].map(({ label, value, color, hint }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: C.surface, borderRadius: 8 }}>
                          <div>
                            <div style={{ fontSize: 11, color: C.textMid }}>{label}</div>
                            {hint && <div style={{ fontSize: 9, color: C.textDim }}>{hint}</div>}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* ── System Recommendation ── */}
              <Card style={{ background: sim.annual.unmet_load_fraction > 5 ? `${C.red}08` : sim.annual.renewable_fraction < 50 ? `${C.gold}08` : `${C.green}08`, border: `1px solid ${sim.annual.unmet_load_fraction > 5 ? C.red : sim.annual.renewable_fraction < 50 ? C.gold : C.green}30` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sim.annual.unmet_load_fraction > 5 ? C.red : sim.annual.renewable_fraction < 50 ? C.gold : C.green, marginBottom: 10 }}>
                  {sim.annual.unmet_load_fraction > 5 ? '⚠️ System Undersized' : sim.annual.renewable_fraction < 50 ? '🟡 System Viable — Low Renewable Fraction' : '✅ System Design Viable'}
                </div>
                <div style={{ fontSize: 12, color: C.textMid, lineHeight: 1.8 }}>
                  {sim.annual.unmet_load_fraction > 5 && `Unmet load of ${fmt(sim.annual.unmet_load_fraction, 1)}% is above the 5% threshold. Consider increasing PV capacity to ${Math.round(system.pv_capacity_kw * 1.3)} kWp or battery to ${Math.round(system.battery_capacity_kwh * 1.25)} kWh. `}
                  {sim.annual.renewable_fraction < 50 && `Renewable fraction of ${fmt(sim.annual.renewable_fraction, 1)}% is low. Increasing PV to ${Math.round(system.pv_capacity_kw * 1.4)} kWp and battery to ${Math.round(system.battery_capacity_kwh * 1.3)} kWh may significantly improve RE fraction. `}
                  {sim.annual.excess_kwh > sim.annual.pv_kwh * 0.3 && `Excess energy (${fmtN(sim.annual.excess_kwh)} kWh = ${fmt(sim.annual.excess_kwh/sim.annual.pv_kwh*100,0)}% of PV generation) is high — consider reducing PV capacity or adding productive use loads. `}
                  {sim.annual.unmet_load_fraction <= 5 && sim.annual.renewable_fraction >= 50 && `LCOE of ${project.currency}${fmt(fin.metrics.lcoe,2)}/kWh vs tariff of ${project.currency}${finance.tariff_per_kwh}/kWh. NPV of ${project.currency}${fmtN(fin.metrics.npv)} over ${finance.project_lifetime} years. Proceed to detailed feasibility study.`}
                </div>
              </Card>

              <div style={{ marginTop: 16, padding: '10px 14px', background: C.surface, borderRadius: 8, fontSize: 10, color: C.textDim, lineHeight: 1.8 }}>
                ⚠️ <strong>Pre-feasibility disclaimer:</strong> Results are indicative only (±15–20% accuracy). Not suitable for procurement or investment decisions without detailed engineering study. Solar data based on typical meteorological year. Financial projections assume constant tariff and fuel prices over project lifetime.
              </div>
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
