import {
  BodyId,
  DRACONIC_MONTH,
  J2000_JD,
  LUNAR_NODE_REF_JD,
  MOON_INCLINATION_DEG,
  NEW_MOON_REF_JD,
  PLANET_DATA,
  SYNODIC_MONTH,
} from './constants';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const TWO_PI = Math.PI * 2;

export function dateToJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function julianDateToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

/**
 * Newton-Raphson solver for Kepler's Equation: M = E - e * sin(E)
 */
export function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  const M = ((meanAnomalyRad % TWO_PI) + TWO_PI) % TWO_PI;
  let E = eccentricity < 0.8 ? M : Math.PI;
  for (let i = 0; i < 8; i++) {
    const f = E - eccentricity * Math.sin(E) - M;
    const fPrime = 1 - eccentricity * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < 1e-7) break;
  }
  return E;
}

export interface OrbitalPosition {
  x: number;
  y: number;
  z: number;
  orbitAngleRad: number; // Vernal equinox = 0, counter-clockwise from +Y
  radiusAU: number;
  modelRadius: number;
}

/**
 * Computes heliocentric 3D position using Keplerian elliptical elements.
 * Uses visual semi-major axis `modelDistance` scaled by `(1 - e*cos(E))` so
 * perihelion/aphelion speed and elliptical geometry are genuinely visible.
 */
export function computePlanetPosition(bodyId: BodyId, jd: number, exaggeratedEccentricity = 1.0): OrbitalPosition {
  const p = PLANET_DATA[bodyId];
  if (bodyId === 'sun' || p.modelDistance === 0) {
    return { x: 0, y: 0, z: 0, orbitAngleRad: 0, radiusAU: 0, modelRadius: 0 };
  }

  const daysSinceJ2000 = jd - J2000_JD;
  const meanMotion = TWO_PI / p.orbitalPeriodDays;
  const meanLon = p.meanLongitudeJ2000Deg * DEG2RAD + meanMotion * daysSinceJ2000;
  const periLon = p.perihelionLonDeg * DEG2RAD;
  const meanAnomaly = meanLon - periLon;

  const e = Math.min(0.65, p.eccentricity * exaggeratedEccentricity);
  const E = solveKepler(meanAnomaly, e);

  // True anomaly
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const trueAnomaly = Math.atan2(Math.sqrt(1 - e * e) * sinE, cosE - e);
  const heliocentricLon = periLon + trueAnomaly;

  // Vernal equinox alignment:
  // On March 21 (Earth heliocentric longitude ≈ 180° / π), we want orbitAngle = 0 (+X in Tellurion)
  const orbitAngleRad = ((heliocentricLon - Math.PI) % TWO_PI + TWO_PI) % TWO_PI;

  const rFactor = 1 - e * cosE;
  const radiusAU = p.semiMajorAxisAU * (1 - p.eccentricity * cosE);
  const modelR = p.modelDistance * rFactor;

  // 3D inclination relative to ecliptic plane (XZ plane in Three.js, +Y north)
  const incRad = p.inclinationDeg * DEG2RAD;
  const x = modelR * Math.cos(orbitAngleRad);
  const z = -modelR * Math.sin(orbitAngleRad);
  const y = modelR * Math.sin(orbitAngleRad) * Math.sin(incRad);

  return { x, y, z, orbitAngleRad, radiusAU, modelRadius: modelR };
}

/**
 * Computes Earth's Vernal-Equinox-based orbital angle (0 on ~21 March, π/2 on ~21 June)
 * directly from Kepler heliocentric position.
 */
export function getEarthEquinoxAngle(jd: number): number {
  return computePlanetPosition('earth', jd).orbitAngleRad;
}

export function getEquinoxDayOfYear(jd: number): number {
  const angle = getEarthEquinoxAngle(jd);
  return (angle / TWO_PI) * 365.25;
}

/**
 * Solar declination δ in degrees [-23.44°, +23.44°]
 */
export function computeSolarDeclinationDeg(jd: number): number {
  const angle = getEarthEquinoxAngle(jd);
  return Math.asin(Math.sin(23.44 * DEG2RAD) * Math.sin(angle)) * RAD2DEG;
}

export interface CitySolarMetrics {
  noonAltitudeDeg: number;
  daylightHours: number;
  daylightFormatted: string;
  polarState: 'normal' | 'midnight-sun' | 'polar-night';
}

export function computeCitySolarMetrics(latDeg: number, declDeg: number): CitySolarMetrics {
  const latRad = latDeg * DEG2RAD;
  const declRad = declDeg * DEG2RAD;
  const noonAltitudeDeg = Math.max(0, 90 - Math.abs(latDeg - declDeg));
  const cosH0 = -Math.tan(latRad) * Math.tan(declRad);

  if (cosH0 <= -1) {
    return {
      noonAltitudeDeg,
      daylightHours: 24,
      daylightFormatted: '24 sa (Kutup Gündüzü)',
      polarState: 'midnight-sun',
    };
  }
  if (cosH0 >= 1) {
    return {
      noonAltitudeDeg,
      daylightHours: 0,
      daylightFormatted: '0 sa (Kutup Gecesi)',
      polarState: 'polar-night',
    };
  }

  const daylightHours = (2 / 15) * Math.acos(cosH0) * RAD2DEG;
  const hrs = Math.floor(daylightHours);
  let mins = Math.round((daylightHours - hrs) * 60);
  const adjHrs = mins === 60 ? hrs + 1 : hrs;
  if (mins === 60) mins = 0;

  return {
    noonAltitudeDeg,
    daylightHours,
    daylightFormatted: `${adjHrs} sa ${String(mins).padStart(2, '0')} dk`,
    polarState: 'normal',
  };
}

export type EclipseType = 'none' | 'solar' | 'lunar';

export interface LunarState {
  synodicAge: number; // 0 = New Moon, 0.5 = Full Moon
  illuminationPct: number;
  phaseName: string;
  draconicAngleRad: number;
  eclipticLatDeg: number;
  eclipseType: EclipseType;
  eclipseIntensity: number; // 0..1
}

const MOON_PHASE_NAMES = [
  'Yeni Ay',
  'Hilal (Büyüyen)',
  'İlk Dördün',
  'Şişkin Ay',
  'Dolunay',
  'Şişkin Ay (Küçülen)',
  'Son Dördün',
  'Hilal (Son)',
];

export function computeLunarState(jd: number): LunarState {
  const synodicCycles = (jd - NEW_MOON_REF_JD) / SYNODIC_MONTH;
  const synodicAge = ((synodicCycles % 1) + 1) % 1;
  const phaseAngle = synodicAge * TWO_PI;
  const illuminationPct = Math.round(((1 - Math.cos(phaseAngle)) / 2) * 100);
  const phaseIdx = Math.floor((synodicAge + 1 / 16) * 8) % 8;

  const draconicCycles = (jd - LUNAR_NODE_REF_JD) / DRACONIC_MONTH;
  const draconicAngleRad = (((draconicCycles % 1) + 1) % 1) * TWO_PI;
  const eclipticLatDeg = Math.sin(draconicAngleRad) * MOON_INCLINATION_DEG;

  const distFromNew = Math.min(synodicAge, 1 - synodicAge);
  const distFromFull = Math.abs(synodicAge - 0.5);
  const absLat = Math.abs(eclipticLatDeg);

  let eclipseType: EclipseType = 'none';
  let eclipseIntensity = 0;

  if (distFromNew < 0.025 && absLat < 1.55) {
    eclipseType = 'solar';
    eclipseIntensity = Math.max(0, 1 - distFromNew / 0.025) * Math.max(0, 1 - absLat / 1.55);
  } else if (distFromFull < 0.028 && absLat < 1.35) {
    eclipseType = 'lunar';
    eclipseIntensity = Math.max(0, 1 - distFromFull / 0.028) * Math.max(0, 1 - absLat / 1.35);
  }

  return {
    synodicAge,
    illuminationPct,
    phaseName: MOON_PHASE_NAMES[phaseIdx],
    draconicAngleRad,
    eclipticLatDeg,
    eclipseType,
    eclipseIntensity,
  };
}

export function getNorthernSeason(equinoxDay: number): { name: string; colorClass: string } {
  const d = ((equinoxDay % 365.25) + 365.25) % 365.25;
  // Exact ecliptic longitude quadrants: 0° (0), 90° (91.3125), 180° (182.625), 270° (273.9375)
  if (d < 91.3125) return { name: 'İlkbahar', colorClass: 'text-emerald-400' };
  if (d < 182.625) return { name: 'Yaz', colorClass: 'text-amber-400' };
  if (d < 273.9375) return { name: 'Sonbahar', colorClass: 'text-orange-400' };
  return { name: 'Kış', colorClass: 'text-sky-400' };
}

export function getSeasonForLatitude(
  equinoxDay: number,
  latDeg: number
): { name: string; colorClass: string; hemisphereLabel: string } {
  const isSouth = latDeg < 0;
  const shiftedDay = isSouth ? equinoxDay + 182.625 : equinoxDay;
  const season = getNorthernSeason(shiftedDay);
  return {
    ...season,
    hemisphereLabel: isSouth ? 'Güney Y.K.' : 'Kuzey Y.K.',
  };
}

export function formatTurkishDate(date: Date): string {
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
