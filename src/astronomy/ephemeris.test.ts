import { describe, expect, it } from 'vitest';
import {
  computeCitySolarMetrics,
  computeLunarState,
  computePlanetPosition,
  computeSolarDeclinationDeg,
  dateToJulianDate,
  getEquinoxDayOfYear,
  getSeasonForLatitude,
  solveKepler,
} from './ephemeris';

describe('Astronomy & Kepler Ephemeris Engine', () => {
  it('solves Kepler equation accurately for high eccentricity (Mercury)', () => {
    const e = 0.2056;
    const M = 1.234;
    const E = solveKepler(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 6);
  });

  it('computes accurate solar declination at equinoxes and solstices', () => {
    const marchEq = dateToJulianDate(new Date('2026-03-20T14:46:00Z'));
    const juneSol = dateToJulianDate(new Date('2026-06-21T08:24:00Z'));
    const decSol = dateToJulianDate(new Date('2026-12-21T20:50:00Z'));

    expect(Math.abs(computeSolarDeclinationDeg(marchEq))).toBeLessThan(1.5);
    expect(computeSolarDeclinationDeg(juneSol)).toBeGreaterThan(22.8);
    expect(computeSolarDeclinationDeg(decSol)).toBeLessThan(-22.8);
  });

  it('shows Earth closer and faster at January perihelion than July aphelion (Kepler 2nd Law)', () => {
    const jan = computePlanetPosition('earth', dateToJulianDate(new Date('2026-01-03T12:00:00Z')));
    const jul = computePlanetPosition('earth', dateToJulianDate(new Date('2026-07-04T12:00:00Z')));
    expect(jan.radiusAU).toBeLessThan(0.986);
    expect(jul.radiusAU).toBeGreaterThan(1.014);
    expect(jan.speedKmS).toBeGreaterThan(30.1);
    expect(jul.speedKmS).toBeLessThan(29.5);
  });

  it('computes accurate daylight hours for Istanbul and Arctic', () => {
    const istEquinox = computeCitySolarMetrics(41.0, 0);
    expect(istEquinox.daylightHours).toBeCloseTo(12, 1);
    expect(istEquinox.noonAltitudeDeg).toBeCloseTo(49, 1);

    const istSummer = computeCitySolarMetrics(41.0, 23.44);
    expect(istSummer.daylightHours).toBeGreaterThan(14.8);
    expect(istSummer.daylightHours).toBeLessThan(15.2);

    const tromsoSummer = computeCitySolarMetrics(69.65, 23.44);
    expect(tromsoSummer.polarState).toBe('midnight-sun');
    expect(tromsoSummer.daylightHours).toBe(24);
  });

  it('detects lunar phase cycle and solar eclipse alignment on 12 Aug 2026', () => {
    const eclipseJD = dateToJulianDate(new Date('2026-08-12T17:47:00Z'));
    const lunar = computeLunarState(eclipseJD);
    expect(lunar.illuminationPct).toBeLessThan(3);
    expect(lunar.phaseName).toBe('Yeni Ay');
  });

  it('detects Total Lunar Eclipse (Blood Moon) on 3 Mar 2026 and opposite Southern Hemisphere seasons', () => {
    const bloodMoonJD = dateToJulianDate(new Date('2026-03-03T11:33:00Z'));
    const lunar = computeLunarState(bloodMoonJD);
    expect(lunar.illuminationPct).toBeGreaterThan(97);
    expect(lunar.eclipseType).toBe('lunar');

    const juneDay = getEquinoxDayOfYear(dateToJulianDate(new Date('2026-06-21T12:00:00Z')));
    expect(getSeasonForLatitude(juneDay, 41.0).name).toBe('Yaz');
    expect(getSeasonForLatitude(juneDay, -33.9).name).toBe('Kış');
    expect(getSeasonForLatitude(juneDay, -33.9).hemisphereLabel).toBe('Güney Y.K.');
  });

  it('projects real-sky constellation RA/Dec coordinates accurately onto celestial sphere', async () => {
    const { CONSTELLATIONS, raDecToEclipticVec3 } = await import('./constellations');
    expect(CONSTELLATIONS.length).toBeGreaterThanOrEqual(12);
    const v = raDecToEclipticVec3(5.92, 7.41, 760); // Betelgeuse
    expect(v.length()).toBeCloseTo(760, 2);
  });
});
