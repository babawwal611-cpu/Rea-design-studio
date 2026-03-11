/**
 * REA Mini-Grid Simulation Engine
 * Hourly dispatch simulation for PV + Battery + optional Diesel Generator
 * Based on simplified HOMER-style load-following dispatch strategy
 * Accuracy: ±15-20% vs detailed design (pre-feasibility grade)
 */

/* ─── Constants ─────────────────────────────────────────────────────────── */
const G_STC   = 1000;   // W/m² — standard test condition irradiance
const T_STC   = 25;     // °C   — standard test condition temperature
const NOCT    = 45;     // °C   — nominal operating cell temperature (typical crystalline Si)

/* ─── PV Generation Model ────────────────────────────────────────────────
 * P_pv(t) = P_rated × (G(t)/G_stc) × [1 + α(T_cell - T_stc)]
 * T_cell  = T_amb + (G/800) × (NOCT - 20)
 * α       = -0.004 /°C (typical crystalline silicon temperature coefficient)
 */
function calcPVOutput(G_wm2, T_amb_C, P_rated_kW, alpha = -0.004) {
  if (G_wm2 <= 0) return 0;
  const T_cell = T_amb_C + (G_wm2 / 800) * (NOCT - 20);
  const tempFactor = 1 + alpha * (T_cell - T_STC);
  const P = P_rated_kW * (G_wm2 / G_STC) * tempFactor;
  return Math.max(0, P);
}

/* ─── Battery Dispatch Model ─────────────────────────────────────────────
 * Capacity-based model with SOC tracking
 * Inputs:
 *   soc_kwh      — current state of charge (kWh)
 *   p_charge_kw  — power available to charge (kW)
 *   p_needed_kw  — power needed from battery (kW)
 *   config       — battery configuration object
 * Returns: { soc_new, charged, discharged }
 */
function dispatchBattery(soc_kwh, p_charge_kw, p_needed_kw, config) {
  const {
    capacity_kwh,
    dod,           // depth of discharge (0–1), e.g. 0.8 for Li-ion
    eta_charge,    // charge efficiency (e.g. 0.95)
    eta_discharge, // discharge efficiency (e.g. 0.95)
    c_rate,        // max charge/discharge rate (kW per kWh capacity)
  } = config;

  const soc_max = capacity_kwh;
  const soc_min = capacity_kwh * (1 - dod);
  const p_charge_max   = c_rate * capacity_kwh;
  const p_discharge_max = c_rate * capacity_kwh;

  let soc = soc_kwh;
  let charged    = 0;
  let discharged = 0;

  if (p_charge_kw > 0) {
    // Charging: how much can we accept?
    const headroom  = soc_max - soc;
    const p_actual  = Math.min(p_charge_kw, p_charge_max, headroom / eta_charge);
    charged = Math.max(0, p_actual);
    soc    += charged * eta_charge;
  }

  if (p_needed_kw > 0) {
    // Discharging: how much can we supply?
    const available  = (soc - soc_min) * eta_discharge;
    const p_actual   = Math.min(p_needed_kw, p_discharge_max, available);
    discharged = Math.max(0, p_actual);
    soc       -= discharged / eta_discharge;
  }

  // Clamp SOC to physical limits
  soc = Math.max(soc_min, Math.min(soc_max, soc));

  return { soc_new: soc, charged, discharged };
}

/* ─── Generator Fuel Consumption ─────────────────────────────────────────
 * Standard linear fuel consumption model (from generator specs)
 * Fuel(kW) = A × P_rated + B × P_output   (litres/hour)
 * Simplified: 0.08415 L/kW·rated + 0.246 L/kWh output (HOMER defaults)
 */
function calcFuelConsumption(p_output_kw, p_rated_kw) {
  if (p_output_kw <= 0) return 0;
  const A = 0.0845; // no-load coefficient (L/hr per kW rated)
  const B = 0.2460; // marginal coefficient (L/kWh)
  return A * p_rated_kw + B * p_output_kw;
}

/* ─── Main Simulation Loop ───────────────────────────────────────────────
 *
 * Inputs:
 *   loadProfile   — Float32Array or Array of 8760 hourly load values (kW)
 *   solarData     — Array of 8760 objects: { ghi, temp } or Array of ghi values
 *   pvConfig      — { capacity_kw, alpha }
 *   batteryConfig — { capacity_kwh, dod, eta_charge, eta_discharge, c_rate }
 *   genConfig     — { enabled, capacity_kw, fuel_price_per_litre }
 *
 * Returns: SimulationResult object with hourly arrays + annual summary
 */
export function simulateSystem({ loadProfile, solarData, pvConfig, batteryConfig, genConfig }) {

  const HOURS = 8760;

  /* ── Validate inputs ── */
  if (!loadProfile || loadProfile.length < HOURS) {
    throw new Error(`Load profile must have ${HOURS} hourly values. Got ${loadProfile?.length || 0}.`);
  }
  if (!solarData || solarData.length < HOURS) {
    throw new Error(`Solar data must have ${HOURS} hourly values. Got ${solarData?.length || 0}.`);
  }

  /* ── Output arrays ── */
  const pv_output      = new Float32Array(HOURS); // kW
  const battery_charge = new Float32Array(HOURS); // kW into battery
  const battery_discharge = new Float32Array(HOURS); // kW out of battery
  const battery_soc    = new Float32Array(HOURS); // kWh
  const gen_output     = new Float32Array(HOURS); // kW
  const fuel_consumed  = new Float32Array(HOURS); // litres
  const excess_energy  = new Float32Array(HOURS); // kW (curtailed PV)
  const unserved_load  = new Float32Array(HOURS); // kW (load not met)
  const load_served    = new Float32Array(HOURS); // kW actually served

  /* ── Initial battery SOC — start at 50% ── */
  let soc = batteryConfig.capacity_kwh * 0.5;

  /* ── 8760-hour dispatch loop ── */
  for (let h = 0; h < HOURS; h++) {
    const load_kw = loadProfile[h] || 0;

    // Extract solar data (supports both object and flat array formats)
    const solar = solarData[h];
    const ghi   = typeof solar === 'object' ? (solar.ghi || 0) : (solar || 0);
    const temp  = typeof solar === 'object' ? (solar.temp || 25) : 25;

    // 1. PV generation
    const p_pv = calcPVOutput(ghi, temp, pvConfig.capacity_kw, pvConfig.alpha || -0.004);
    pv_output[h] = p_pv;

    // 2. Net power balance
    let p_net = p_pv - load_kw; // positive = surplus, negative = deficit

    let charged    = 0;
    let discharged = 0;
    let p_gen      = 0;
    let fuel       = 0;
    let excess     = 0;
    let unserved   = 0;

    if (p_net >= 0) {
      // ── SURPLUS: charge battery ──
      const result = dispatchBattery(soc, p_net, 0, batteryConfig);
      soc       = result.soc_new;
      charged   = result.charged;
      excess    = p_net - charged; // PV that couldn't be stored
    } else {
      // ── DEFICIT: discharge battery first ──
      const deficit = -p_net;
      const result  = dispatchBattery(soc, 0, deficit, batteryConfig);
      soc        = result.soc_new;
      discharged = result.discharged;

      let remaining = deficit - discharged;

      // ── Generator dispatch if deficit remains ──
      if (remaining > 0.001 && genConfig.enabled) {
        // Load following: generator only produces what is needed
        p_gen = Math.min(remaining, genConfig.capacity_kw);
        fuel  = calcFuelConsumption(p_gen, genConfig.capacity_kw);

        // Optional cycle charging: if generator is running, charge battery with spare capacity
        if (genConfig.cycleCharging && p_gen < genConfig.capacity_kw) {
          const spare = genConfig.capacity_kw - p_gen;
          const chargeResult = dispatchBattery(soc, spare, 0, batteryConfig);
          soc      = chargeResult.soc_new;
          charged += chargeResult.charged;
          // Add actual charged power to fuel cost
          const extraLoad = chargeResult.charged / (batteryConfig.eta_charge || 0.95);
          fuel += calcFuelConsumption(extraLoad, genConfig.capacity_kw) * (extraLoad / genConfig.capacity_kw);
        }

        remaining -= p_gen;
      }

      // Any remaining deficit after generator = unserved load
      unserved = Math.max(0, remaining);
    }

    // Record hourly values
    battery_charge[h]    = charged;
    battery_discharge[h] = discharged;
    battery_soc[h]       = soc;
    gen_output[h]        = p_gen;
    fuel_consumed[h]     = fuel;
    excess_energy[h]     = excess;
    unserved_load[h]     = unserved;
    load_served[h]       = load_kw - unserved;
  }

  /* ── Annual Summary Calculations ── */
  const sum = arr => Array.from(arr).reduce((a, b) => a + b, 0);

  const annual_pv_kwh       = sum(pv_output);
  const annual_gen_kwh      = sum(gen_output);
  const annual_load_kwh     = sum(loadProfile);
  const annual_served_kwh   = sum(load_served);
  const annual_excess_kwh   = sum(excess_energy);
  const annual_unserved_kwh = sum(unserved_load);
  const annual_fuel_litres  = sum(fuel_consumed);
  const annual_batt_charge  = sum(battery_charge);
  const annual_batt_discharge = sum(battery_discharge);

  const renewable_fraction  = annual_load_kwh > 0
    ? Math.min(1, (annual_served_kwh - annual_gen_kwh) / annual_served_kwh)
    : 0;

  const unmet_load_fraction = annual_load_kwh > 0
    ? annual_unserved_kwh / annual_load_kwh
    : 0;

  const capacity_factor_pv  = annual_pv_kwh / (pvConfig.capacity_kw * HOURS);

  /* ── Monthly Aggregation ── */
  const DAYS_PER_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];
  const monthly = DAYS_PER_MONTH.map((days, m) => {
    const start = DAYS_PER_MONTH.slice(0, m).reduce((a, b) => a + b, 0) * 24;
    const end   = start + days * 24;
    const slice = (arr) => Array.from(arr).slice(start, end).reduce((a, b) => a + b, 0);
    return {
      month: m,
      pv_kwh:       slice(pv_output),
      gen_kwh:      slice(gen_output),
      load_kwh:     Array.from(loadProfile).slice(start, end).reduce((a, b) => a + b, 0),
      excess_kwh:   slice(excess_energy),
      unserved_kwh: slice(unserved_load),
      fuel_litres:  slice(fuel_consumed),
    };
  });

  /* ── Duration Curve (sorted load + generation for 100 percentile points) ── */
  const durationCurve = (() => {
    const combined = Array.from({ length: HOURS }, (_, h) => ({
      load:  loadProfile[h],
      gen:   pv_output[h] + gen_output[h] + battery_discharge[h] - battery_charge[h],
    }));
    combined.sort((a, b) => b.load - a.load);
    const step = Math.floor(HOURS / 100);
    return Array.from({ length: 100 }, (_, i) => combined[i * step] || combined[HOURS - 1]);
  })();

  /* ── Peak/Average load stats ── */
  const peak_load_kw = Math.max(...loadProfile);
  const avg_load_kw  = annual_load_kwh / HOURS;

  return {
    // Hourly arrays (Float32Array for memory efficiency)
    hourly: {
      pv_output,
      battery_charge,
      battery_discharge,
      battery_soc,
      gen_output,
      fuel_consumed,
      excess_energy,
      unserved_load,
      load_served,
      load: loadProfile,
    },

    // Annual summary
    annual: {
      pv_kwh:            Math.round(annual_pv_kwh),
      gen_kwh:           Math.round(annual_gen_kwh),
      load_kwh:          Math.round(annual_load_kwh),
      served_kwh:        Math.round(annual_served_kwh),
      excess_kwh:        Math.round(annual_excess_kwh),
      unserved_kwh:      Math.round(annual_unserved_kwh),
      fuel_litres:       Math.round(annual_fuel_litres),
      batt_charge_kwh:   Math.round(annual_batt_charge),
      batt_discharge_kwh: Math.round(annual_batt_discharge),
      renewable_fraction:  parseFloat((renewable_fraction * 100).toFixed(1)),
      unmet_load_fraction: parseFloat((unmet_load_fraction * 100).toFixed(2)),
      capacity_factor_pv:  parseFloat((capacity_factor_pv * 100).toFixed(1)),
      peak_load_kw:      parseFloat(peak_load_kw.toFixed(2)),
      avg_load_kw:       parseFloat(avg_load_kw.toFixed(2)),
    },

    // Monthly breakdown
    monthly,

    // Duration curve
    durationCurve,
  };
}

/* ─── Financial Analysis ─────────────────────────────────────────────────
 * Calculates LCOE, NPV, payback period, CapEx breakdown
 */
export function calculateFinancials({ simResult, systemConfig, financialConfig }) {
  const {
    pv_capacity_kw,
    battery_capacity_kwh,
    gen_capacity_kw,
    gen_enabled,
  } = systemConfig;

  const {
    pv_cost_per_kw,        // ₦ per kWp
    battery_cost_per_kwh,  // ₦ per kWh
    gen_cost_per_kw,       // ₦ per kW
    inverter_cost_per_kw,  // ₦ per kW
    bos_pct,               // BOS as % of PV cost (0.15–0.20)
    installation_pct,      // Installation as % of hardware (0.10–0.15)
    om_pct_annual,         // Annual O&M as % of CapEx (0.01–0.02)
    fuel_price_per_litre,  // ₦ per litre
    discount_rate,         // e.g. 0.12 for 12%
    project_lifetime_years, // e.g. 20
    tariff_per_kwh,        // ₦ per kWh sold (revenue)
    currency,              // '₦' or '$'
  } = financialConfig;

  // CapEx components
  const capex_pv       = pv_capacity_kw * pv_cost_per_kw;
  const capex_battery  = battery_capacity_kwh * battery_cost_per_kwh;
  const capex_gen      = gen_enabled ? gen_capacity_kw * gen_cost_per_kw : 0;
  const capex_inverter = pv_capacity_kw * inverter_cost_per_kw;
  const capex_hardware = capex_pv + capex_battery + capex_gen + capex_inverter;
  const capex_bos      = capex_pv * bos_pct;
  const capex_install  = capex_hardware * installation_pct;
  const capex_total    = capex_hardware + capex_bos + capex_install;

  // Annual costs
  const annual_om      = capex_total * om_pct_annual;
  const annual_fuel    = simResult.annual.fuel_litres * fuel_price_per_litre;
  const annual_opex    = annual_om + annual_fuel;

  // Capital Recovery Factor
  const i = discount_rate;
  const n = project_lifetime_years;
  const CRF = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);

  // LCOE
  const annual_served = simResult.annual.served_kwh;
  const LCOE = annual_served > 0
    ? (capex_total * CRF + annual_opex) / annual_served
    : 0;

  // NPV
  const annual_revenue = annual_served * tariff_per_kwh;
  const annual_net     = annual_revenue - annual_opex;
  let npv = -capex_total;
  for (let t = 1; t <= n; t++) {
    npv += annual_net / Math.pow(1 + i, t);
  }

  // Simple Payback
  const simple_payback = annual_net > 0 ? capex_total / annual_net : Infinity;

  // Cost per beneficiary (assume 5 people per household, 8 households per kW of load)
  const beneficiaries = Math.round(simResult.annual.avg_load_kw * 8 * 5);

  // Annual CO2 avoided (grid emission factor Nigeria: ~0.43 kgCO2/kWh)
  const co2_avoided_kg = (simResult.annual.served_kwh - simResult.annual.gen_kwh) * 0.43;

  return {
    capex: {
      pv:        Math.round(capex_pv),
      battery:   Math.round(capex_battery),
      generator: Math.round(capex_gen),
      inverter:  Math.round(capex_inverter),
      bos:       Math.round(capex_bos),
      install:   Math.round(capex_install),
      total:     Math.round(capex_total),
    },
    annual: {
      om:       Math.round(annual_om),
      fuel:     Math.round(annual_fuel),
      opex:     Math.round(annual_opex),
      revenue:  Math.round(annual_revenue),
      net:      Math.round(annual_net),
    },
    metrics: {
      lcoe:           parseFloat(LCOE.toFixed(2)),
      npv:            Math.round(npv),
      simple_payback: parseFloat(simple_payback.toFixed(1)),
      crf:            parseFloat(CRF.toFixed(4)),
      beneficiaries,
      cost_per_beneficiary: beneficiaries > 0 ? Math.round(capex_total / beneficiaries) : 0,
      co2_avoided_kg: Math.round(co2_avoided_kg),
    },
    currency,
  };
}

/* ─── Load Profile Utilities ─────────────────────────────────────────────*/

/** Parse CSV file content into 8760-hour load array */
export function parseLoadCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const values = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.toLowerCase().startsWith('hour') || trimmed.toLowerCase().startsWith('time')) continue;
    // Support comma, semicolon, tab delimiters
    const parts = trimmed.split(/[,;\t]/);
    // Take the last numeric column if multiple columns
    for (let i = parts.length - 1; i >= 0; i--) {
      const val = parseFloat(parts[i].replace(/['"]/g, ''));
      if (!isNaN(val)) { values.push(val); break; }
    }
  }

  if (values.length < 8760) {
    throw new Error(`CSV must contain at least 8760 hourly values. Found ${values.length}.`);
  }

  return new Float32Array(values.slice(0, 8760));
}

/** Generate synthetic 8760-hour load profile from daily average */
export function generateLoadProfile(dailyAvgKWh, profileType = 'rural_village') {
  // Normalized 24-hour load shape profiles (fraction of daily peak)
  const SHAPES = {
    rural_village: [
      0.15,0.10,0.08,0.07,0.08,0.12,0.30,0.55,
      0.50,0.45,0.42,0.40,0.45,0.42,0.40,0.45,
      0.60,0.80,1.00,0.95,0.85,0.70,0.45,0.25,
    ],
    school: [
      0.05,0.05,0.05,0.05,0.05,0.05,0.10,0.20,
      0.60,0.80,0.90,0.95,1.00,0.95,0.90,0.80,
      0.60,0.30,0.15,0.10,0.08,0.07,0.06,0.05,
    ],
    health_clinic: [
      0.40,0.35,0.35,0.35,0.35,0.40,0.55,0.75,
      0.90,1.00,0.95,0.90,0.85,0.85,0.90,0.95,
      0.90,0.80,0.70,0.65,0.60,0.55,0.50,0.45,
    ],
    market: [
      0.10,0.08,0.07,0.07,0.08,0.12,0.25,0.55,
      0.85,1.00,0.98,0.95,0.92,0.95,0.98,1.00,
      0.90,0.70,0.45,0.30,0.20,0.15,0.12,0.10,
    ],
    borehole: [
      0.00,0.00,0.00,0.00,0.00,0.20,0.80,1.00,
      1.00,0.90,0.80,0.70,0.60,0.70,0.80,0.90,
      0.80,0.60,0.30,0.10,0.00,0.00,0.00,0.00,
    ],
  };

  const shape = SHAPES[profileType] || SHAPES.rural_village;
  const shapeSum = shape.reduce((a, b) => a + b, 0);
  // Peak power = dailyAvgKWh / (sum of shape fractions)
  const peakKW = dailyAvgKWh / shapeSum;

  // Seasonal variation factor (Nigeria: dry season slightly higher cooling load)
  const SEASONAL = Array.from({ length: 12 }, (_, m) =>
    [1.05,1.08,1.10,1.08,1.05,0.95,0.90,0.90,0.92,0.95,1.00,1.05][m]
  );

  const profile = new Float32Array(8760);
  const DAYS_PER_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

  let h = 0;
  for (let m = 0; m < 12; m++) {
    const seasonFactor = SEASONAL[m];
    for (let d = 0; d < DAYS_PER_MONTH[m]; d++) {
      for (let hr = 0; hr < 24; hr++) {
        // Add ±5% random variation for realism
        const noise = 0.95 + Math.random() * 0.10;
        profile[h++] = Math.max(0, peakKW * shape[hr] * seasonFactor * noise);
      }
    }
  }

  return profile;
}

/** Default Nigerian equipment costs and financial parameters */
export const NIGERIA_DEFAULTS = {
  equipment: {
    pv_cost_per_kw:       400000,  // ₦/kWp
    battery_li_per_kwh:  1000000,  // ₦/kWh (Li-ion)
    battery_la_per_kwh:   400000,  // ₦/kWh (Lead-acid)
    gen_cost_per_kw:      320000,  // ₦/kW
    inverter_cost_per_kw: 200000,  // ₦/kW
    bos_pct:              0.17,    // BOS = 17% of PV cost
    installation_pct:     0.12,    // Installation = 12% of hardware
  },
  financial: {
    om_pct_annual:         0.015,  // 1.5% of CapEx per year
    fuel_price_per_litre:  1200,   // ₦/litre diesel
    discount_rate:         0.12,   // 12%
    project_lifetime_years: 20,
    tariff_per_kwh:         150,   // ₦/kWh (typical REA project tariff)
    currency: '₦',
  },
  load_templates: [
    { id: 'rural_household_basic',    label: 'Rural Household (Basic)',       daily_kwh: 1.2,   icon: '🏠' },
    { id: 'rural_household_improved', label: 'Rural Household (Improved)',    daily_kwh: 3.5,   icon: '🏡' },
    { id: 'primary_school',           label: 'Primary School',                daily_kwh: 8.0,   icon: '🏫' },
    { id: 'health_clinic_basic',      label: 'Health Clinic (Basic)',         daily_kwh: 12.0,  icon: '🏥' },
    { id: 'health_clinic_ref',        label: 'Health Clinic (w/ Refrigeration)', daily_kwh: 25.0, icon: '❄️' },
    { id: 'rural_market',             label: 'Rural Market',                  daily_kwh: 15.0,  icon: '🏪' },
    { id: 'borehole',                 label: 'Borehole / Water Pump',         daily_kwh: 6.0,   icon: '💧' },
    { id: 'village_100hh',            label: 'Village (100 Households)',      daily_kwh: 120.0, icon: '🏘️' },
    { id: 'village_250hh',            label: 'Village (250 Households)',      daily_kwh: 300.0, icon: '🏙️' },
  ],
};

/** Fetch hourly solar data from PVGIS API (TMY - Typical Meteorological Year) */
export async function fetchPVGISSolar(lat, lng) {
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/tmy?lat=${lat}&lon=${lng}&outputformat=json&browser=1`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`PVGIS API error: ${res.status}`);
  const data = await res.json();

  // PVGIS TMY returns hourly data in data.outputs.tmy_hourly
  const hourly = data.outputs?.tmy_hourly;
  if (!hourly || hourly.length < 8760) {
    throw new Error('PVGIS returned insufficient hourly data');
  }

  return hourly.map(h => ({
    ghi:  h.G_Gh  || 0,   // Global Horizontal Irradiance (W/m²)
    temp: h.T2m   || 25,  // Ambient temperature (°C)
    dhi:  h.G_Dh  || 0,   // Diffuse Horizontal Irradiance
    ws:   h.WS10m || 0,   // Wind speed (m/s) — for future wind module
  }));
}

/** Embedded fallback TMY data for major Nigerian cities (daily averages scaled to hourly) */
export const NIGERIA_CITIES_SOLAR = [
  { name: 'Abuja (FCT)',  lat: 9.06,  lng: 7.49,  avg_ghi: 5.53, avg_temp: 28 },
  { name: 'Kano',         lat: 12.00, lng: 8.52,  avg_ghi: 6.14, avg_temp: 30 },
  { name: 'Lagos',        lat: 6.58,  lng: 3.38,  avg_ghi: 4.28, avg_temp: 27 },
  { name: 'Katsina',      lat: 12.98, lng: 7.61,  avg_ghi: 6.28, avg_temp: 31 },
  { name: 'Sokoto',       lat: 13.07, lng: 5.25,  avg_ghi: 6.33, avg_temp: 33 },
  { name: 'Maiduguri',    lat: 11.80, lng: 13.15, avg_ghi: 6.38, avg_temp: 31 },
  { name: 'Jigawa',       lat: 12.18, lng: 9.55,  avg_ghi: 6.21, avg_temp: 30 },
  { name: 'Kaduna',       lat: 10.52, lng: 7.72,  avg_ghi: 5.88, avg_temp: 29 },
  { name: 'Jos (Plateau)',lat: 9.22,  lng: 8.89,  avg_ghi: 5.62, avg_temp: 23 },
  { name: 'Port Harcourt',lat: 4.85,  lng: 7.01,  avg_ghi: 4.26, avg_temp: 28 },
  { name: 'Enugu',        lat: 6.46,  lng: 7.49,  avg_ghi: 4.55, avg_temp: 27 },
  { name: 'Ibadan (Oyo)', lat: 8.16,  lng: 3.93,  avg_ghi: 4.82, avg_temp: 27 },
];

/** Generate synthetic hourly TMY from daily average GHI (fallback when PVGIS unavailable) */
export function generateSyntheticSolar(avg_ghi_kwh_m2_day, avg_temp_c = 28) {
  // Hourly clearness distribution (Bell curve centred on solar noon)
  const HOURLY_SHAPE = [
    0,0,0,0,0,0.02,0.08,0.18,0.32,0.52,0.72,0.88,
    1.00,0.92,0.78,0.58,0.35,0.15,0.04,0,0,0,0,0,
  ];
  const shapeSum   = HOURLY_SHAPE.reduce((a, b) => a + b, 0); // ~6.44
  // Convert kWh/m²/day → W/m² daily average
  const daily_wh   = avg_ghi_kwh_m2_day * 1000;
  const peakGHI    = daily_wh / shapeSum;

  // Seasonal GHI variation for Nigeria (dry/wet season)
  const SEASONAL_GHI = [1.10,1.12,1.08,1.00,0.90,0.80,0.75,0.78,0.85,0.95,1.05,1.10];
  // Seasonal temp variation
  const SEASONAL_TEMP = [0,2,4,4,2,0,-1,-1,0,0,-1,-1];

  const DAYS_PER_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

  const result = [];
  for (let m = 0; m < 12; m++) {
    const ghiFactor  = SEASONAL_GHI[m];
    const tempOffset = SEASONAL_TEMP[m];
    for (let d = 0; d < DAYS_PER_MONTH[m]; d++) {
      // Cloud factor: random daily cloudiness (Nigeria: ~70% of days are clear/partly cloudy)
      const cloudFactor = Math.random() > 0.3 ? (0.85 + Math.random() * 0.15) : (0.3 + Math.random() * 0.4);
      for (let hr = 0; hr < 24; hr++) {
        const ghi  = Math.max(0, peakGHI * HOURLY_SHAPE[hr] * ghiFactor * cloudFactor);
        const temp = avg_temp_c + tempOffset + (hr >= 12 && hr <= 16 ? 3 : hr >= 22 || hr <= 5 ? -3 : 0);
        result.push({ ghi: Math.round(ghi), temp: parseFloat(temp.toFixed(1)) });
      }
    }
  }

  return result;
}
