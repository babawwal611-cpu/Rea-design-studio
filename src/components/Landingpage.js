import React, { useState, useEffect, useRef } from 'react';

/* ─── Design Tokens ───────────────────────────────────────────────────────── */
const C = {
  bg:       '#F4F7FB',
  white:    '#FFFFFF',
  navy:     '#0A1628',
  navyMid:  '#1E3A5F',
  blue:     '#0070CC',
  blueLight:'#3B9EFF',
  cyan:     '#00B4D8',
  teal:     '#0096B4',
  border:   '#E2EAF2',
  borderMid:'#C5D5E8',
  textDark: '#1A2B3C',
  textMid:  '#4A6580',
  textDim:  '#94A3B8',
  green:    '#059669',
  amber:    '#D97706',
};

const FONT = `'DM Sans', sans-serif`;
const SERIF = `'Playfair Display', serif`;
const MONO = `'IBM Plex Mono', monospace`;

/* ─── Shared primitives ───────────────────────────────────────────────────── */
const Badge = ({ children, color = C.blue }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '4px 12px', borderRadius: 20,
    border: `1px solid ${color}40`,
    background: `${color}12`,
    color, fontSize: 11, fontWeight: 600,
    fontFamily: FONT, letterSpacing: 0.5,
    textTransform: 'uppercase',
  }}>{children}</span>
);

const Chip = ({ icon, label }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', borderRadius: 8,
    background: C.white, border: `1px solid ${C.border}`,
    fontSize: 12, color: C.textMid, fontFamily: FONT,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  }}>
    <span>{icon}</span> {label}
  </div>
);

/* ─── Stats counter animation ─────────────────────────────────────────────── */
function useCountUp(target, duration = 1400, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

/* ─── Animated stat card ──────────────────────────────────────────────────── */
const StatCard = ({ value, unit, label, color = C.blue, inView }) => {
  const num = useCountUp(value, 1200, inView);
  return (
    <div style={{
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: '28px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 36, fontWeight: 700, color, fontFamily: MONO, lineHeight: 1 }}>
        {num.toLocaleString()}{unit}
      </div>
      <div style={{ fontSize: 13, color: C.textMid, marginTop: 8, fontFamily: FONT }}>{label}</div>
    </div>
  );
};

/* ─── Feature card ────────────────────────────────────────────────────────── */
const FeatureCard = ({ icon, title, desc, accent = C.blue }) => (
  <div style={{
    background: C.white, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: '28px 24px', transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 32px ${accent}18`; e.currentTarget.style.borderColor = `${accent}60`; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = C.border; }}
  >
    <div style={{
      width: 44, height: 44, borderRadius: 12, marginBottom: 16,
      background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22,
    }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 8, fontFamily: FONT }}>{title}</div>
    <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7, fontFamily: FONT }}>{desc}</div>
  </div>
);

/* ─── Process step ────────────────────────────────────────────────────────── */
const Step = ({ n, title, desc }) => (
  <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 700, fontFamily: MONO,
      boxShadow: `0 4px 12px ${C.blue}40`,
    }}>{n}</div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark, marginBottom: 4, fontFamily: FONT }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.7, fontFamily: FONT }}>{desc}</div>
    </div>
  </div>
);

/* ─── Main LandingPage component ──────────────────────────────────────────── */
export default function LandingPage({ onEnter }) {
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&family=IBM+Plex+Mono:wght@400;600&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .hero-fade-1 { animation: fadeUp 0.7s 0.1s both cubic-bezier(0.22,1,0.36,1); }
        .hero-fade-2 { animation: fadeUp 0.7s 0.25s both cubic-bezier(0.22,1,0.36,1); }
        .hero-fade-3 { animation: fadeUp 0.7s 0.4s both cubic-bezier(0.22,1,0.36,1); }
        .hero-fade-4 { animation: fadeUp 0.7s 0.55s both cubic-bezier(0.22,1,0.36,1); }
        .float-card  { animation: float 6s ease-in-out infinite; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px ${C.blue}40 !important; }
        .cta-btn { transition: all 0.2s; }
        .nav-link { color: ${C.textMid}; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
        .nav-link:hover { color: ${C.blue}; }
      `}</style>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: navOpaque ? 'rgba(244,247,251,0.95)' : 'transparent',
        backdropFilter: navOpaque ? 'blur(16px)' : 'none',
        borderBottom: navOpaque ? `1px solid ${C.border}` : 'none',
        transition: 'all 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${C.blue}40`,
          }}>
            <span style={{ fontSize: 16 }}>⚡</span>
          </div>
          <span style={{
            fontSize: 18, fontWeight: 700, color: C.navy,
            fontFamily: SERIF, fontStyle: 'italic', letterSpacing: -0.5,
          }}>GridForge</span>
          <span style={{
            fontSize: 9, fontFamily: MONO, color: C.textDim,
            padding: '2px 6px', background: `${C.blue}15`,
            borderRadius: 4, letterSpacing: 1, color: C.blue,
          }}>BETA</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How it works</a>
          <a href="#about" className="nav-link">About REA</a>
          <button onClick={onEnter} className="cta-btn" style={{
            padding: '9px 22px', borderRadius: 8,
            background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: FONT,
            boxShadow: `0 4px 16px ${C.blue}35`,
          }}>Launch Studio →</button>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '120px 40px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background grid pattern */}
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

        {/* Glowing orbs */}
        <div style={{
          position: 'absolute', top: '15%', left: '10%', width: 400, height: 400,
          borderRadius: '50%', background: `radial-gradient(circle, ${C.blue}18 0%, transparent 70%)`,
          filter: 'blur(40px)', zIndex: 0,
        }} />
        <div style={{
          position: 'absolute', bottom: '20%', right: '8%', width: 300, height: 300,
          borderRadius: '50%', background: `radial-gradient(circle, ${C.cyan}15 0%, transparent 70%)`,
          filter: 'blur(40px)', zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 820 }}>
          <div className="hero-fade-1" style={{ marginBottom: 20 }}>
            <Badge color={C.green}>🇳🇬 Built for Nigeria's Rural Electrification Agency</Badge>
          </div>

          <h1 className="hero-fade-2" style={{
            fontSize: 'clamp(42px, 6vw, 72px)',
            fontFamily: SERIF, fontWeight: 700,
            color: C.navy, lineHeight: 1.1,
            letterSpacing: -1.5, marginBottom: 24,
          }}>
            Design mini-grids<br />
            <span style={{
              fontStyle: 'italic', color: 'transparent',
              background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueLight} 50%, ${C.cyan} 100%)`,
              backgroundClip: 'text', WebkitBackgroundClip: 'text',
            }}>with confidence.</span>
          </h1>

          <p className="hero-fade-3" style={{
            fontSize: 18, color: C.textMid, lineHeight: 1.7,
            maxWidth: 560, margin: '0 auto 36px', fontWeight: 400,
          }}>
            Pre-feasibility simulation for hybrid PV-battery-generator systems.
            Powered by real NASA & PVGIS solar data. Export bankable PDF reports in minutes.
          </p>

          <div className="hero-fade-4" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
            <button onClick={onEnter} className="cta-btn" style={{
              padding: '14px 32px', borderRadius: 10,
              background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 600, fontFamily: FONT,
              boxShadow: `0 6px 24px ${C.blue}40`,
            }}>
              Start a simulation →
            </button>
            <button style={{
              padding: '14px 28px', borderRadius: 10,
              background: C.white, color: C.textDark,
              border: `1px solid ${C.borderMid}`, cursor: 'pointer',
              fontSize: 15, fontWeight: 500, fontFamily: FONT,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              View sample report
            </button>
          </div>

          {/* Capability chips */}
          <div className="hero-fade-4" style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Chip icon="☀️" label="8,760-hour simulation" />
            <Chip icon="🛰️" label="NASA POWER solar data" />
            <Chip icon="📄" label="PDF report export" />
            <Chip icon="🔋" label="Battery cycle analysis" />
            <Chip icon="💹" label="NPV / LCOE / IRR" />
          </div>
        </div>

        {/* Hero UI preview card */}
        <div className="float-card" style={{
          marginTop: 72, position: 'relative', zIndex: 1,
          background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: 4,
          boxShadow: '0 24px 64px rgba(0,112,204,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          maxWidth: 760, width: '100%',
        }}>
          <div style={{ background: C.bg, borderRadius: 16, overflow: 'hidden' }}>
            {/* Fake browser bar */}
            <div style={{
              padding: '10px 16px', background: C.white,
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {['#FF5F57','#FFBD2E','#28C840'].map(c => (
                <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
              ))}
              <div style={{
                flex: 1, height: 24, borderRadius: 6,
                background: C.bg, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', paddingLeft: 10,
              }}>
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: MONO }}>gridforge.rea.gov.ng</span>
              </div>
            </div>
            {/* Mini UI mockup */}
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'PV Output', value: '284 MWh', color: C.blue },
                  { label: 'Renewable Fraction', value: '87.3%', color: C.green },
                  { label: 'LCOE', value: '₦89/kWh', color: C.amber },
                  { label: 'NPV', value: '₦12.4M', color: C.green },
                ].map(k => (
                  <div key={k.label} style={{
                    padding: '12px', background: C.white,
                    borderRadius: 10, border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: k.color, fontFamily: MONO }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: C.textDim, marginTop: 3, fontFamily: FONT }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {/* Fake bar chart */}
              <div style={{
                background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 10, color: C.textMid, marginBottom: 10, fontFamily: FONT, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Monthly Energy Balance</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64 }}>
                  {[72, 85, 91, 88, 78, 60, 54, 58, 67, 75, 80, 74].map((h, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{
                        height: `${h}%`, borderRadius: '3px 3px 0 0',
                        background: `linear-gradient(180deg, ${C.blue} 0%, ${C.blueLight} 100%)`,
                      }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  {['J','F','M','A','M','J','J','A','S','O','N','D'].map(m => (
                    <div key={m} style={{ fontSize: 8, color: C.textDim, fontFamily: MONO, flex: 1, textAlign: 'center' }}>{m}</div>
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
          animation: 'float 2s ease-in-out infinite',
        }}>
          <span>scroll</span>
          <div style={{ width: 1, height: 28, background: `linear-gradient(${C.textDim}, transparent)` }} />
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section ref={statsRef} id="stats" style={{
        padding: '80px 40px',
        background: C.navy,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle at 20% 50%, ${C.blue}20 0%, transparent 60%), radial-gradient(circle at 80% 50%, ${C.cyan}12 0%, transparent 60%)`,
        }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 11, color: C.cyan, letterSpacing: 2, textTransform: 'uppercase', fontFamily: MONO, marginBottom: 12 }}>Nigeria's Energy Challenge</div>
            <h2 style={{
              fontSize: 36, fontFamily: SERIF, fontWeight: 700, color: '#fff',
              letterSpacing: -0.5,
            }}>The scale of the opportunity</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard value={85} unit="M+" label="Nigerians without reliable electricity" color={C.amber} inView={statsVisible} />
            <StatCard value={3600} unit="+" label="Communities eligible for mini-grids (REA)" color={C.blueLight} inView={statsVisible} />
            <StatCard value={50} unit="+" label="kWh/day average mini-grid capacity" color={C.cyan} inView={statsVisible} />
            <StatCard value={90} unit="%" label="Cost reduction vs grid extension in rural areas" color={C.green} inView={statsVisible} />
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 40px', background: C.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <Badge color={C.blue}>Engineering-Grade Tools</Badge>
            <h2 style={{
              fontSize: 40, fontFamily: SERIF, fontWeight: 700, color: C.navy,
              letterSpacing: -0.8, marginTop: 16, marginBottom: 16,
            }}>Everything you need for pre-feasibility</h2>
            <p style={{ fontSize: 16, color: C.textMid, maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
              From load profiling to bankable financial projections — a complete pre-feasibility workflow in one browser-based tool.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <FeatureCard
              icon="☀️"
              title="Real solar resource data"
              desc="Automatic cascade through PVGIS (EU JRC) and NASA POWER APIs. Falls back to calibrated city presets for all 12 major Nigerian cities. 8,760-hour TMY profiles."
              accent={C.amber}
            />
            <FeatureCard
              icon="⚡"
              title="8760-hour simulation engine"
              desc="Hour-by-hour dispatch simulation with PV derating, inverter efficiency, battery DoD, generator minimum load, and cycle degradation tracking."
              accent={C.blue}
            />
            <FeatureCard
              icon="🔋"
              title="Battery & generator dispatch"
              desc="Priority dispatch with configurable thresholds. Tracks battery cycles per year, state-of-charge profiles, and wet-stacking prevention."
              accent={C.cyan}
            />
            <FeatureCard
              icon="📊"
              title="Financial modelling"
              desc="Full CapEx breakdown, 20-year NPV/IRR, LCOE, simple payback. Nigerian cost defaults pre-loaded. Diesel price sensitivity."
              accent={C.green}
            />
            <FeatureCard
              icon="📄"
              title="PDF report export"
              desc="Professional pre-feasibility report with all KPIs, charts, financial tables, and engineering assessment. Ready for stakeholder review."
              accent={C.navyMid}
            />
            <FeatureCard
              icon="🗺️"
              title="Built for Nigerian context"
              desc="Nigerian grid coordinates, REA project load templates, Naira financials, local diesel pricing, and seasonal solar variation profiles."
              accent={C.green}
            />
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
            <Badge color={C.cyan}>7-Step Workflow</Badge>
            <h2 style={{
              fontSize: 38, fontFamily: SERIF, fontWeight: 700, color: C.navy,
              letterSpacing: -0.6, marginTop: 16, marginBottom: 16, lineHeight: 1.15,
            }}>From site to simulation<br />in under 10 minutes</h2>
            <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 40 }}>
              GridForge guides engineers and planners through a structured pre-feasibility workflow. No spreadsheets, no coding — just a clean, guided process.
            </p>
            <button onClick={onEnter} style={{
              padding: '13px 28px', borderRadius: 10,
              background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: FONT,
              boxShadow: `0 4px 16px ${C.blue}35`,
              transition: 'all 0.2s',
            }}>Try it now — free →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <Step n={1} title="Site & project details" desc="Enter location coordinates or select a Nigerian state. Name your project and set the community profile." />
            <Step n={2} title="Load profile" desc="Choose from 9 REA load templates (rural household to 250-household village) or upload your own 8760-hour CSV." />
            <Step n={3} title="Solar resource" desc="Fetch real TMY data from NASA POWER or PVGIS, or select a pre-loaded Nigerian city preset." />
            <Step n={4} title="System configuration" desc="Size your PV array, battery bank, inverter, and optional generator. Derating and efficiency factors included." />
            <Step n={5} title="Financial inputs" desc="Review Nigerian cost defaults or enter your own CapEx, O&M, diesel price, and tariff assumptions." />
            <Step n={6} title="Run simulation" desc="8,760-hour dispatch engine runs in seconds. Review detailed KPIs, charts, and energy balance." />
            <Step n={7} title="Export report" desc="Download a professional PDF pre-feasibility report with all results, charts, and financial tables." />
          </div>
        </div>
      </section>

      {/* ── About REA section ───────────────────────────────────────────── */}
      <section id="about" style={{
        padding: '100px 40px',
        background: C.bg, borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div style={{
              background: C.white, borderRadius: 24, padding: 40,
              border: `1px solid ${C.border}`,
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            }}>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 2, textTransform: 'uppercase', fontFamily: MONO, marginBottom: 20 }}>Designed for</div>
              {[
                { icon: '🏛️', title: 'REA Engineers & Planners', desc: 'Fast pre-feasibility before committing to detailed design' },
                { icon: '🏗️', title: 'EPC Contractors', desc: 'Quickly size and cost hybrid systems for client proposals' },
                { icon: '💼', title: 'Impact Investors', desc: 'Screen project financial viability before due diligence' },
                { icon: '🎓', title: 'Energy Researchers', desc: 'Model mini-grid scenarios with real Nigerian parameters' },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    background: `${C.blue}12`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 18,
                  }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.textDark, marginBottom: 2, fontFamily: FONT }}>{title}</div>
                    <div style={{ fontSize: 12, color: C.textMid, fontFamily: FONT }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Badge color={C.green}>Open Access Tool</Badge>
              <h2 style={{
                fontSize: 38, fontFamily: SERIF, fontWeight: 700, color: C.navy,
                letterSpacing: -0.6, marginTop: 16, marginBottom: 20, lineHeight: 1.15,
              }}>Supporting Nigeria's rural electrification mission</h2>
              <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 20 }}>
                GridForge is built to accelerate the REA's mandate of achieving universal electricity access. The tool implements methodologies aligned with the Nigerian Electrification Project (NEP) and SE4ALL frameworks.
              </p>
              <p style={{ fontSize: 15, color: C.textMid, lineHeight: 1.7, marginBottom: 32 }}>
                All cost benchmarks, load templates, and financial defaults are calibrated to Nigerian market conditions as of 2024/2025. Solar resource data is sourced from peer-reviewed satellite datasets.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Chip icon="✅" label="Free to use" />
                <Chip icon="🔒" label="No data stored" />
                <Chip icon="📐" label="±15% accuracy" />
                <Chip icon="🌍" label="PVGIS + NASA data" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────── */}
      <section style={{
        padding: '80px 40px',
        background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyMid} 100%)`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            radial-gradient(circle at 10% 50%, ${C.blue}25 0%, transparent 50%),
            radial-gradient(circle at 90% 50%, ${C.cyan}15 0%, transparent 50%)
          `,
        }} />
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: 40, fontFamily: SERIF, fontWeight: 700, color: '#fff',
            letterSpacing: -0.8, marginBottom: 16, lineHeight: 1.15,
          }}>
            Ready to design your<br />
            <span style={{ fontStyle: 'italic', color: C.blueLight }}>first mini-grid?</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.65)', marginBottom: 36, lineHeight: 1.7 }}>
            No installation, no signup. Just open the studio and start simulating.
          </p>
          <button onClick={onEnter} className="cta-btn" style={{
            padding: '16px 40px', borderRadius: 12,
            background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
            color: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 16, fontWeight: 700, fontFamily: FONT,
            boxShadow: `0 8px 32px ${C.blue}60`,
          }}>
            Open Design Studio →
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{
        padding: '40px',
        background: C.navy,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>⚡</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: SERIF, fontStyle: 'italic' }}>GridForge</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>v1.0</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: FONT, textAlign: 'center' }}>
            Pre-feasibility results are indicative only (±15–20%). Not for procurement decisions without detailed engineering study.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: FONT }}>
            Solar data: PVGIS (EU JRC) · NASA POWER
          </div>
        </div>
      </footer>
    </div>
  );
}
