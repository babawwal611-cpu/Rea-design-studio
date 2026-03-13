import React, { useState, useCallback } from 'react';
import { NIGERIA_CITIES_SOLAR, NIGERIA_DEFAULTS } from '../utils/simulateSystem';

/* ─── Design Tokens ───────────────────────────────────────────────────────── */
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
  green:     '#059669',
  greenDim:  '#D1FAE5',
  text:      '#1A2B3C',
  textMid:   '#4A6580',
  textDim:   '#94A3B8',
  white:     '#FFFFFF',
};

const FONT = "'DM Sans', sans-serif";
const SERIF = "'Playfair Display', serif";
const MONO = "'IBM Plex Mono', monospace";

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (n, dec = 0) =>
  typeof n === 'number' && isFinite(n)
    ? n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : '—';

const fmtN = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : fmt(n);

/* ─── Sub-components ──────────────────────────────────────────────────────── */
const Label = ({ children, hint }) => (
  <div style={{ marginBottom: 6 }}>
    <span style={{ fontSize: 10, fontWeight: 600, color: C.textMid, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: FONT }}>{children}</span>
    {hint && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 8, fontFamily: FONT }}>{hint}</span>}
  </div>
);

const Input = ({ value, onChange, min, max, step, unit, style = {} }) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
    <input
      type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
      min={min} max={max} step={step}
      style={{
        width: '100%', padding: '10px 14px', paddingRight: unit ? 52 : 14,
        background: '#F8FAFC', border: `1px solid ${C.border}`, borderRadius: 8,
        color: C.text, fontSize: 13, fontFamily: MONO, outline: 'none',
        transition: 'border 0.2s, box-shadow 0.2s', ...style,
      }}
      onFocus={e => { e.target.style.borderColor = C.cyan; e.target.style.boxShadow = `0 0 0 3px ${C.cyan}18`; e.target.style.background = '#fff'; }}
      onBlur={e  => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; e.target.style.background = '#F8FAFC'; }}
    />
    {unit && <span style={{ position: 'absolute', right: 12, fontSize: 10, color: C.textDim, fontFamily: FONT, pointerEvents: 'none' }}>{unit}</span>}
  </div>
);

const Card = ({ children, style = {}, accent }) => (
  <div style={{
    background: C.panel, border: `1px solid ${accent ? accent + '40' : C.border}`,
    borderRadius: 14, padding: '20px',
    boxShadow: accent ? `0 4px 16px ${accent}12` : '0 1px 4px rgba(0,0,0,0.05)',
    borderTop: accent ? `3px solid ${accent}` : undefined,
    ...style,
  }}>
    {children}
  </div>
);

const ResultRow = ({ label, value, unit, color, hint, formula }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '12px 0', borderBottom: `1px solid ${C.border}`,
  }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: FONT }}>{label}</div>
      {hint && <div style={{ fontSize: 10, color: C.textDim, marginTop: 2, fontFamily: FONT }}>{hint}</div>}
      {formula && (
        <div style={{
          fontSize: 9, color: C.textMid, marginTop: 4,
          fontFamily: MONO, background: C.bg, padding: '2px 6px', borderRadius: 4, display: 'inline-block',
        }}>{formula}</div>
      )}
    </div>
    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || C.cyan, fontFamily: MONO }}>
        {fmt(value, value < 10 ? 1 : 0)}
      </div>
      <div style={{ fontSize: 10, color: C.textDim, fontFamily: FONT }}>{unit}</div>
    </div>
  </div>
);

const CostRow = ({ label, value, pct }) => (
  <div style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: C.text, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.cyan, fontFamily: MONO }}>₦{fmtN(value)}</span>
    </div>
    <div style={{ height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.cyanDark}, ${C.cyan})`, borderRadius: 3, transition: 'width 0.5s' }} />
    </div>
  </div>
);

/* ─── Core sizing formulas (MIRIDA spec §14–16) ───────────────────────────── */
function calcSizing(inputs) {
  const {
    daily_kwh, peak_kw, autonomy_days, psh, system_eta,
    pv_tilt_factor, derating, battery_dod, inverter_safety,
    pv_cost_kw, battery_cost_kwh, gen_cost_kw, inverter_cost_kw,
    gen_capacity_kw, include_gen, bos_pct, install_pct, panel_rating_w,
  } = inputs;

  /* ── PV Sizing (spec §14) ── */
  // PV_capacity = Daily_energy / (PSH × system_efficiency × derating × tilt_factor)
  const effective_psh = psh * pv_tilt_factor;
  const pv_kw = daily_kwh / (effective_psh * system_eta * derating);

  /* ── Battery Sizing (spec §15) ── */
  // Battery_size = (Load × Autonomy) / DoD
  const battery_raw_kwh = daily_kwh * autonomy_days;
  const battery_kwh = battery_raw_kwh / battery_dod;
  const usable_kwh = battery_kwh * battery_dod;

  /* ── Inverter Sizing (spec §16) ── */
  // Inverter_size = Peak_load × safety_factor
  const inverter_kva = peak_kw * inverter_safety;

  /* ── Physical quantities ── */
  const panel_kw = panel_rating_w / 1000;
  const panel_count = Math.ceil(pv_kw / panel_kw);
  // Land area: 1 kWp ≈ 8–10 m² for ground-mount at 15° tilt
  const land_m2 = Math.round(pv_kw * 9.0);

  /* ── Cost estimate ── */
  const pv_cost     = pv_kw        * pv_cost_kw;
  const batt_cost   = battery_kwh  * battery_cost_kwh;
  const inv_cost    = inverter_kva  * inverter_cost_kw;
  const gen_cost_   = include_gen ? gen_capacity_kw * gen_cost_kw : 0;
  const hardware    = pv_cost + batt_cost + inv_cost + gen_cost_;
  const bos         = hardware * bos_pct;
  const install     = (hardware + bos) * install_pct;
  const total_capex = hardware + bos + install;

  /* ── Estimated LCOE (simplified, 20yr, 12% discount) ── */
  const r = 0.12, n = 20;
  const annuity = r / (1 - Math.pow(1 + r, -n));
  const annual_capex_charge = total_capex * annuity;
  const annual_om = total_capex * 0.015;
  const annual_fuel = include_gen ? (gen_capacity_kw * 0.3 * 365 * 0.35 * 1200) : 0;
  const annual_kwh_served = daily_kwh * 365 * 0.95;
  const lcoe = (annual_capex_charge + annual_om + annual_fuel) / annual_kwh_served;

  return {
    pv_kw, battery_kwh, usable_kwh, inverter_kva,
    panel_count, land_m2,
    costs: { pv: pv_cost, battery: batt_cost, inverter: inv_cost, generator: gen_cost_, bos, install, total: total_capex },
    lcoe,
    effective_psh,
  };
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function PredictiveSizing({ onBack, onPushToSimulation }) {
  /* ── Inputs ── */
  const [inputs, setInputs] = useState({
    daily_kwh:        120,
    peak_kw:          25,
    autonomy_days:    1.5,
    psh:              5.5,
    system_eta:       0.85,
    pv_tilt_factor:   1.0,
    derating:         0.85,
    battery_dod:      0.85,
    inverter_safety:  1.25,
    panel_rating_w:   450,
    include_gen:      true,
    gen_capacity_kw:  20,
    // Costs
    pv_cost_kw:        400000,
    battery_cost_kwh: 1000000,
    gen_cost_kw:       320000,
    inverter_cost_kw:  200000,
    bos_pct:           0.17,
    install_pct:       0.12,
  });

  const [cityIdx, setCityIdx] = useState(null);
  const set = (k, v) => setInputs(p => ({ ...p, [k]: v }));

  const result = calcSizing(inputs);

  /* ── Load template quick-select ── */
  const applyTemplate = useCallback((t) => {
    set('daily_kwh', t.daily_kwh);
    set('peak_kw', Math.max(2, t.daily_kwh / 8));
  }, []);

  /* ── City PSH quick-select ── */
  const applyCity = useCallback((city, i) => {
    set('psh', city.avg_ghi);
    setCityIdx(i);
  }, []);

  /* ── Push to simulation ── */
  const handlePushToSim = () => {
    if (onPushToSimulation) {
      onPushToSimulation({
        pv_capacity_kw:       Math.round(result.pv_kw * 10) / 10,
        battery_capacity_kwh: Math.round(result.battery_kwh),
        inverter_capacity_kw: Math.round(result.inverter_kva),
        gen_capacity_kw:      inputs.include_gen ? inputs.gen_capacity_kw : 0,
        gen_enabled:          inputs.include_gen,
        daily_kwh:            inputs.daily_kwh,
      });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,500&family=IBM+Plex+Mono:wght@400;600&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        .sizing-fade { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${C.border}`, height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 11, color: C.textMid, display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>←</span> Back to Studio
          </button>
          <div style={{ width: 1, height: 18, background: C.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: `linear-gradient(135deg, ${C.cyanDark}, ${C.cyan})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
            }}>⚡</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: SERIF, fontStyle: 'italic', color: C.text }}>MIRIDA</div>
              <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>Predictive Sizing Module</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            padding: '6px 14px', background: C.greenDim, borderRadius: 8,
            fontSize: 11, fontWeight: 600, color: C.green, fontFamily: MONO,
          }}>
            LCOE: ₦{fmt(result.lcoe, 0)}/kWh
          </div>
          <button onClick={handlePushToSim} style={{
            padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.cyanDark}, ${C.cyan})`,
            color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: FONT,
            boxShadow: `0 2px 8px ${C.cyan}40`, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ▶ Push to Full Simulation
          </button>
        </div>
      </div>

      {/* ── Hero header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.cyanDark} 0%, ${C.cyan} 50%, ${C.blueBright} 100%)`,
        padding: '32px 40px', color: '#fff',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: MONO, marginBottom: 8 }}>
            MIRIDA Spec §13–16 · Quick Engineering Estimate
          </div>
          <h1 style={{ fontSize: 28, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, margin: 0, marginBottom: 8 }}>
            Predictive System Sizing
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0, maxWidth: 600, lineHeight: 1.7 }}>
            Enter load demand and site parameters to instantly calculate required PV capacity, battery storage, inverter rating, and estimated CapEx. Results pre-fill the full simulation wizard.
          </p>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 28px 60px', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24, alignItems: 'start' }}>

        {/* ════ LEFT: INPUTS ════ */}
        <div className="sizing-fade" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Load demand */}
          <Card accent={C.cyan}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚡</span> Load Demand
            </div>

            <div style={{ marginBottom: 14 }}>
              <Label hint="quick-select">Community Type</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {NIGERIA_DEFAULTS.load_templates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)} style={{
                    padding: '10px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    background: inputs.daily_kwh === t.daily_kwh ? C.cyanDim : C.bg,
                    border: `1px solid ${inputs.daily_kwh === t.daily_kwh ? C.cyan : C.border}`,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 16 }}>{t.icon}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: inputs.daily_kwh === t.daily_kwh ? C.cyan : C.text, marginTop: 3, lineHeight: 1.3, fontFamily: FONT }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: C.textDim, fontFamily: MONO, marginTop: 2 }}>{t.daily_kwh} kWh/d</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <Label hint="annual average">Daily Energy Demand</Label>
                <Input value={inputs.daily_kwh} onChange={v => set('daily_kwh', v)} min={1} max={10000} step={1} unit="kWh/day" />
              </div>
              <div>
                <Label hint="concurrent maximum">Peak Load</Label>
                <Input value={inputs.peak_kw} onChange={v => set('peak_kw', v)} min={0.1} max={5000} step={0.1} unit="kW" />
              </div>
              <div>
                <Label hint="days battery must cover alone">Battery Autonomy</Label>
                <Input value={inputs.autonomy_days} onChange={v => set('autonomy_days', v)} min={0.5} max={7} step={0.5} unit="days" />
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, fontFamily: FONT }}>Typical: 1–2 days for hybrid, 3+ for off-grid</div>
              </div>
              <div>
                <Label hint="inverter safety factor">Inverter Safety Factor</Label>
                <Input value={inputs.inverter_safety} onChange={v => set('inverter_safety', v)} min={1.0} max={1.5} step={0.05} unit="×" />
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, fontFamily: FONT }}>Spec recommends 1.2–1.3 ×</div>
              </div>
            </div>
          </Card>

          {/* Solar resource */}
          <Card accent={C.gold}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>☀️</span> Solar Resource
            </div>

            <div style={{ marginBottom: 14 }}>
              <Label hint="quick-select">Nigerian City</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {NIGERIA_CITIES_SOLAR.map((city, i) => (
                  <button key={i} onClick={() => applyCity(city, i)} style={{
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    background: cityIdx === i ? C.goldDim : 'transparent',
                    border: `1px solid ${cityIdx === i ? C.gold : C.border}`,
                    color: cityIdx === i ? C.gold : C.textMid,
                    fontSize: 11, fontFamily: FONT, transition: 'all 0.15s',
                  }}>{city.name}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <Label hint="kWh/m²/day">Peak Sun Hours (PSH)</Label>
                <Input value={inputs.psh} onChange={v => set('psh', v)} min={1} max={9} step={0.01} unit="h/day" />
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, fontFamily: FONT }}>Nigeria: 4.2 (South) — 6.4 (North)</div>
              </div>
              <div>
                <Label hint="soiling, wiring, mismatch">Derating Factor</Label>
                <Input value={inputs.derating} onChange={v => set('derating', v)} min={0.5} max={1.0} step={0.01} unit="" />
              </div>
              <div>
                <Label hint="tilt angle correction">Tilt Factor</Label>
                <Input value={inputs.pv_tilt_factor} onChange={v => set('pv_tilt_factor', v)} min={0.9} max={1.15} step={0.01} unit="×" />
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 4, fontFamily: FONT }}>Optimal tilt ≈ latitude °</div>
              </div>
            </div>
          </Card>

          {/* System parameters */}
          <Card accent={C.blue}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>⚙️</span> System Parameters
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <Label>Overall System η</Label>
                <Input value={inputs.system_eta} onChange={v => set('system_eta', v)} min={0.5} max={1.0} step={0.01} unit="" />
              </div>
              <div>
                <Label>Battery DoD</Label>
                <Input value={inputs.battery_dod} onChange={v => set('battery_dod', v)} min={0.3} max={1.0} step={0.01} unit="" />
              </div>
              <div>
                <Label>PV Panel Rating</Label>
                <Input value={inputs.panel_rating_w} onChange={v => set('panel_rating_w', v)} min={100} max={700} step={5} unit="Wp" />
              </div>
            </div>

            {/* Generator toggle */}
            <div style={{ marginTop: 16, padding: '14px', background: C.bg, borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: inputs.include_gen ? 12 : 0 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Include Backup Generator</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Adds diesel generator to CapEx estimate</div>
                </div>
                <button onClick={() => set('include_gen', !inputs.include_gen)} style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: inputs.include_gen ? C.cyan : C.border,
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 3, left: inputs.include_gen ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
              {inputs.include_gen && (
                <div style={{ maxWidth: 200 }}>
                  <Label>Generator Capacity</Label>
                  <Input value={inputs.gen_capacity_kw} onChange={v => set('gen_capacity_kw', v)} min={1} max={2000} step={1} unit="kW" />
                </div>
              )}
            </div>
          </Card>

          {/* Nigerian cost defaults */}
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>₦</span> Cost Assumptions (Nigerian Market 2024/25)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <Label>PV Cost</Label>
                <Input value={inputs.pv_cost_kw} onChange={v => set('pv_cost_kw', v)} min={100000} max={2000000} step={10000} unit="₦/kWp" />
              </div>
              <div>
                <Label>Battery Cost</Label>
                <Input value={inputs.battery_cost_kwh} onChange={v => set('battery_cost_kwh', v)} min={100000} max={3000000} step={10000} unit="₦/kWh" />
              </div>
              <div>
                <Label>Inverter Cost</Label>
                <Input value={inputs.inverter_cost_kw} onChange={v => set('inverter_cost_kw', v)} min={50000} max={1000000} step={10000} unit="₦/kVA" />
              </div>
              <div>
                <Label>Generator Cost</Label>
                <Input value={inputs.gen_cost_kw} onChange={v => set('gen_cost_kw', v)} min={100000} max={1000000} step={10000} unit="₦/kW" />
              </div>
              <div>
                <Label>BOS %</Label>
                <Input value={inputs.bos_pct} onChange={v => set('bos_pct', v)} min={0.05} max={0.40} step={0.01} unit="%" />
              </div>
              <div>
                <Label>Installation %</Label>
                <Input value={inputs.install_pct} onChange={v => set('install_pct', v)} min={0.05} max={0.30} step={0.01} unit="%" />
              </div>
            </div>
          </Card>
        </div>

        {/* ════ RIGHT: RESULTS ════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 76 }}>

          {/* System sizes */}
          <Card accent={C.cyan} style={{ animation: 'fadeUp 0.3s both' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Required System Sizes
            </div>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 16, fontFamily: MONO }}>
              MIRIDA Spec §14–16 formulas
            </div>

            <ResultRow
              label="PV Array Capacity"
              value={result.pv_kw}
              unit="kWp"
              color={C.gold}
              hint={`${result.panel_count} × ${inputs.panel_rating_w}W panels`}
              formula={`E_daily / (PSH × η × DR × TF) = ${fmt(inputs.daily_kwh,0)} / (${fmt(result.effective_psh,2)} × ${inputs.system_eta} × ${inputs.derating})`}
            />
            <ResultRow
              label="Battery Bank"
              value={result.battery_kwh}
              unit="kWh (nameplate)"
              color={C.green}
              hint={`${fmt(result.usable_kwh, 1)} kWh usable at ${Math.round(inputs.battery_dod * 100)}% DoD`}
              formula={`(E_daily × autonomy) / DoD = (${fmt(inputs.daily_kwh,0)} × ${inputs.autonomy_days}) / ${inputs.battery_dod}`}
            />
            <ResultRow
              label="Inverter / Charger"
              value={result.inverter_kva}
              unit="kVA"
              color={C.cyan}
              hint={`Safety factor ${inputs.inverter_safety}× on ${fmt(inputs.peak_kw,1)} kW peak`}
              formula={`Peak_load × SF = ${fmt(inputs.peak_kw,1)} × ${inputs.inverter_safety}`}
            />
            {inputs.include_gen && (
              <ResultRow
                label="Generator"
                value={inputs.gen_capacity_kw}
                unit="kW"
                color={C.gold}
                hint="User-specified backup capacity"
              />
            )}

            <div style={{ borderBottom: `1px solid ${C.border}` }} />

            <ResultRow
              label="PV Panel Count"
              value={result.panel_count}
              unit={`× ${inputs.panel_rating_w} Wp`}
              color={C.textMid}
            />
            <ResultRow
              label="Estimated Land Area"
              value={result.land_m2}
              unit="m²"
              color={C.textMid}
              hint={`~${fmt(result.land_m2 / 10000, 3)} ha · ${fmt(result.land_m2 / result.pv_kw, 1)} m²/kWp`}
            />
          </Card>

          {/* CapEx breakdown */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              CapEx Estimate
            </div>
            <CostRow label="Solar PV Array"    value={result.costs.pv}        pct={result.costs.pv        / result.costs.total * 100} />
            <CostRow label="Battery Storage"   value={result.costs.battery}   pct={result.costs.battery   / result.costs.total * 100} />
            <CostRow label="Inverter / Control" value={result.costs.inverter}  pct={result.costs.inverter  / result.costs.total * 100} />
            {inputs.include_gen && (
              <CostRow label="Generator"        value={result.costs.generator} pct={result.costs.generator / result.costs.total * 100} />
            )}
            <CostRow label="Balance of System" value={result.costs.bos}       pct={result.costs.bos       / result.costs.total * 100} />
            <CostRow label="Installation"       value={result.costs.install}   pct={result.costs.install   / result.costs.total * 100} />

            <div style={{ marginTop: 14, padding: '12px 14px', background: C.cyanDim, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Total CapEx</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: C.cyan, fontFamily: MONO }}>₦{fmtN(result.costs.total)}</span>
            </div>
          </Card>

          {/* LCOE & indicative metrics */}
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Indicative Metrics
            </div>
            {[
              { label: 'Est. LCOE',         value: `₦${fmt(result.lcoe, 0)}/kWh`, color: result.lcoe < 150 ? C.green : result.lcoe < 250 ? C.gold : C.red },
              { label: 'CapEx / kWp',       value: `₦${fmtN(result.costs.total / result.pv_kw)}`, color: C.textMid },
              { label: 'Effective PSH',     value: `${fmt(result.effective_psh, 2)} h/day`, color: C.textMid },
              { label: 'Storage/Load Ratio', value: `${fmt(result.battery_kwh / inputs.daily_kwh, 2)}×`, color: C.textMid },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, color: C.textMid }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: MONO }}>{value}</span>
              </div>
            ))}
          </Card>

          {/* Push to sim CTA */}
          <div style={{
            background: `linear-gradient(135deg, ${C.cyanDark}, ${C.cyan})`,
            borderRadius: 14, padding: '20px',
            boxShadow: `0 8px 24px ${C.cyan}30`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
              ▶ Ready for detailed simulation?
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 16, lineHeight: 1.6 }}>
              These sizes will pre-fill Step 3 of the full 8,760-hour simulation wizard for detailed analysis.
            </div>
            <button onClick={handlePushToSim} style={{
              width: '100%', padding: '12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: FONT, backdropFilter: 'blur(4px)',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.15)'}
            >
              Push to Full Simulation →
            </button>
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.7, padding: '0 4px' }}>
            ⚠ Sizing estimates use simplified formulas (MIRIDA spec §14–16). Accuracy ±20–30%. Always validate with full 8,760-hour simulation before procurement.
          </div>
        </div>
      </div>
    </div>
  );
}
