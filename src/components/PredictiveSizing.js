import React, { useState, useCallback, useMemo } from 'react';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const C = {
  bg: '#F4F7FB', white: '#FFFFFF', navy: '#0D2137',
  blue: '#0070CC', blueDim: '#EAF3FC', blueText: '#0058A0',
  cyan: '#00A3BF', cyanDim: '#E6F7FA', cyanDark: '#007A8F',
  green: '#059669', greenDim: '#D1FAE5',
  amber: '#D97706', amberDim: '#FEF3C7',
  red: '#DC2626', redDim: '#FEE2E2',
  text: '#1A2B3C', textMid: '#4A6580', textDim: '#94A3B8',
  border: '#E2EAF2', surface: '#FFFFFF',
};
const FONT = "'DM Sans', sans-serif";
const MONO = "'IBM Plex Mono', monospace";
const SERIF = "'Playfair Display', serif";

/* ─── Common appliances list ─────────────────────────────────────────────── */
const APPLIANCE_PRESETS = [
  { name: 'LED Bulb',         watt: 10,   icon: '💡' },
  { name: 'Fan (ceiling)',     watt: 75,   icon: '🌀' },
  { name: 'TV (32")',          watt: 60,   icon: '📺' },
  { name: 'TV (50")',          watt: 120,  icon: '📺' },
  { name: 'Phone charger',     watt: 10,   icon: '📱' },
  { name: 'Laptop',            watt: 65,   icon: '💻' },
  { name: 'Refrigerator',      watt: 150,  icon: '🧊' },
  { name: 'Deep freezer',      watt: 200,  icon: '🧊' },
  { name: 'Water pump (0.5hp)',watt: 373,  icon: '💧' },
  { name: 'Water pump (1hp)',  watt: 746,  icon: '💧' },
  { name: 'AC (1.5 ton)',      watt: 1500, icon: '❄️'  },
  { name: 'AC (1 ton)',        watt: 1000, icon: '❄️'  },
  { name: 'Pressing iron',     watt: 1000, icon: '🧺' },
  { name: 'Rice cooker',       watt: 700,  icon: '🍚' },
  { name: 'Microwave',         watt: 900,  icon: '📡' },
  { name: 'Borehole pump',     watt: 1100, icon: '🌊' },
  { name: 'CCTV system',       watt: 50,   icon: '📷' },
  { name: 'Router/modem',      watt: 15,   icon: '📶' },
];

/* ─── Core sizing engine (simplified — no solar/cost params per spec) ─────── */
function calcSystemSize({ daily_kwh, peak_kw, backup_hours, grid_hours_per_day, solar_support }) {
  // Effective daily demand accounting for grid availability
  // If grid available N hours/day, battery only needs to cover the off-grid window
  const off_grid_hours = Math.max(0, 24 - grid_hours_per_day);
  // Energy needed from battery per day (fraction of daily load during off-grid window)
  const batt_energy_needed = daily_kwh * (off_grid_hours / 24);
  // Add backup_hours of full-load autonomy on top
  const backup_kwh = peak_kw * backup_hours;
  // Total battery (nameplate at 85% DoD, 95% round-trip efficiency)
  const DOD = 0.85;
  const eta_rt = 0.92; // round-trip efficiency
  const battery_kwh = Math.ceil((batt_energy_needed + backup_kwh) / (DOD * eta_rt));

  // PV sizing (only if solar_support enabled)
  let pv_kw = 0;
  let inverter_kva = 0;

  if (solar_support) {
    // Use a conservative 4.5 PSH (mid-Nigeria average)
    // PV must cover daily demand + battery charging losses
    const PSH = 4.5;
    const system_eta = 0.80; // derating × inverter efficiency
    pv_kw = Math.ceil((daily_kwh / (PSH * system_eta)) * 10) / 10;

    // Inverter: cover peak load with 25% safety margin
    inverter_kva = Math.ceil(peak_kw * 1.25 * 10) / 10;
  } else {
    // Battery-only / generator + battery: inverter covers peak load
    inverter_kva = Math.ceil(peak_kw * 1.25 * 10) / 10;
  }

  return {
    battery_kwh: Math.round(battery_kwh),
    usable_kwh:  Math.round(battery_kwh * DOD),
    pv_kw:       parseFloat(pv_kw.toFixed(1)),
    inverter_kva: parseFloat(inverter_kva.toFixed(1)),
    daily_kwh:   parseFloat(daily_kwh.toFixed(1)),
    peak_kw:     parseFloat(peak_kw.toFixed(1)),
  };
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div style={{
    background: C.white, borderRadius: 16, border: `1px solid ${C.border}`,
    padding: '24px', ...style,
  }}>
    {children}
  </div>
);

const StepDot = ({ n, active, done }) => (
  <div style={{
    width: 32, height: 32, borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600,
    fontFamily: FONT, transition: 'all 0.2s',
    background: done ? C.green : active ? C.blue : C.border,
    color: done || active ? '#fff' : C.textDim,
  }}>
    {done ? '✓' : n}
  </div>
);

const ResultPill = ({ label, value, unit, color = C.blue }) => (
  <div style={{
    background: C.bg, borderRadius: 12, padding: '16px 20px',
    border: `1px solid ${C.border}`, textAlign: 'center',
  }}>
    <div style={{ fontSize: 11, color: C.textMid, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 600, color, fontFamily: MONO }}>{value}</div>
    <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>{unit}</div>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────────────────── */
export default function PredictiveSizing({ onBack, onPushToSimulation }) {
  const [step, setStep] = useState(0); // 0=energy, 1=backup, 2=grid, 3=solar, 4=result

  /* ── State ── */
  const [energyMethod, setEnergyMethod] = useState(null); // 'quick' | 'appliance'
  const [quickKwh, setQuickKwh] = useState('');
  const [appliances, setAppliances] = useState([
    { id: 1, name: 'LED Bulb', watt: 10, qty: 6, hours: 6 },
  ]);
  const [nextId, setNextId] = useState(2);
  const [backupHours, setBackupHours] = useState(4);
  const [gridHours, setGridHours] = useState(0);
  const [solarSupport, setSolarSupport] = useState(true);

  /* ── Derived energy totals ── */
  const applianceKwh = useMemo(() => {
    return appliances.reduce((sum, a) => {
      const e = (a.watt * a.qty * a.hours) / 1000; // kWh/day
      return sum + e;
    }, 0);
  }, [appliances]);

  const appliancePeakKw = useMemo(() => {
    // Peak = sum of all appliances running simultaneously at 80% coincidence
    return appliances.reduce((sum, a) => sum + (a.watt * a.qty) / 1000, 0) * 0.8;
  }, [appliances]);

  const daily_kwh = energyMethod === 'quick'
    ? (parseFloat(quickKwh) || 0)
    : applianceKwh;

  const peak_kw = energyMethod === 'quick'
    ? daily_kwh / 5  // rough estimate: daily/5 for quick mode
    : appliancePeakKw;

  /* ── Appliance CRUD ── */
  const addAppliance = useCallback((preset = null) => {
    setAppliances(prev => [...prev, {
      id: nextId,
      name:  preset?.name  || 'Custom appliance',
      watt:  preset?.watt  || 100,
      qty:   1,
      hours: 4,
    }]);
    setNextId(n => n + 1);
  }, [nextId]);

  const updateAppliance = useCallback((id, field, value) => {
    setAppliances(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  }, []);

  const removeAppliance = useCallback((id) => {
    setAppliances(prev => prev.filter(a => a.id !== id));
  }, []);

  /* ── Sizing result ── */
  const result = useMemo(() => {
    if (daily_kwh <= 0) return null;
    return calcSystemSize({ daily_kwh, peak_kw: Math.max(peak_kw, 0.5), backup_hours: backupHours, grid_hours_per_day: gridHours, solar_support: solarSupport });
  }, [daily_kwh, peak_kw, backupHours, gridHours, solarSupport]);

  /* ── Navigation guards ── */
  const canNext = () => {
    if (step === 0) return energyMethod && daily_kwh > 0;
    if (step === 1) return backupHours >= 0;
    if (step === 2) return gridHours >= 0 && gridHours <= 24;
    if (step === 3) return true;
    return false;
  };

  const STEPS = ['Energy needs', 'Backup time', 'Grid supply', 'Solar support'];

  /* ── Push to simulation ── */
  const handlePush = () => {
    if (!result || !onPushToSimulation) return;
    onPushToSimulation({
      pv_capacity_kw:       result.pv_kw,
      battery_capacity_kwh: result.battery_kwh,
      inverter_capacity_kw: result.inverter_kva,
      gen_capacity_kw:      0,
      gen_enabled:          false,
      daily_kwh:            result.daily_kwh,
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500&family=IBM+Plex+Mono:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .fade-up { animation: fadeUp 0.3s ease both; }
        .appliance-row:hover { background: ${C.bg} !important; }
        .preset-btn:hover { border-color: ${C.blue} !important; background: ${C.blueDim} !important; }
        .method-card { cursor: pointer; transition: all 0.2s; border: 2px solid ${C.border}; border-radius: 14px; padding: 24px; background: ${C.white}; }
        .method-card:hover { border-color: ${C.blue}; }
        .method-card.selected { border-color: ${C.blue}; background: ${C.blueDim}; }
        .nav-btn { padding: 11px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; font-family: ${FONT}; cursor: pointer; transition: all 0.15s; }
        .nav-btn:active { transform: scale(0.98); }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${C.border}`, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.textMid, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
            ← Back
          </button>
          <div style={{ width: 1, height: 16, background: C.border }} />
          <span style={{ fontSize: 15, fontFamily: SERIF, fontStyle: 'italic', color: C.navy }}>Quick System Estimate</span>
        </div>
        {/* Step progress in topbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StepDot n={i + 1} active={step === i} done={step > i} />
                {step === i && <span style={{ fontSize: 12, color: C.textMid }}>{s}</span>}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 20, height: 1, background: step > i ? C.green : C.border }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* ════ STEP 0: ENERGY INPUT ════ */}
        {step === 0 && (
          <div className="fade-up">
            <h2 style={{ fontSize: 24, fontFamily: SERIF, fontStyle: 'italic', color: C.navy, marginBottom: 6 }}>
              How much energy do you need?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, marginBottom: 24 }}>
              Choose how you want to enter your daily energy demand.
            </p>

            {/* Method selector */}
            {!energyMethod && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                <div className="method-card" onClick={() => setEnergyMethod('quick')}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 6 }}>Quick estimate</div>
                  <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>
                    Enter your average daily energy consumption directly in kWh.
                  </div>
                </div>
                <div className="method-card" onClick={() => setEnergyMethod('appliance')}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>🔌</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 6 }}>Appliance calculator</div>
                  <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>
                    Add your appliances with quantity and daily hours. Total is calculated automatically.
                  </div>
                </div>
              </div>
            )}

            {/* Quick estimate */}
            {energyMethod === 'quick' && (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>⚡ Quick estimate</span>
                  <button onClick={() => { setEnergyMethod(null); setQuickKwh(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.textMid }}>Change method</button>
                </div>
                <label style={{ fontSize: 13, color: C.textMid, display: 'block', marginBottom: 8 }}>Average daily energy consumption</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="number" min={0} step={0.1}
                    value={quickKwh}
                    onChange={e => setQuickKwh(e.target.value)}
                    placeholder="e.g. 50"
                    style={{
                      flex: 1, padding: '12px 16px', fontSize: 22, fontFamily: MONO, fontWeight: 600,
                      border: `1.5px solid ${quickKwh ? C.blue : C.border}`, borderRadius: 10, outline: 'none',
                      color: C.text, background: C.white,
                    }}
                  />
                  <span style={{ fontSize: 16, color: C.textMid, fontWeight: 500 }}>kWh/day</span>
                </div>
                {quickKwh && parseFloat(quickKwh) > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: C.greenDim, borderRadius: 8, fontSize: 13, color: C.green }}>
                    ✓ {parseFloat(quickKwh).toFixed(1)} kWh/day entered. Estimated peak load: ~{(parseFloat(quickKwh) / 5).toFixed(1)} kW.
                  </div>
                )}
              </Card>
            )}

            {/* Appliance calculator */}
            {energyMethod === 'appliance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>🔌 Appliance calculator</span>
                  <button onClick={() => { setEnergyMethod(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.textMid }}>Change method</button>
                </div>

                {/* Appliance rows */}
                <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 80px 70px 32px', gap: 8, padding: '10px 16px', background: C.bg, fontSize: 11, fontWeight: 600, color: C.textMid, borderBottom: `1px solid ${C.border}` }}>
                    <span>Appliance</span>
                    <span style={{ textAlign: 'center' }}>Watts (W)</span>
                    <span style={{ textAlign: 'center' }}>Qty</span>
                    <span style={{ textAlign: 'center' }}>Hrs/day</span>
                    <span style={{ textAlign: 'right' }}>kWh/day</span>
                    <span />
                  </div>
                  {appliances.map(a => {
                    const kwh = (a.watt * a.qty * a.hours) / 1000;
                    return (
                      <div key={a.id} className="appliance-row" style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 80px 70px 32px', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${C.border}`, alignItems: 'center', background: C.white, transition: 'background 0.1s' }}>
                        <input
                          value={a.name}
                          onChange={e => updateAppliance(a.id, 'name', e.target.value)}
                          style={{ padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: FONT, color: C.text, background: 'transparent', outline: 'none', width: '100%' }}
                        />
                        <input
                          type="number" min={1} value={a.watt}
                          onChange={e => updateAppliance(a.id, 'watt', parseFloat(e.target.value) || 0)}
                          style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: MONO, color: C.text, textAlign: 'center', background: 'transparent', outline: 'none', width: '100%' }}
                        />
                        <input
                          type="number" min={1} max={100} value={a.qty}
                          onChange={e => updateAppliance(a.id, 'qty', parseInt(e.target.value) || 1)}
                          style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: MONO, color: C.text, textAlign: 'center', background: 'transparent', outline: 'none', width: '100%' }}
                        />
                        <input
                          type="number" min={0} max={24} step={0.5} value={a.hours}
                          onChange={e => updateAppliance(a.id, 'hours', parseFloat(e.target.value) || 0)}
                          style={{ padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, fontFamily: MONO, color: C.text, textAlign: 'center', background: 'transparent', outline: 'none', width: '100%' }}
                        />
                        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: C.blue, textAlign: 'right' }}>
                          {kwh.toFixed(2)}
                        </div>
                        <button onClick={() => removeAppliance(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.textDim, lineHeight: 1, padding: 0 }}>×</button>
                      </div>
                    );
                  })}

                  {/* Total row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 80px 70px 32px', gap: 8, padding: '12px 16px', background: C.blueDim }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.blueText }}>Total</span>
                    <span />
                    <span />
                    <span />
                    <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C.blue, textAlign: 'right' }}>{applianceKwh.toFixed(2)}</span>
                    <span />
                  </div>
                </Card>

                {/* Add appliance row */}
                <div style={{ marginBottom: 14 }}>
                  <button
                    onClick={() => addAppliance()}
                    style={{ padding: '9px 18px', border: `1.5px dashed ${C.border}`, borderRadius: 9, background: 'transparent', cursor: 'pointer', fontSize: 13, color: C.textMid, fontFamily: FONT, marginRight: 10 }}
                  >
                    + Add custom appliance
                  </button>
                </div>

                {/* Preset appliance grid */}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>Or add a preset:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {APPLIANCE_PRESETS.map(p => (
                      <button
                        key={p.name}
                        className="preset-btn"
                        onClick={() => addAppliance(p)}
                        style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, cursor: 'pointer', fontSize: 12, color: C.text, fontFamily: FONT, transition: 'all 0.15s' }}
                      >
                        {p.icon} {p.name} <span style={{ color: C.textDim }}>({p.watt}W)</span>
                      </button>
                    ))}
                  </div>
                </div>

                {applianceKwh > 0 && (
                  <div style={{ marginTop: 14, padding: '10px 14px', background: C.greenDim, borderRadius: 8, fontSize: 13, color: C.green }}>
                    ✓ Total: <strong>{applianceKwh.toFixed(2)} kWh/day</strong> · Peak load: ~{appliancePeakKw.toFixed(1)} kW · {appliances.length} appliance{appliances.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ STEP 1: BACKUP HOURS ════ */}
        {step === 1 && (
          <div className="fade-up">
            <h2 style={{ fontSize: 24, fontFamily: SERIF, fontStyle: 'italic', color: C.navy, marginBottom: 6 }}>
              How many hours of backup do you need?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, marginBottom: 28 }}>
              This is how long the system should keep running at peak load when no power is available from the grid or generator.
            </p>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[2, 4, 6, 8, 12, 24].map(h => (
                  <label key={h} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${backupHours === h ? C.blue : C.border}`, background: backupHours === h ? C.blueDim : C.white, transition: 'all 0.15s' }}>
                    <input type="radio" name="backup" value={h} checked={backupHours === h} onChange={() => setBackupHours(h)} style={{ accentColor: C.blue, width: 18, height: 18 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{h} hour{h > 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 12, color: C.textMid }}>
                        {h <= 2 && 'Minimal — short outages only'}
                        {h > 2 && h <= 6 && 'Moderate — typical evening/overnight'}
                        {h > 6 && h <= 12 && 'Extended — full business or school day'}
                        {h > 12 && 'Full autonomy — off-grid or very unreliable supply'}
                      </div>
                    </div>
                  </label>
                ))}
                <div style={{ marginTop: 4 }}>
                  <label style={{ fontSize: 13, color: C.textMid, display: 'block', marginBottom: 8 }}>Or enter a custom value:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="number" min={0} max={72} step={0.5}
                      value={backupHours}
                      onChange={e => setBackupHours(parseFloat(e.target.value) || 0)}
                      style={{ width: 100, padding: '10px 14px', fontSize: 16, fontFamily: MONO, border: `1.5px solid ${C.border}`, borderRadius: 9, outline: 'none', color: C.text }}
                    />
                    <span style={{ fontSize: 14, color: C.textMid }}>hours</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ════ STEP 2: GRID AVAILABILITY ════ */}
        {step === 2 && (
          <div className="fade-up">
            <h2 style={{ fontSize: 24, fontFamily: SERIF, fontStyle: 'italic', color: C.navy, marginBottom: 6 }}>
              How many hours of grid power per day?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, marginBottom: 28 }}>
              If you have partial grid access, the battery only needs to cover the off-grid window. Enter 0 if completely off-grid.
            </p>
            <Card>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                {[0, 4, 8, 12, 16, 20].map(h => (
                  <button
                    key={h}
                    onClick={() => setGridHours(h)}
                    style={{
                      padding: '10px 18px', borderRadius: 10, fontFamily: FONT, fontSize: 14, fontWeight: 600,
                      border: `1.5px solid ${gridHours === h ? C.blue : C.border}`,
                      background: gridHours === h ? C.blueDim : C.white,
                      color: gridHours === h ? C.blueText : C.text, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {h === 0 ? 'None (off-grid)' : `${h} hrs/day`}
                  </button>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 13, color: C.textMid, display: 'block', marginBottom: 8 }}>
                  Custom — grid available for:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range" min={0} max={24} step={1}
                    value={gridHours}
                    onChange={e => setGridHours(parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: C.blue }}
                  />
                  <span style={{ fontSize: 16, fontFamily: MONO, fontWeight: 600, color: C.blue, minWidth: 80, textAlign: 'right' }}>
                    {gridHours} hr{gridHours !== 1 ? 's' : ''}/day
                  </span>
                </div>
                {gridHours > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: C.amberDim, borderRadius: 8, fontSize: 12, color: C.amber }}>
                    Battery will cover the {24 - gridHours} off-grid hour{24 - gridHours !== 1 ? 's' : ''} per day ({Math.round((daily_kwh * (24 - gridHours) / 24) * 10) / 10} kWh) plus {backupHours}h backup buffer.
                  </div>
                )}
                {gridHours === 0 && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: C.redDim, borderRadius: 8, fontSize: 12, color: C.red }}>
                    Fully off-grid — battery must cover all {daily_kwh.toFixed(1)} kWh/day plus {backupHours}h backup buffer.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ════ STEP 3: SOLAR ════ */}
        {step === 3 && (
          <div className="fade-up">
            <h2 style={{ fontSize: 24, fontFamily: SERIF, fontStyle: 'italic', color: C.navy, marginBottom: 6 }}>
              Do you want solar panels included?
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, marginBottom: 28 }}>
              Solar reduces reliance on the grid or generator and charges your battery during the day.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div
                className={`method-card ${solarSupport ? 'selected' : ''}`}
                onClick={() => setSolarSupport(true)}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>☀️</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 6 }}>Yes, include solar</div>
                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
                  Solar panels will be sized to cover your full daily demand. Recommended for off-grid or unreliable grid areas.
                </div>
              </div>
              <div
                className={`method-card ${!solarSupport ? 'selected' : ''}`}
                onClick={() => setSolarSupport(false)}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>🔋</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 6 }}>Battery only</div>
                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
                  Size the battery and inverter without solar. Suitable when grid or generator charging is sufficient.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20, padding: '14px 18px', background: C.cyanDim, borderRadius: 10, fontSize: 13, color: C.cyanDark, lineHeight: 1.6 }}>
              💡 This is a quick estimate — no solar resource or cost parameters are needed here. Use the full 8,760-hour simulation for detailed PV modelling and financial analysis.
            </div>
          </div>
        )}

        {/* ════ STEP 4: RESULT ════ */}
        {step === 4 && result && (
          <div className="fade-up">
            <h2 style={{ fontSize: 24, fontFamily: SERIF, fontStyle: 'italic', color: C.navy, marginBottom: 6 }}>
              Your system estimate
            </h2>
            <p style={{ color: C.textMid, fontSize: 14, marginBottom: 24 }}>
              Based on {result.daily_kwh.toFixed(1)} kWh/day · {backupHours}h backup · {gridHours === 0 ? 'off-grid' : `${gridHours}h grid/day`} · {solarSupport ? 'with solar' : 'battery only'}
            </p>

            {/* Key results */}
            <div style={{ display: 'grid', gridTemplateColumns: solarSupport ? 'repeat(3, 1fr)' : '1fr 1fr', gap: 14, marginBottom: 24 }}>
              {solarSupport && (
                <ResultPill label="Solar PV" value={result.pv_kw.toFixed(1)} unit="kWp" color={C.amber} />
              )}
              <ResultPill label="Battery storage" value={result.battery_kwh} unit="kWh (nameplate)" color={C.blue} />
              <ResultPill label="Inverter" value={result.inverter_kva.toFixed(1)} unit="kVA" color={C.cyan} />
            </div>

            {/* Breakdown */}
            <Card style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>How the sizing was calculated</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMid }}>Daily energy demand</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600 }}>{result.daily_kwh.toFixed(1)} kWh/day</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMid }}>Estimated peak load</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600 }}>{result.peak_kw.toFixed(1)} kW</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMid }}>Off-grid window</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600 }}>{24 - gridHours} hrs/day</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMid }}>Backup buffer</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600 }}>{backupHours} hrs @ peak</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMid }}>Usable battery capacity (85% DoD)</span>
                  <span style={{ fontFamily: MONO, fontWeight: 600 }}>{result.usable_kwh} kWh</span>
                </div>
                {solarSupport && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ color: C.textMid }}>PV sizing assumption</span>
                    <span style={{ fontFamily: MONO, fontWeight: 600 }}>4.5 PSH · 80% system efficiency</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Disclaimer */}
            <div style={{ padding: '12px 16px', background: C.amberDim, borderRadius: 10, fontSize: 12, color: C.amber, lineHeight: 1.6, marginBottom: 24 }}>
              ⚠ This is a rough estimate (±25–35% accuracy). It does not account for site-specific solar data, temperature effects, or exact load profiles. Run the full 8,760-hour simulation for a bankable pre-feasibility result.
            </div>

            {/* Push to simulation CTA */}
            <div style={{ background: C.navy, borderRadius: 14, padding: '24px', color: '#fff' }}>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: SERIF, fontStyle: 'italic', marginBottom: 8 }}>Ready for detailed analysis?</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 20, lineHeight: 1.6 }}>
                These sizes will pre-fill the full 8,760-hour simulation wizard for detailed dispatch modelling, financial analysis, and PDF report generation.
              </div>
              <button
                onClick={handlePush}
                style={{ width: '100%', padding: '14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: FONT, transition: 'background 0.2s' }}
                onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.22)'}
                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.12)'}
              >
                Push to Full Simulation →
              </button>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        {step < 4 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
            <button
              className="nav-btn"
              onClick={() => step === 0 ? onBack() : setStep(s => s - 1)}
              style={{ background: C.white, border: `1px solid ${C.border}`, color: C.textMid }}
            >
              {step === 0 ? 'Cancel' : '← Back'}
            </button>
            <button
              className="nav-btn"
              onClick={() => setStep(s => Math.min(s + 1, 4))}
              disabled={!canNext()}
              style={{
                background: canNext() ? C.blue : C.border,
                border: 'none',
                color: canNext() ? '#fff' : C.textDim,
                cursor: canNext() ? 'pointer' : 'not-allowed',
              }}
            >
              {step === 3 ? 'Get estimate →' : 'Next →'}
            </button>
          </div>
        )}

        {/* Restart on result */}
        {step === 4 && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={() => { setStep(0); setEnergyMethod(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.textMid, textDecoration: 'underline' }}>
              Start over with different inputs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
