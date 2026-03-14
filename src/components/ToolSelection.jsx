import React from 'react';

const C = {
  bg:      '#F4F7FB',
  white:   '#FFFFFF',
  navy:    '#0A1628',
  blue:    '#0070CC',
  border:  '#E2EAF2',
  textDark:'#1A2B3C',
  textMid: '#4A6580',
  textDim: '#94A3B8',
};

const FONT = `'DM Sans', sans-serif`;

export default function ToolSelection({ onSelectStudio, onSelectSizing, onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .tool-card { transition: all 0.2s; cursor: pointer; }
        .tool-card:hover { border-color: #0070CC !important; box-shadow: 0 8px 32px rgba(0,112,204,0.10) !important; transform: translateY(-2px); }
      `}</style>

      {/* Nav bar */}
      <nav style={{
        padding: '0 48px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(244,247,251,0.96)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, fontWeight: 500, color: C.textMid, fontFamily: FONT,
          display: 'flex', alignItems: 'center', gap: 6, padding: 0,
        }}>
          ← Back
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.navy, fontFamily: FONT }}>
          MIRIDA
        </span>
        <div style={{ width: 60 }} />
      </nav>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 700, color: C.navy,
            fontFamily: FONT, letterSpacing: -0.5, marginBottom: 12,
          }}>
            Where would you like to start?
          </h1>
          <p style={{ fontSize: 16, color: C.textMid, fontFamily: FONT, lineHeight: 1.6 }}>
            Choose the tool that fits your current stage of work.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 820, width: '100%' }}>

          {/* Detailed System Simulation */}
          <div
            className="tool-card"
            onClick={onSelectStudio}
            style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '40px 36px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.blue,
              letterSpacing: 2, textTransform: 'uppercase', fontFamily: FONT, marginBottom: 16,
            }}>
              Full analysis
            </div>
            <h2 style={{
              fontSize: 22, fontWeight: 700, color: C.navy,
              fontFamily: FONT, marginBottom: 14, lineHeight: 1.25,
            }}>
              Detailed System Simulation
            </h2>
            <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.7, fontFamily: FONT, marginBottom: 28 }}>
              8,760-hour hourly dispatch simulation. Covers load profiling, solar resource,
              system sizing, financial modelling, and PDF report export. For engineers and
              planners who need a bankable pre-feasibility result.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              {[
                'PV, battery, and generator dispatch',
                'NASA POWER and PVGIS solar data',
                'NPV, LCOE, and simple payback',
                'Exportable PDF report',
              ].map(item => (
                <div key={item} style={{
                  fontSize: 13, color: C.textMid, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.blue, flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            <button style={{
              width: '100%', padding: '13px', borderRadius: 10,
              background: C.blue, color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
            }}>
              Open Simulation Studio
            </button>
          </div>

          {/* Quick System Sizing */}
          <div
            className="tool-card"
            onClick={onSelectSizing}
            style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '40px 36px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{
              fontSize: 11, fontWeight: 600, color: C.textDim,
              letterSpacing: 2, textTransform: 'uppercase', fontFamily: FONT, marginBottom: 16,
            }}>
              Quick estimate
            </div>
            <h2 style={{
              fontSize: 22, fontWeight: 700, color: C.navy,
              fontFamily: FONT, marginBottom: 14, lineHeight: 1.25,
            }}>
              Quick System Sizing
            </h2>
            <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.7, fontFamily: FONT, marginBottom: 28 }}>
              A fast, guided 4-step estimate. Enter your energy demand, backup requirements,
              and grid availability to get an indicative system size in under two minutes.
              No solar data or cost inputs required.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              {[
                'Appliance-level or kWh/day energy entry',
                'Battery, PV, and inverter sizing',
                'Results in under 2 minutes',
                'Push to full simulation when ready',
              ].map(item => (
                <div key={item} style={{
                  fontSize: 13, color: C.textMid, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.textDim, flexShrink: 0 }} />
                  {item}
                </div>
              ))}
            </div>
            <button style={{
              width: '100%', padding: '13px', borderRadius: 10,
              background: 'transparent', color: C.navy,
              border: `1.5px solid ${C.border}`,
              fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
            }}>
              Open Quick Sizing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
