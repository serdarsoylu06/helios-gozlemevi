import * as THREE from 'three';

export interface ConstellationDef {
  id: string;
  name: string;
  latin: string;
  /** Array of line segments, each segment is [[raHours1, decDeg1], [raHours2, decDeg2]] */
  segments: [[number, number], [number, number]][];
  /** Label anchor [raHours, decDeg] */
  center: [number, number];
}

/**
 * Converts equatorial Right Ascension (hours 0..24) & Declination (deg -90..+90)
 * to 3D Cartesian coordinates on a celestial sphere of given radius,
 * tilted by Earth's 23.44° obliquity into the ecliptic coordinate frame.
 */
export function raDecToEclipticVec3(raHours: number, decDeg: number, radius: number): THREE.Vector3 {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = THREE.MathUtils.degToRad(decDeg);
  const cosDec = Math.cos(dec);

  // Equatorial Cartesian
  const xEq = radius * cosDec * Math.cos(ra);
  const yEq = radius * Math.sin(dec);
  const zEq = -radius * cosDec * Math.sin(ra);

  // Rotate around X axis by -23.44° to align with ecliptic plane
  const obl = THREE.MathUtils.degToRad(-23.44);
  const cosO = Math.cos(obl);
  const sinO = Math.sin(obl);

  const yEcl = yEq * cosO - zEq * sinO;
  const zEcl = yEq * sinO + zEq * cosO;

  return new THREE.Vector3(xEq, yEcl, zEcl);
}

/**
 * Curated real-sky catalog of prominent northern, southern, and Zodiac constellations
 * with J2000 bright-star RA/Dec coordinates.
 */
export const CONSTELLATIONS: ConstellationDef[] = [
  {
    id: 'orion',
    name: 'Avcı',
    latin: 'ORION',
    center: [5.58, 2.0],
    segments: [
      [[5.92, 7.41], [5.42, 6.35]],   // Betelgeuse - Bellatrix
      [[5.92, 7.41], [5.68, -1.94]],  // Betelgeuse - Alnitak
      [[5.42, 6.35], [5.53, -0.30]],  // Bellatrix - Mintaka
      [[5.53, -0.30], [5.60, -1.20]], // Mintaka - Alnilam
      [[5.60, -1.20], [5.68, -1.94]], // Alnilam - Alnitak
      [[5.53, -0.30], [5.24, -8.20]], // Mintaka - Rigel
      [[5.68, -1.94], [5.80, -9.67]], // Alnitak - Saiph
      [[5.24, -8.20], [5.80, -9.67]], // Rigel - Saiph
    ],
  },
  {
    id: 'ursa-major',
    name: 'Büyük Ayı',
    latin: 'URSA MAJOR',
    center: [12.1, 56.5],
    segments: [
      [[11.06, 61.75], [11.03, 56.38]], // Dubhe - Merak
      [[11.03, 56.38], [11.90, 53.69]], // Merak - Phecda
      [[11.90, 53.69], [12.26, 57.03]], // Phecda - Megrez
      [[12.26, 57.03], [11.06, 61.75]], // Megrez - Dubhe
      [[12.26, 57.03], [12.90, 55.96]], // Megrez - Alioth
      [[12.90, 55.96], [13.40, 54.93]], // Alioth - Mizar
      [[13.40, 54.93], [13.79, 49.31]], // Mizar - Alkaid
    ],
  },
  {
    id: 'cassiopeia',
    name: 'Kraliçe',
    latin: 'CASSIOPEIA',
    center: [1.0, 60.0],
    segments: [
      [[0.15, 59.15], [0.68, 56.54]], // Caph - Schedar
      [[0.68, 56.54], [0.95, 60.72]], // Schedar - Gamma Cas
      [[0.95, 60.72], [1.43, 60.24]], // Gamma Cas - Ruchbah
      [[1.43, 60.24], [1.91, 63.67]], // Ruchbah - Segin
    ],
  },
  {
    id: 'cygnus',
    name: 'Kuğu',
    latin: 'CYGNUS',
    center: [20.37, 40.2],
    segments: [
      [[20.69, 45.28], [20.37, 40.26]], // Deneb - Sadr
      [[20.37, 40.26], [19.51, 27.96]], // Sadr - Albireo
      [[19.75, 45.13], [20.37, 40.26]], // Delta Cyg - Sadr
      [[20.37, 40.26], [20.77, 33.97]], // Sadr - Gienah
    ],
  },
  {
    id: 'leo',
    name: 'Aslan',
    latin: 'LEO',
    center: [10.6, 17.5],
    segments: [
      [[10.14, 11.97], [10.12, 16.76]], // Regulus - Eta Leo
      [[10.12, 16.76], [10.33, 19.84]], // Eta Leo - Algieba
      [[10.33, 19.84], [10.28, 23.42]], // Algieba - Adhafera
      [[10.28, 23.42], [9.88, 26.01]],  // Adhafera - Rasalas
      [[10.33, 19.84], [11.24, 20.52]], // Algieba - Zosma
      [[11.24, 20.52], [11.82, 14.57]], // Zosma - Denebola
      [[11.82, 14.57], [11.24, 15.43]], // Denebola - Chertan
      [[11.24, 15.43], [10.14, 11.97]], // Chertan - Regulus
    ],
  },
  {
    id: 'taurus',
    name: 'Boğa',
    latin: 'TAURUS',
    center: [4.6, 17.0],
    segments: [
      [[4.60, 16.51], [4.48, 15.63]], // Aldebaran - Theta Tau
      [[4.48, 15.63], [4.33, 15.62]], // Gamma Tau
      [[4.33, 15.62], [4.48, 19.18]], // Ain
      [[4.48, 19.18], [5.44, 28.61]], // Ain - Elnath
      [[4.60, 16.51], [5.63, 21.14]], // Aldebaran - Zeta Tau
    ],
  },
  {
    id: 'gemini',
    name: 'İkizler',
    latin: 'GEMINI',
    center: [7.1, 24.0],
    segments: [
      [[7.58, 31.89], [7.76, 28.03]], // Castor - Pollux
      [[7.58, 31.89], [6.73, 25.13]], // Castor - Mebsuta
      [[6.73, 25.13], [6.38, 22.51]], // Mebsuta - Tejat
      [[7.76, 28.03], [7.34, 21.98]], // Pollux - Wasat
      [[7.34, 21.98], [6.63, 16.40]], // Wasat - Alhena
    ],
  },
  {
    id: 'scorpius',
    name: 'Akrep',
    latin: 'SCORPIUS',
    center: [16.8, -30.0],
    segments: [
      [[16.09, -19.81], [16.01, -22.62]], // Graffias - Dschubba
      [[16.01, -22.62], [16.49, -26.43]], // Dschubba - Antares
      [[16.49, -26.43], [16.84, -34.29]], // Antares - Epsilon Sco
      [[16.84, -34.29], [17.20, -43.24]], // Epsilon Sco - Eta Sco
      [[17.20, -43.24], [17.62, -42.99]], // Eta Sco - Sargas
      [[17.62, -42.99], [17.56, -37.10]], // Sargas - Shaula
    ],
  },
  {
    id: 'sagittarius',
    name: 'Yay',
    latin: 'SAGITTARIUS',
    center: [18.8, -28.0],
    segments: [
      [[18.40, -34.38], [18.47, -25.42]], // Kaus Australis - Kaus Borealis
      [[18.47, -25.42], [18.92, -26.30]], // Kaus Borealis - Nunki
      [[18.92, -26.30], [19.04, -29.88]], // Nunki - Ascella
      [[19.04, -29.88], [18.40, -34.38]], // Ascella - Kaus Australis
      [[18.40, -34.38], [18.10, -30.42]], // Teapot spout
      [[18.10, -30.42], [18.35, -29.83]],
    ],
  },
  {
    id: 'virgo',
    name: 'Başak',
    latin: 'VIRGO',
    center: [13.2, -3.0],
    segments: [
      [[13.42, -11.16], [12.69, -1.45]],  // Spica - Porrima
      [[12.69, -1.45], [13.04, 10.96]],   // Porrima - Vindemiatrix
      [[12.69, -1.45], [11.84, 1.76]],    // Porrima - Zavijava
      [[13.42, -11.16], [13.58, -0.60]],  // Spica - Heze
      [[13.58, -0.60], [13.04, 10.96]],   // Heze - Vindemiatrix
    ],
  },
  {
    id: 'pegasus',
    name: 'Kanatlı At',
    latin: 'PEGASUS',
    center: [23.3, 21.0],
    segments: [
      [[23.08, 15.21], [23.06, 28.08]], // Markab - Scheat
      [[23.06, 28.08], [0.14, 29.09]],  // Scheat - Alpheratz
      [[0.14, 29.09], [0.22, 15.18]],   // Alpheratz - Algenib
      [[0.22, 15.18], [23.08, 15.21]],  // Algenib - Markab
    ],
  },
  {
    id: 'lyra',
    name: 'Çalgı',
    latin: 'LYRA',
    center: [18.8, 36.0],
    segments: [
      [[18.62, 38.78], [18.83, 33.36]], // Vega - Sheliak
      [[18.83, 33.36], [18.98, 32.69]], // Sheliak - Sulafat
      [[18.98, 32.69], [18.91, 36.90]], // Sulafat - Delta Lyr
      [[18.91, 36.90], [18.62, 38.78]], // Delta Lyr - Vega
    ],
  },
  {
    id: 'aquila',
    name: 'Kartal',
    latin: 'AQUILA',
    center: [19.8, 7.0],
    segments: [
      [[19.77, 10.61], [19.85, 8.87]],  // Tarazed - Altair
      [[19.85, 8.87], [19.92, 6.41]],   // Altair - Alshain
      [[19.85, 8.87], [19.09, 13.86]],  // Altair - Zeta Aql
      [[19.85, 8.87], [20.19, -0.82]],  // Altair - Theta Aql
    ],
  },
  {
    id: 'crux',
    name: 'Güney Haçı',
    latin: 'CRUX',
    center: [12.45, -60.0],
    segments: [
      [[12.44, -63.10], [12.52, -57.11]], // Acrux - Gacrux
      [[12.25, -58.75], [12.80, -59.69]], // Delta Cru - Mimosa
    ],
  },
];
