import React, { useState, useEffect, useRef, useCallback } from 'react';

const C = {
  bg: '#F4F7FB', surface: '#FFFFFF', border: '#E2EAF2', borderHi: '#C5D5E8',
  cyan: '#0070CC', cyanDim: '#EAF3FC', text: '#1A2B3C',
  textMid: '#4A6580', textDim: '#94A3B8',
  gold: '#D97706', red: '#DC2626', green: '#059669',
};

const FONT = "'DM Sans', sans-serif";
const MONO = "'IBM Plex Mono', monospace";

/* ─── SVG layout constants ───────────────────────────────────────────────── */
const W = 800, H = 420;
const NODES = {
  pv:      { x: 120, y: 100, label: 'PV Array',      icon: '☀️', color: '#F59E0B', bg: '#FEF3C7' },
  inv:     { x: 320, y: 100, label: 'Inverter',       icon: '⚡', color: '#0070CC', bg: '#EAF3FC' },
  batt:    { x: 120, y: 290, label: 'Battery',        icon: '🔋', color: '#059669', bg: '#D1FAE5' },
  gen:     { x: 560, y: 290, label: 'Generator',      icon: '⛽', color: '#D97706', bg: '#FEF3C7' },
  load:    { x: 560, y: 100, label: 'Load',           icon: '🏘️', color: '#7C3AED', bg: '#EDE9FE' },
  bus:     { x: 340, y: 210, label: 'DC Bus',         icon: '⚙️', color: '#4A6580', bg: '#F1F5F9' },
};

/* ─── Flow path definitions ─────────────────────────────────────────────── */
// Each flow: from node center → to node center, with a colour and label
const FLOWS = {
  pv_to_inv:   { from: 'pv',   to: 'inv',  label: 'PV → Inverter',       color: '#F59E0B' },
  inv_to_load: { from: 'inv',  to: 'load', label: 'Inverter → Load',      color: '#0070CC' },
  inv_to_batt: { from: 'inv',  to: 'bus',  label: 'PV → Battery',         color: '#059669' },
  batt_to_bus: { from: 'batt', to: 'bus',  label: 'Battery Discharge',    color: '#059669' },
  bus_to_load: { from: 'bus',  to: 'load', label: 'Battery → Load',       color: '#059669' },
  gen_to_load: { from: 'gen',  to: 'load', label: 'Generator → Load',     color: '#D97706' },
  gen_to_batt: { from: 'gen',  to: 'bus',  label: 'Gen Cycle Charge',     color: '#D97706' },
  curtail:     { from: 'inv',  to: 'batt', label: 'Curtailment',          color: '#DC2626' },
};

/* Compute midpoint + bezier control points for a flow path */
function flowPath(fromKey, toKey) {
  const f = NODES[fromKey], t = NODES[toKey];
  const dx = t.x - f.x, dy = t.y - f.y;
  // Slight curve
  const cx = (f.x + t.x) / 2 - dy * 0.15;
  const cy = (f.y + t.y) / 2 + dx * 0.15;
  return `M ${f.x} ${f.y} Q ${cx} ${cy} ${t.x} ${t.y}`;
}

/* Lerp along a quadratic bezier */
function bezierPoint(from, to, t) {
  const f = NODES[from], n = NODES[to];
  const dx = n.x - f.x, dy = n.y - f.y;
  const cx = (f.x + n.x) / 2 - dy * 0.15;
  const cy = (f.y + n.y) / 2 + dx * 0.15;
  const x = (1-t)*(1-t)*f.x + 2*(1-t)*t*cx + t*t*n.x;
  const y = (1-t)*(1-t)*f.y + 2*(1-t)*t*cy + t*t*n.y;
  return { x, y };
}

/* ─── Animated particle on a path ────────────────────────────────────────── */
function Particle({ from, to, color, speed = 0.008, offset = 0 }) {
  const [t, setT] = useState(offset % 1);
  const rafRef = useRef();

  useEffect(() => {
    let tVal = offset % 1;
    const tick = () => {
      tVal = (tVal + speed) % 1;
      setT(tVal);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed, offset]);

  const pos = bezierPoint(from, to, t);
  return (
    <circle cx={pos.x} cy={pos.y} r={4} fill={color}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
  );
}

/* ─── Flow arrow path ────────────────────────────────────────────────────── */
function FlowArrow({ from, to, color, power, maxPower, active }) {
  if (!active || power <= 0) return null;
  const thickness = Math.max(1.5, Math.min(6, (power / maxPower) * 6));
  const nParticles = Math.max(1, Math.round((power / maxPower) * 3));

  return (
    <g>
      <path d={flowPath(from, to)} fill="none" stroke={color}
        strokeWidth={thickness} strokeOpacity={0.3}
        strokeDasharray="6 4" />
      {Array.from({ length: nParticles }).map((_, i) => (
        <Particle key={i} from={from} to={to} color={color}
          speed={0.006 + (power / maxPower) * 0.006}
          offset={i / nParticles} />
      ))}
    </g>
  );
}

/* ─── Node box ───────────────────────────────────────────────────────────── */
function NodeBox({ id, power, unit = 'kW', highlight }) {
  const n = NODES[id];
  const isActive = power > 0;
  return (
    <g>
      <rect x={n.x - 50} y={n.y - 34} width={100} height={68} rx={12}
        fill={isActive ? n.bg : '#F8FAFC'}
        stroke={isActive ? n.color : '#E2EAF2'}
        strokeWidth={isActive ? 1.5 : 1}
        style={{ filter: isActive ? `drop-shadow(0 2px 8px ${n.color}30)` : 'none', transition: 'all 0.4s' }}
      />
      <text x={n.x} y={n.y - 16} textAnchor="middle" fontSize={18}>{n.icon}</text>
      <text x={n.x} y={n.y + 2} textAnchor="middle" fontSize={10}
        fill={isActive ? n.color : '#94A3B8'} fontFamily={FONT} fontWeight={600}>
        {n.label}
      </text>
      <text x={n.x} y={n.y + 18} textAnchor="middle" fontSize={11}
        fill={isActive ? '#1A2B3C' : '#CBD5E1'} fontFamily={MONO} fontWeight={700}>
        {power > 0 ? `${power.toFixed(1)} ${unit}` : '—'}
      </text>
    </g>
  );
}

/* ─── Main EnergyFlow component ─────────────────────────────────────────── */
export default function EnergyFlowSimulator({ sim, system }) {
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playRef = useRef();

  const maxHour = (sim?.hourly?.load?.length || 8760) - 1;

  /* Playback ticker */
  useEffect(() => {
    if (!playing) { clearInterval(playRef.current); return; }
    playRef.current = setInterval(() => {
      setHour(h => {
        if (h >= maxHour) { setPlaying(false); return maxHour; }
        return h + 1;
      });
    }, Math.round(500 / speed));
    return () => clearInterval(playRef.current);
  }, [playing, speed, maxHour]);

  if (!sim) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.textDim, fontFamily: FONT }}>
      Run a simulation first to enable the energy flow visualiser.
    </div>
  );

  const h = sim.hourly;
  const pvOut    = (h.pv_output[hour]          || 0);
  const load_    = (h.load?.[hour]             || 0);
  const battDis  = (h.battery_discharge[hour]  || 0);
  const battCh   = (h.battery_charge[hour]     || 0);
  const genOut   = (h.gen_output[hour]         || 0);
  const excess   = (h.excess_energy[hour]      || 0);
  const soc      = (h.battery_soc[hour]        || 0);
  const socPct   = system.battery_capacity_kwh > 0
    ? Math.min(100, (soc / system.battery_capacity_kwh) * 100) : 0;

  const maxPow = Math.max(pvOut, load_, genOut, battCh, battDis, 1);

  /* Date / time label from hour index */
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
  let rem = hour, month = 0;
  while (month < 11 && rem >= DAYS[month] * 24) { rem -= DAYS[month] * 24; month++; }
  const day = Math.floor(rem / 24) + 1;
  const timeHr = rem % 24;
  const timeLabel = `${MONTHS[month]} ${day}, ${String(timeHr).padStart(2,'0')}:00`;
  const isNight = timeHr < 6 || timeHr >= 19;

  /* SOC bar color */
  const socColor = socPct > 60 ? C.green : socPct > 30 ? C.gold : C.red;

  return (
    <div style={{ fontFamily: FONT }}>
      {/* ── Title bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Visual Energy Flow Simulator</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
            Animated power flow through the hybrid system — hour by hour
          </div>
        </div>
        <div style={{
          padding: '6px 14px', background: C.cyanDim, borderRadius: 8,
          fontSize: 12, fontWeight: 600, color: C.cyan, fontFamily: MONO,
        }}>
          {timeLabel}  ·  Hour {hour + 1} of 8,760
        </div>
      </div>

      {/* ── SVG Flow Diagram ── */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,112,204,0.06)',
      }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          <defs>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor={isNight ? '#0F172A' : '#F4F7FB'} />
              <stop offset="100%" stopColor={isNight ? '#0A0F1A' : '#EAF3FC'} />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#bgGrad)" />

          {/* Grid lines */}
          {[100, 210, 320].map(y2 => (
            <line key={y2} x1={60} y1={y2} x2={740} y2={y2}
              stroke={isNight ? '#1E3A5F' : '#E2EAF2'} strokeWidth={1} strokeDasharray="4 6" />
          ))}

          {/* ── Flow arrows ── */}
          <FlowArrow from="pv" to="inv" color="#F59E0B" power={pvOut - battCh} maxPower={maxPow} active={pvOut > 0.1} />
          <FlowArrow from="inv" to="load" color="#0070CC" power={Math.max(0, pvOut - battCh)} maxPower={maxPow} active={pvOut > battCh && pvOut > 0.1} />
          <FlowArrow from="inv" to="bus" color="#059669" power={battCh} maxPower={maxPow} active={battCh > 0.1} />
          <FlowArrow from="batt" to="bus" color="#059669" power={battDis} maxPower={maxPow} active={battDis > 0.1} />
          <FlowArrow from="bus" to="load" color="#059669" power={battDis} maxPower={maxPow} active={battDis > 0.1} />
          <FlowArrow from="gen" to="load" color="#D97706" power={genOut} maxPower={maxPow} active={genOut > 0.1} />

          {/* ── Nodes ── */}
          <NodeBox id="pv"   power={pvOut}   />
          <NodeBox id="inv"  power={pvOut}   />
          <NodeBox id="batt" power={soc}   unit="kWh" />
          <NodeBox id="bus"  power={battDis + battCh} />
          <NodeBox id="gen"  power={genOut}  />
          <NodeBox id="load" power={load_}   />

          {/* ── Battery SOC bar ── */}
          <g>
            <rect x={40} y={260} width={16} height={100} rx={8}
              fill={isNight ? '#1E3A5F' : '#E2EAF2'} />
            <rect x={40} y={260 + 100 * (1 - socPct/100)} width={16} height={100 * socPct/100} rx={8}
              fill={socColor} style={{ transition: 'all 0.3s', filter: `drop-shadow(0 0 4px ${socColor}80)` }} />
            <text x={48} y={250} textAnchor="middle" fontSize={9} fill={C.textDim} fontFamily={FONT}>SOC</text>
            <text x={48} y={372} textAnchor="middle" fontSize={9} fill={socColor} fontFamily={MONO} fontWeight={700}>
              {Math.round(socPct)}%
            </text>
          </g>

          {/* ── Excess / curtailment indicator ── */}
          {excess > 0.1 && (
            <g>
              <text x={400} y={380} textAnchor="middle" fontSize={11} fill={C.red} fontFamily={FONT}>
                ⚠ Curtailment: {excess.toFixed(1)} kW
              </text>
            </g>
          )}

          {/* ── Night overlay label ── */}
          {isNight && pvOut < 0.1 && (
            <text x={120} y={140} textAnchor="middle" fontSize={10} fill="#94A3B8" fontFamily={FONT}>
              Night — no PV
            </text>
          )}

          {/* ── Legend ── */}
          <g transform={`translate(600, 360)`}>
            {[
              { color: '#F59E0B', label: 'PV' },
              { color: '#059669', label: 'Battery' },
              { color: '#D97706', label: 'Generator' },
              { color: '#0070CC', label: 'Load' },
            ].map(({ color, label }, i) => (
              <g key={label} transform={`translate(${i * 48}, 0)`}>
                <circle cx={6} cy={6} r={5} fill={color} />
                <text x={14} y={10} fontSize={9} fill={isNight ? '#94A3B8' : C.textDim} fontFamily={FONT}>{label}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* ── KPI row for this hour ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginTop: 14 }}>
        {[
          { label: 'PV Output',   value: `${pvOut.toFixed(1)} kW`,  color: '#F59E0B' },
          { label: 'Load Demand', value: `${load_.toFixed(1)} kW`,  color: C.cyan    },
          { label: 'Batt. SOC',   value: `${Math.round(socPct)}%`,  color: socColor  },
          { label: 'Generator',   value: `${genOut.toFixed(1)} kW`, color: C.gold    },
          { label: 'Batt. Flow',  value: battCh > 0 ? `+${battCh.toFixed(1)} kW` : battDis > 0 ? `-${battDis.toFixed(1)} kW` : '0 kW', color: C.green },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, padding: '10px 12px',
            borderTop: `3px solid ${color}`,
          }}>
            <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: MONO }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Playback controls ── */}
      <div style={{
        marginTop: 16, background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        {/* Play/Pause */}
        <button onClick={() => setPlaying(p => !p)} style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.cyan}, #3B9EFF)`,
          color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 12px ${C.cyan}40`, flexShrink: 0,
        }}>
          {playing ? '⏸' : '▶'}
        </button>

        {/* Scrubber */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <input type="range" min={0} max={maxHour} value={hour}
            onChange={e => { setPlaying(false); setHour(Number(e.target.value)); }}
            style={{ width: '100%', accentColor: C.cyan, cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textDim, fontFamily: MONO, marginTop: 2 }}>
            <span>Jan 1, 00:00</span>
            <span>{timeLabel}</span>
            <span>Dec 31, 23:00</span>
          </div>
        </div>

        {/* Speed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: C.textMid }}>Speed:</span>
          {[1, 5, 20, 100].map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${speed === s ? C.cyan : C.border}`,
              background: speed === s ? C.cyanDim : 'transparent',
              color: speed === s ? C.cyan : C.textMid,
              fontSize: 11, cursor: 'pointer', fontFamily: MONO,
            }}>{s}×</button>
          ))}
        </div>

        {/* Jump buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {[
            { label: 'Dawn', h: 6 },
            { label: 'Noon', h: 12 },
            { label: 'Dusk', h: 18 },
            { label: 'Midnight', h: 0 },
          ].map(({ label, h: jumpH }) => (
            <button key={label} onClick={() => {
              setPlaying(false);
              const dayStart = Math.floor(hour / 24) * 24;
              setHour(Math.min(maxHour, dayStart + jumpH));
            }} style={{
              padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.textMid,
              fontSize: 11, cursor: 'pointer', fontFamily: FONT,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Monthly quick-jump ── */}
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => {
          const startH = [0,31,59,90,120,151,181,212,243,273,304,334][i] * 24;
          return (
            <button key={m} onClick={() => { setPlaying(false); setHour(startH + 12); }} style={{
              padding: '3px 10px', borderRadius: 5,
              border: `1px solid ${month === i ? C.cyan : C.border}`,
              background: month === i ? C.cyanDim : 'transparent',
              color: month === i ? C.cyan : C.textDim,
              fontSize: 10, cursor: 'pointer', fontFamily: MONO,
            }}>{m}</button>
          );
        })}
      </div>
    </div>
  );
}
