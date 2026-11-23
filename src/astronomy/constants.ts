export type BodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

export type SimMode = 'tellurion' | 'solar' | 'comparison';
export type CameraPreset = 'default' | 'sun' | 'earth' | 'top' | 'surface' | 'body';

export interface CelestialBodyData {
  id: BodyId;
  name: string;
  badge: string;
  desc: string;
  dayText: string;
  yearText: string;
  realScaleText: string;
  modelScaleText: string;
  realRadiusEarth: number;
  modelRadius: number;
  modelDistance: number;
  semiMajorAxisAU: number;
  eccentricity: number;
  inclinationDeg: number;
  orbitalPeriodDays: number;
  meanLongitudeJ2000Deg: number;
  perihelionLonDeg: number;
  rotSpeed: number;
  tiltDeg: number;
  hasRings?: boolean;
  color: string;
}

export interface CityLocation {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
}

export interface GuidedTourStep {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  mode: SimMode;
  targetBody: BodyId;
  cameraPreset: CameraPreset;
  dateISO: string;
  showTropics?: boolean;
  showLightBeam?: boolean;
}

export const J2000_JD = 2451545.0;
export const SYNODIC_MONTH = 29.530588853;
export const DRACONIC_MONTH = 27.212220817;
export const MOON_INCLINATION_DEG = 5.145;
export const NEW_MOON_REF_JD = 2451550.09765; // 6 Jan 2000 18:14 UTC
export const LUNAR_NODE_REF_JD = 2451565.16;

export const PLANET_DATA: Record<BodyId, CelestialBodyData> = {
  sun: {
    id: 'sun',
    name: 'Güneş',
    badge: 'G2V Yıldız',
    desc: 'Sistemin merkezindeki anakol yıldızı. 5.500 °C fotosferi ve nükleer füzyon enerjisiyle tüm gezegenlere ısı, ışık ve kütleçekim sağlar.',
    dayText: '25.4 Gün',
    yearText: '—',
    realScaleText: '109x Dünya',
    modelScaleText: '3.50 Birim',
    realRadiusEarth: 109.1,
    modelRadius: 3.5,
    modelDistance: 0,
    semiMajorAxisAU: 0,
    eccentricity: 0,
    inclinationDeg: 0,
    orbitalPeriodDays: 1,
    meanLongitudeJ2000Deg: 0,
    perihelionLonDeg: 0,
    rotSpeed: 0.06,
    tiltDeg: 7.25,
    color: '#f59e0b',
  },
  mercury: {
    id: 'mercury',
    name: 'Merkür',
    badge: '0.38x Dünya',
    desc: 'Güneş\'e en yakın ve en dışmerkezli (e=0.206) yörüngeye sahip gezegen. İnce ekzosferi nedeniyle gece -180 °C, gündüz +430 °C arasında değişir.',
    dayText: '58.6 Gün',
    yearText: '87.97 Gün',
    realScaleText: '0.38x Dünya',
    modelScaleText: '0.45 Birim',
    realRadiusEarth: 0.383,
    modelRadius: 0.45,
    modelDistance: 7.6,
    semiMajorAxisAU: 0.387,
    eccentricity: 0.2056,
    inclinationDeg: 7.0,
    orbitalPeriodDays: 87.969,
    meanLongitudeJ2000Deg: 252.25,
    perihelionLonDeg: 77.46,
    rotSpeed: 0.8,
    tiltDeg: 0.03,
    color: '#94a3b8',
  },
  venus: {
    id: 'venus',
    name: 'Venüs',
    badge: '0.95x Dünya',
    desc: '177.3° eksen eğikliği nedeniyle ters yönde (retrograd) döner. Yoğun CO₂ atmosferi güçlü sera etkisiyle yüzeyini 465 °C\'de tutar.',
    dayText: '243 Gün (Ters)',
    yearText: '224.7 Gün',
    realScaleText: '0.95x Dünya',
    modelScaleText: '0.88 Birim',
    realRadiusEarth: 0.949,
    modelRadius: 0.88,
    modelDistance: 10.6,
    semiMajorAxisAU: 0.723,
    eccentricity: 0.0068,
    inclinationDeg: 3.39,
    orbitalPeriodDays: 224.701,
    meanLongitudeJ2000Deg: 181.98,
    perihelionLonDeg: 131.53,
    rotSpeed: 0.5,
    tiltDeg: 177.3,
    color: '#f59e0b',
  },
  earth: {
    id: 'earth',
    name: 'Dünya (Yer)',
    badge: '1.0x Ref',
    desc: '23.44° eksen eğikliği ve hafif eliptik yörüngesi (e=0.0167) ile mevsimlerin ve sıvı su döngüsünün sürdüğü gezegenimiz.',
    dayText: '23 sa 56 dk',
    yearText: '365.256 Gün',
    realScaleText: '1.0x (12.742 km)',
    modelScaleText: '1.00 Birim',
    realRadiusEarth: 1.0,
    modelRadius: 1.0,
    modelDistance: 14.5,
    semiMajorAxisAU: 1.0,
    eccentricity: 0.0167,
    inclinationDeg: 0.0,
    orbitalPeriodDays: 365.2422, // Tropikal yıl (ekinoks & gündönümü hizası)
    meanLongitudeJ2000Deg: 100.46,
    perihelionLonDeg: 102.94,
    rotSpeed: 12.0,
    tiltDeg: 23.44,
    color: '#38bdf8',
  },
  moon: {
    id: 'moon',
    name: 'Ay (Uydu)',
    badge: '0.27x Dünya',
    desc: 'Dünya\'nın doğal uydusu. Ekliptiğe göre 5.14° eğik yörüngede döner; düğüm hizalanmasında Güneş tutulması gölgesi ve Ay tutulmasında kızıl Ay oluşur.',
    dayText: '27.3 Gün',
    yearText: '29.53g Kavuşum',
    realScaleText: '0.27x Dünya',
    modelScaleText: '0.32 Birim',
    realRadiusEarth: 0.2725,
    modelRadius: 0.32,
    modelDistance: 3.6,
    semiMajorAxisAU: 0.00257,
    eccentricity: 0.0549,
    inclinationDeg: 5.145,
    orbitalPeriodDays: 27.32166,
    meanLongitudeJ2000Deg: 218.32,
    perihelionLonDeg: 83.35,
    rotSpeed: 1.0,
    tiltDeg: 6.68,
    color: '#cbd5e1',
  },
  mars: {
    id: 'mars',
    name: 'Mars',
    badge: '0.53x Dünya',
    desc: 'Kızıl Gezegen. Belirgin dışmerkezliği (e=0.093) ve 25.2° eksen eğikliği nedeniyle kuzey ve güney yarımküre mevsim süreleri farklıdır.',
    dayText: '24 sa 37 dk',
    yearText: '687 Gün',
    realScaleText: '0.53x Dünya',
    modelScaleText: '0.62 Birim',
    realRadiusEarth: 0.532,
    modelRadius: 0.62,
    modelDistance: 19.2,
    semiMajorAxisAU: 1.524,
    eccentricity: 0.0934,
    inclinationDeg: 1.85,
    orbitalPeriodDays: 686.98,
    meanLongitudeJ2000Deg: 355.45,
    perihelionLonDeg: 336.04,
    rotSpeed: 11.5,
    tiltDeg: 25.19,
    color: '#ef4444',
  },
  jupiter: {
    id: 'jupiter',
    name: 'Jüpiter',
    badge: '11.2x Dünya',
    desc: 'Güneş Sistemi\'nin en büyük gaz devi. 10 saatten kısa eksen dönüşüyle belirgin fırtına kuşakları ve Büyük Kırmızı Leke\'yi oluşturur.',
    dayText: '9 sa 55 dk',
    yearText: '11.86 Yıl',
    realScaleText: '11.2x Dünya',
    modelScaleText: '2.25 Birim',
    realRadiusEarth: 11.209,
    modelRadius: 2.25,
    modelDistance: 26.5,
    semiMajorAxisAU: 5.204,
    eccentricity: 0.0489,
    inclinationDeg: 1.31,
    orbitalPeriodDays: 4332.59,
    meanLongitudeJ2000Deg: 34.4,
    perihelionLonDeg: 14.75,
    rotSpeed: 24.0,
    tiltDeg: 3.13,
    color: '#d97706',
  },
  saturn: {
    id: 'saturn',
    name: 'Satürn',
    badge: '9.4x Dünya',
    desc: 'Cassini Bölünmesi\'ni içeren buz ve kaya halkalarıyla tanınan gaz devi. 26.7° eğikliği sayesinde halkaları yörünge boyunca farklı açılarla görünür.',
    dayText: '10 sa 33 dk',
    yearText: '29.45 Yıl',
    realScaleText: '9.45x Dünya',
    modelScaleText: '1.90 Birim',
    realRadiusEarth: 9.449,
    modelRadius: 1.9,
    modelDistance: 34.0,
    semiMajorAxisAU: 9.582,
    eccentricity: 0.0565,
    inclinationDeg: 2.49,
    orbitalPeriodDays: 10759.22,
    meanLongitudeJ2000Deg: 49.94,
    perihelionLonDeg: 92.43,
    rotSpeed: 21.0,
    tiltDeg: 26.73,
    hasRings: true,
    color: '#eab308',
  },
  uranus: {
    id: 'uranus',
    name: 'Uranüs',
    badge: '4.0x Dünya',
    desc: '97.8° eksen eğikliğiyle yörüngesinde yan yatmış biçimde yuvarlanan buz devi. Her kutbu 42 yıl boyunca kesintisiz gündüz veya gece yaşar.',
    dayText: '17 sa 14 dk',
    yearText: '84.0 Yıl',
    realScaleText: '4.0x Dünya',
    modelScaleText: '1.35 Birim',
    realRadiusEarth: 4.007,
    modelRadius: 1.35,
    modelDistance: 41.0,
    semiMajorAxisAU: 19.218,
    eccentricity: 0.0457,
    inclinationDeg: 0.77,
    orbitalPeriodDays: 30688.5,
    meanLongitudeJ2000Deg: 313.23,
    perihelionLonDeg: 170.96,
    rotSpeed: 15.0,
    tiltDeg: 97.77,
    color: '#06b6d4',
  },
  neptune: {
    id: 'neptune',
    name: 'Neptün',
    badge: '3.9x Dünya',
    desc: 'Güneş\'e en uzak gezegen. Metan zengini derin mavi atmosferinde saatte 2.100 km\'yi aşan süpersonik rüzgarlar eser.',
    dayText: '16 sa 06 dk',
    yearText: '164.8 Yıl',
    realScaleText: '3.88x Dünya',
    modelScaleText: '1.30 Birim',
    realRadiusEarth: 3.883,
    modelRadius: 1.3,
    modelDistance: 47.5,
    semiMajorAxisAU: 30.11,
    eccentricity: 0.0113,
    inclinationDeg: 1.77,
    orbitalPeriodDays: 60182.0,
    meanLongitudeJ2000Deg: 304.88,
    perihelionLonDeg: 44.97,
    rotSpeed: 16.0,
    tiltDeg: 28.32,
    color: '#3b82f6',
  },
};

export const SOLAR_PLANET_KEYS: BodyId[] = [
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
];

export const CITIES: CityLocation[] = [
  { id: 'istanbul', name: 'İstanbul', label: 'İstanbul (41°K)', lat: 41.01, lon: 28.97 },
  { id: 'ankara', name: 'Ankara', label: 'Ankara (40°K)', lat: 39.93, lon: 32.85 },
  { id: 'equator', name: 'Ekvator', label: 'Ekvator (0°)', lat: 0.0, lon: 28.97 },
  { id: 'tromso', name: 'Tromsø', label: 'Tromsø (70°K)', lat: 69.65, lon: 18.95 },
  { id: 'sydney', name: 'Sidney', label: 'Sidney (34°G)', lat: -33.87, lon: 151.21 },
  { id: 'northpole', name: 'Kuzey Kutbu', label: 'Kuzey Kutbu (90°K)', lat: 89.5, lon: 0.0 },
];

export const GUIDED_TOURS: GuidedTourStep[] = [
  {
    id: 'seasons',
    title: 'Mevsimlerin Sırrı: 23.4° Eğiklik',
    subtitle: 'Adım 1 / 5 · Yaz Gündönümü',
    body: '21 Haziran\'da Kuzey Kutbu Güneş\'e eğiktir. Yengeç Dönencesi (23.4°K) Güneş ışınlarını dik alır; İstanbul\'da gündüz ~15 saate, Kuzey Kutup Dairesi\'nde 24 saate çıkar.',
    mode: 'tellurion',
    targetBody: 'earth',
    cameraPreset: 'earth',
    dateISO: '2026-06-21T12:00:00Z',
    showTropics: true,
    showLightBeam: true,
  },
  {
    id: 'perihelion',
    title: 'Günberi: Kışın Güneş\'e Daha Yakınız',
    subtitle: 'Adım 2 / 5 · Kepler Eliptik Yörüngesi',
    body: 'Dünya 3 Ocak civarında Güneş\'e en yakın (0.983 AU) konumdadır. Buna rağmen Kuzey Yarımküre\'de kış yaşanır; çünkü mevsimleri mesafe değil eksen eğikliği belirler.',
    mode: 'solar',
    targetBody: 'earth',
    cameraPreset: 'top',
    dateISO: '2026-01-03T12:00:00Z',
    showTropics: false,
    showLightBeam: false,
  },
  {
    id: 'eclipses',
    title: 'Neden Her Ay Tutulma Olmaz?',
    subtitle: 'Adım 3 / 5 · 5.14° Ay Yörünge Eğikliği',
    body: 'Ay yörüngesi ekliptik düzleme göre 5.14° eğiktir. Tutulmalar yalnızca Ay\'ın düğüm noktalarına yakın Yeni Ay veya Dolunay anlarında gerçekleşir; Güneş tutulmasında gölge Dünya\'ya düşer.',
    mode: 'tellurion',
    targetBody: 'moon',
    cameraPreset: 'earth',
    dateISO: '2026-08-12T17:47:00Z',
    showTropics: false,
    showLightBeam: true,
  },
  {
    id: 'retrograde',
    title: 'Ters Dönen Venüs & Yan Yatık Uranüs',
    subtitle: 'Adım 4 / 5 · Eksen Anomalileri',
    body: 'Venüs 177.3° eğikliğiyle saat yönünde (ters) döner; Uranüs ise 97.8° eğikliğiyle yörüngesinde adeta yan yatmış bir varil gibi yuvarlanır.',
    mode: 'solar',
    targetBody: 'uranus',
    cameraPreset: 'body',
    dateISO: '2026-09-23T12:00:00Z',
    showTropics: false,
    showLightBeam: false,
  },
  {
    id: 'comparison',
    title: 'Gerçek Boyut Karşılaştırması',
    subtitle: 'Adım 5 / 5 · Güneş 109x Dünya',
    body: 'Yörünge modunda gezegenler görünürlük için büyütülür. Bu karşılaştırma diziliminde ise tüm gezegenleri gerçek çap oranlarına yakın görürsün: Jüpiter Dünya\'nın 11.2 katı, Güneş ise 109 katıdır.',
    mode: 'comparison',
    targetBody: 'jupiter',
    cameraPreset: 'default',
    dateISO: '2026-03-21T12:00:00Z',
    showTropics: false,
    showLightBeam: false,
  },
];
