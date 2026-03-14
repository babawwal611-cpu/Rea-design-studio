import React, { useState, useEffect, useRef } from 'react';

/* ─── Design Tokens ───────────────────────────────────────────────────────── */
const C = {
  bg:       '#F4F7FB',
  white:    '#FFFFFF',
  navy:     '#0A1628',
  navyMid:  '#1E3A5F',
  blue:     '#0070CC',
  blueLight:'#3B9EFF',
  border:   '#E2EAF2',
  textDark: '#1A2B3C',
  textMid:  '#4A6580',
  textDim:  '#94A3B8',
  amber:    '#D97706',
};

/* DM Sans only — no serif, no mono */
const FONT = `'DM Sans', sans-serif`;

/* ─── Stats counter hook ──────────────────────────────────────────────────── */
function useCountUp(target, duration = 1400, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p    = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

/* ─── Stat card — dark bg, white numbers ─────────────────────────────────── */
const StatCard = ({ value, unit, label, inView }) => {
  const num = useCountUp(value, 1200, inView);
  return (
    <div style={{ textAlign: 'center', padding: '8px 16px' }}>
      <div style={{
        fontSize: 48, fontWeight: 700, color: '#fff',
        fontFamily: FONT, lineHeight: 1, letterSpacing: -1,
      }}>
        {num.toLocaleString()}{unit}
      </div>
      <div style={{
        fontSize: 13, color: 'rgba(255,255,255,0.55)',
        marginTop: 10, fontFamily: FONT, lineHeight: 1.5,
        maxWidth: 180, margin: '10px auto 0',
      }}>
        {label}
      </div>
    </div>
  );
};

/* ─── Process step ────────────────────────────────────────────────────────── */
const Step = ({ n, title, desc }) => (
  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: C.blue,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700, fontFamily: FONT,
    }}>{n}</div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 4, fontFamily: FONT }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7, fontFamily: FONT }}>{desc}</div>
    </div>
  </div>
);

/* ─── Main LandingPage component ──────────────────────────────────────────── */
export default function LandingPage({ onEnter, onOpenSizing }) {
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const navOpaque = scrollY > 40;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        .hero-fade-1 { animation: fadeUp 0.6s 0.1s both cubic-bezier(0.22,1,0.36,1); }
        .hero-fade-2 { animation: fadeUp 0.6s 0.22s both cubic-bezier(0.22,1,0.36,1); }
        .hero-fade-3 { animation: fadeUp 0.6s 0.34s both cubic-bezier(0.22,1,0.36,1); }
        .float-card  { animation: float 6s ease-in-out infinite; }
        .launch-btn  { transition: all 0.2s; }
        .launch-btn:hover { background: #005CA3 !important; transform: translateY(-1px); }
        .nav-link { color: ${C.textMid}; text-decoration: none; font-size: 14px; font-weight: 500;
                    font-family: ${FONT}; transition: color 0.2s; }
        .nav-link:hover { color: ${C.textDark}; }
      `}</style>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 48px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: navOpaque ? 'rgba(244,247,251,0.96)' : 'transparent',
        backdropFilter: navOpaque ? 'blur(16px)' : 'none',
        borderBottom: navOpaque ? `1px solid ${C.border}` : 'none',
        transition: 'all 0.3s',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 20, fontWeight: 700, color: C.navy,
            fontFamily: FONT, letterSpacing: -0.5,
          }}>MIRIDA</span>
        </div>

        {/* Links + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <a href="#how-it-works" className="nav-link">How it works</a>
          <a href="#about" className="nav-link">About</a>
          <button onClick={onEnter} className="launch-btn" style={{
            padding: '9px 22px', borderRadius: 8,
            background: C.blue,
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: FONT,
          }}>
            Launch Studio
          </button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '120px 40px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Grid pattern background — kept as agreed */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(${C.border} 1px, transparent 1px),
            linear-gradient(90deg, ${C.border} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          opacity: 0.5,
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)',
        }} />

        {/* Hero text — centred, clean */}
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 740 }}>
          <h1 className="hero-fade-1" style={{
            fontSize: 'clamp(40px, 5.5vw, 68px)',
            fontFamily: FONT, fontWeight: 700,
            color: C.navy, lineHeight: 1.1,
            letterSpacing: -1.5, marginBottom: 24,
          }}>
            Simulate first and<br />prove it works.
          </h1>

          <p className="hero-fade-2" style={{
            fontSize: 18, color: C.textMid, lineHeight: 1.75,
            maxWidth: 520, margin: '0 auto 40px', fontWeight: 400,
          }}>
            Everything you need for pre-feasibility. From load profiling to bankable financial
            projections — a complete pre-feasibility workflow in one browser-based tool.
          </p>

          <div className="hero-fade-3">
            <button onClick={onEnter} className="launch-btn" style={{
              padding: '14px 36px', borderRadius: 10,
              background: C.blue,
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 16, fontWeight: 600, fontFamily: FONT,
            }}>
              Launch Studio
            </button>
          </div>
        </div>

        {/* Floating UI preview card — kept as agreed */}
        <div className="float-card" style={{
          marginTop: 72, position: 'relative', zIndex: 1,
          background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: 4,
          boxShadow: '0 24px 64px rgba(0,112,204,0.10), 0 4px 16px rgba(0,0,0,0.06)',
          maxWidth: 760, width: '100%',
        }}>
          <div style={{ background: C.bg, borderRadius: 16, overflow: 'hidden' }}>
            {/* Fake browser bar */}
            <div style={{
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {['#F87171','#FBBF24','#34D399'].map(c => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                ))}
              </div>
              <div style={{
                flex: 1, height: 22, borderRadius: 6, background: C.white,
                border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center',
                padding: '0 10px', fontSize: 10, color: C.textDim, fontFamily: FONT,
              }}>
                mirida.app/studio
              </div>
            </div>
            {/* Fake dashboard content */}
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Renewable Fraction', value: '84.2%', color: C.blue },
                { label: 'Annual PV Output',   value: '142,300 kWh', color: C.textDark },
                { label: 'LCOE',               value: '₦98/kWh', color: C.textDark },
                { label: 'Project NPV',        value: '₦18.4M', color: '#059669' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: C.white, border: `1px solid ${C.border}`,
                  borderRadius: 10, padding: '12px',
                }}>
                  <div style={{ fontSize: 9, color: C.textDim, marginBottom: 4, fontFamily: FONT }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: FONT }}>{value}</div>
                </div>
              ))}
            </div>
            {/* Mini chart */}
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{
                background: C.white, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '12px 16px',
              }}>
                <div style={{ fontSize: 9, color: C.textDim, fontFamily: FONT, marginBottom: 10 }}>Monthly Energy Balance</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
                  {[72,85,91,88,78,60,54,58,67,75,80,74].map((h, i) => (
                    <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', height: `${h}%`, borderRadius: '3px 3px 0 0',
                        background: C.blue, opacity: 0.75,
                      }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  {['J','F','M','A','M','J','J','A','S','O','N','D'].map(m => (
                    <div key={m} style={{ fontSize: 8, color: C.textDim, fontFamily: FONT, flex: 1, textAlign: 'center' }}>{m}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          color: C.textDim, fontSize: 11, fontFamily: FONT,
        }}>
          <span>scroll</span>
          <div style={{ width: 1, height: 28, background: `linear-gradient(${C.textDim}, transparent)` }} />
        </div>
      </section>

      {/* ── Stats — dark navy, white numbers, no glow ─────────────────── */}
      <section ref={statsRef} id="stats" style={{
        padding: '80px 40px',
        background: C.navy,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            <StatCard value={85}   unit="M+"  label="Nigerians without reliable electricity" inView={statsVisible} />
            <StatCard value={3600} unit="+"   label="Communities eligible for mini-grids (REA)" inView={statsVisible} />
            <StatCard value={50}   unit="+"   label="kWh/day average mini-grid capacity" inView={statsVisible} />
            <StatCard value={90}   unit="%"   label="Cost reduction vs grid extension in rural areas" inView={statsVisible} />
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section id="how-it-works" style={{
        padding: '100px 40px',
        background: C.white, borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div style={{
              fontSize: 11, color: C.blue, letterSpacing: 2,
              textTransform: 'uppercase', fontFamily: FONT,
              fontWeight: 600, marginBottom: 16,
            }}>
              7-Step Workflow
            </div>
            <h2 style={{
              fontSize: 36, fontFamily: FONT, fontWeight: 700, color: C.navy,
              letterSpacing: -0.5, marginBottom: 16, lineHeight: 1.2,
            }}>
              From site to simulation in under 10 minutes
            </h2>
            <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 40 }}>
              MIRIDA guides engineers and planners through a structured pre-feasibility workflow.
              No spreadsheets, no coding — just a clean, guided process.
            </p>
            <button onClick={onEnter} className="launch-btn" style={{
              padding: '13px 28px', borderRadius: 10,
              background: C.blue,
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: FONT,
            }}>
              Try it now
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <Step n={1} title="Site and project details"  desc="Enter location coordinates or select a Nigerian state. Name your project and set the community profile." />
            <Step n={2} title="Load profile"              desc="Choose from REA load templates (rural household to 500-household village) or upload your own 8760-hour CSV." />
            <Step n={3} title="Solar resource"            desc="Fetch real TMY data from NASA POWER or PVGIS, or select a pre-loaded Nigerian city preset." />
            <Step n={4} title="System configuration"      desc="Size your PV array, battery bank, inverter, and optional generator. Derating and efficiency factors included." />
            <Step n={5} title="Financial inputs"          desc="Review Nigerian cost defaults or enter your own CapEx, O&M, diesel price, and tariff assumptions." />
            <Step n={6} title="Run simulation"            desc="8,760-hour dispatch engine runs in seconds. Review detailed KPIs, charts, and energy balance." />
            <Step n={7} title="Export report"             desc="Download a professional PDF pre-feasibility report with all results, charts, and financial tables." />
          </div>
        </div>
      </section>

      {/* ── About ──────────────────────────────────────────────────────── */}
      <section id="about" style={{
        padding: '100px 40px',
        background: C.bg, borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
          <div>
            <div style={{
              fontSize: 11, color: C.blue, letterSpacing: 2,
              textTransform: 'uppercase', fontFamily: FONT,
              fontWeight: 600, marginBottom: 16,
            }}>
              About MIRIDA
            </div>
            <h2 style={{
              fontSize: 36, fontFamily: FONT, fontWeight: 700, color: C.navy,
              letterSpacing: -0.5, marginBottom: 20, lineHeight: 1.2,
            }}>
              Built for Nigeria's energy access challenge
            </h2>
            <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 20 }}>
              MIRIDA is a free, browser-based pre-feasibility simulation tool designed for
              engineers, planners, and developers working on mini-grid projects in Nigeria.
            </p>
            <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 20 }}>
              The tool implements methodologies aligned with the Nigerian Electrification
              Project (NEP) and SE4ALL frameworks.
            </p>
            <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7 }}>
              All cost benchmarks, load templates, and financial defaults are calibrated to
              Nigerian market conditions. Solar resource data is sourced from peer-reviewed
              satellite datasets (PVGIS and NASA POWER).
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Free to use',          desc: 'No account, no subscription, no paywalls.' },
              { label: 'No data stored',        desc: 'All calculations run in your browser. Nothing is sent to a server.' },
              { label: '±15% accuracy',         desc: 'Pre-feasibility grade. Always validate with a detailed study before procurement.' },
              { label: 'PVGIS and NASA data',   desc: 'Real satellite-based solar irradiance for any location in Nigeria.' },
            ].map(({ label, desc }) => (
              <div key={label} style={{
                padding: '16px 20px', background: C.white,
                border: `1px solid ${C.border}`, borderRadius: 12,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, fontFamily: FONT, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: C.textMid, fontFamily: FONT, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ─────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 40px',
        background: C.navy,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            fontSize: 36, fontFamily: FONT, fontWeight: 700, color: '#fff',
            letterSpacing: -0.5, marginBottom: 16, lineHeight: 1.2,
          }}>
            Ready to design your first mini-grid?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', marginBottom: 36, lineHeight: 1.7, fontFamily: FONT }}>
            No installation, no sign-up. Just open the studio and start simulating.
          </p>
          <button onClick={onEnter} className="launch-btn" style={{
            padding: '14px 36px', borderRadius: 10,
            background: C.blue,
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 16, fontWeight: 600, fontFamily: FONT,
          }}>
            Launch Studio
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{
        padding: '32px 48px',
        background: C.navy,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: FONT }}>
            MIRIDA
          </span>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: FONT, textAlign: 'center' }}>
            Pre-feasibility results are indicative only (±15–20%). Not for procurement decisions without a detailed engineering study.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: FONT }}>
            Solar data: PVGIS (EU JRC) · NASA POWER
          </div>
        </div>
      </footer>
    </div>
  );
}
