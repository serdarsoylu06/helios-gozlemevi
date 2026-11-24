import * as THREE from 'three';

export const TEXTURE_URLS = {
  earthDay: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_atmos_2048.jpg',
  earthSpecular: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_specular_2048.jpg',
  earthClouds: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/earth_clouds_1024.png',
  moon: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r169/examples/textures/planets/moon_1024.jpg',
};

export function createCoronaGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0.0, 'rgba(255, 251, 235, 0.95)');
  grad.addColorStop(0.18, 'rgba(253, 224, 71, 0.65)');
  grad.addColorStop(0.42, 'rgba(249, 115, 22, 0.24)');
  grad.addColorStop(0.7, 'rgba(220, 38, 38, 0.06)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(canvas);
}

export function createEarthFallbackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const ocean = ctx.createLinearGradient(0, 0, 0, 512);
  ocean.addColorStop(0, '#cbd5e1');
  ocean.addColorStop(0.12, '#0c4a6e');
  ocean.addColorStop(0.5, '#075985');
  ocean.addColorStop(0.88, '#0c4a6e');
  ocean.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, 1024, 512);

  const lands: [number, number, number, number, string][] = [
    [210, 150, 75, 50, '#2f6f4e'],
    [295, 315, 45, 65, '#256141'],
    [515, 145, 50, 35, '#3b7a57'],
    [530, 265, 55, 75, '#a18a52'],
    [685, 155, 105, 55, '#5a7d52'],
    [830, 355, 42, 32, '#9c6b43'],
  ];
  lands.forEach(([x, y, rx, ry, c]) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.15, 0, Math.PI * 2);
    ctx.fill();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural NASA-Black-Marble-inspired continental city lights map
 * aligned with equirectangular Earth coordinates (lon -180..+180 -> x 0..1024, lat +90..-90 -> y 0..512).
 */
export function createEarthNightLightsTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1024, 512);

  const latLonToXY = (lat: number, lon: number): [number, number] => [
    ((lon + 180) / 360) * 1024,
    ((90 - lat) / 180) * 512,
  ];

  // Major metropolitan & dense population corridors [lat, lon, radiusPx, density]
  const hubs: [number, number, number, number][] = [
    [41.0, 29.0, 16, 26],   // İstanbul & Marmara
    [39.9, 32.8, 12, 16],   // Ankara & Anadolu
    [48.8, 2.3, 28, 55],    // Western Europe
    [51.5, -0.1, 20, 40],   // UK
    [45.5, 11.5, 22, 42],   // Italy / Central Europe
    [55.7, 37.6, 22, 32],   // Moscow
    [30.0, 31.2, 14, 34],   // Nile Delta / Cairo
    [25.2, 55.3, 14, 24],   // Persian Gulf
    [28.6, 77.2, 36, 70],   // Northern India / Ganges
    [19.0, 72.8, 22, 40],   // Western India
    [31.2, 121.5, 34, 75],  // Eastern China
    [39.9, 116.4, 28, 55],  // Beijing / North China
    [35.7, 139.7, 22, 65],  // Japan / Korea
    [40.7, -74.0, 32, 70],  // US East Coast
    [41.8, -87.6, 26, 45],  // US Midwest
    [34.0, -118.2, 22, 42], // California
    [19.4, -99.1, 16, 26],  // Mexico City
    [-23.5, -46.6, 20, 32], // São Paulo / Rio
    [-34.6, -58.4, 14, 22], // Buenos Aires
    [-33.8, 151.2, 14, 22], // Sydney / SE Australia
    [-26.2, 28.0, 14, 20],  // Johannesburg
    [6.5, 3.4, 14, 22],     // Lagos / West Africa
  ];

  hubs.forEach(([lat, lon, spread, count], hIdx) => {
    const [cx, cy] = latLonToXY(lat, lon);
    // Soft regional glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, spread);
    glow.addColorStop(0, 'rgba(255, 205, 110, 0.55)');
    glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.18)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, spread, 0, Math.PI * 2);
    ctx.fill();

    // Individual sparkling city dots
    for (let i = 0; i < count; i++) {
      const seed = hIdx * 100 + i;
      const a = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1 * Math.PI * 2;
      const r = Math.pow(((Math.sin(seed * 78.233) * 24634.6345) % 1 + 1) % 1, 0.65) * spread;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 0.72;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 244, 200, 0.95)' : 'rgba(251, 191, 36, 0.75)';
      ctx.fillRect(px, py, 1.8, 1.8);
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCalendarDialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const cx = 512;
  const cy = 512;

  const dayToAngle = (d: number) => -Math.PI / 2 - (d / 365.25) * Math.PI * 2;

  ctx.fillStyle = '#090e1a';
  ctx.beginPath();
  ctx.arc(cx, cy, 508, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d4a656';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 498, 0, Math.PI * 2);
  ctx.stroke();

  const seasons = [
    { name: 'İLKBAHAR', color: '#14532d', accent: '#4ade80', startDay: 0, endDay: 92 },
    { name: 'YAZ', color: '#7c2d12', accent: '#fbbf24', startDay: 92, endDay: 186 },
    { name: 'SONBAHAR', color: '#78350f', accent: '#fb923c', startDay: 186, endDay: 275 },
    { name: 'KIŞ', color: '#1e3a5f', accent: '#38bdf8', startDay: 275, endDay: 365.25 },
  ];

  seasons.forEach((s) => {
    const aStart = dayToAngle(s.startDay);
    const aEnd = dayToAngle(s.endDay);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 368, aEnd, aStart);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(212, 166, 86, 0.72)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 364, aEnd, aStart);
    ctx.lineWidth = 6;
    ctx.strokeStyle = s.accent;
    ctx.stroke();
  });

  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(476, 0);
    ctx.lineTo(494, 0);
    ctx.strokeStyle = i % 6 === 0 ? 'rgba(212, 166, 86, 0.85)' : 'rgba(148, 163, 184, 0.32)';
    ctx.lineWidth = i % 6 === 0 ? 2.5 : 1.2;
    ctx.stroke();
    ctx.restore();
  }

  const monthSectors = [
    { name: 'NİSAN', start: 11, end: 41 },
    { name: 'MAYIS', start: 41, end: 72 },
    { name: 'HAZİRAN', start: 72, end: 102 },
    { name: 'TEMMUZ', start: 102, end: 133 },
    { name: 'AĞUSTOS', start: 133, end: 164 },
    { name: 'EYLÜL', start: 164, end: 194 },
    { name: 'EKİM', start: 194, end: 225 },
    { name: 'KASIM', start: 225, end: 255 },
    { name: 'ARALIK', start: 255, end: 286 },
    { name: 'OCAK', start: 286, end: 317 },
    { name: 'ŞUBAT', start: 317, end: 345 },
    { name: 'MART', start: 345, end: 376.25 },
  ];

  monthSectors.forEach((m) => {
    const angle = dayToAngle(m.start);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(368, 0);
    ctx.lineTo(494, 0);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const midAngle = dayToAngle((m.start + m.end) / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 24px Space Grotesk, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, 0, -418);
    ctx.restore();
  });

  seasons.forEach((s) => {
    const midAngle = dayToAngle((s.startDay + s.endDay) / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 24px Space Grotesk, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.name, 0, -295);
    ctx.restore();
  });

  const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 224);
  grad.addColorStop(0, '#334155');
  grad.addColorStop(0.65, '#1e293b');
  grad.addColorStop(0.95, '#0f172a');
  grad.addColorStop(1, '#d4a656');
  ctx.beginPath();
  ctx.arc(cx, cy, 224, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#d4a656';
  ctx.stroke();

  ctx.fillStyle = '#d4a656';
  ctx.font = '600 19px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HELIOS · EKLİPTİK TAKVİM', cx, cy + 146);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createDetailedPlanetTexture(key: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const palettes: Record<string, string[]> = {
    mercury: ['#6b7280', '#9ca3af', '#4b5563', '#d1d5db'],
    venus: ['#b45309', '#d97706', '#f59e0b', '#fde68a'],
    mars: ['#7c2d12', '#c2410c', '#ea580c', '#9a3412'],
    jupiter: ['#92400e', '#d97706', '#fef3c7', '#b45309'],
    saturn: ['#a16207', '#eab308', '#fef08a', '#ca8a04'],
    uranus: ['#0e7490', '#22d3ee', '#67e8f9', '#0891b2'],
    neptune: ['#1e3a8a', '#2563eb', '#3b82f6', '#1d4ed8'],
    moon: ['#64748b', '#94a3b8', '#cbd5e1', '#475569'],
  };
  const pal = palettes[key] || palettes.moon;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, pal[0]);
  grad.addColorStop(0.3, pal[1]);
  grad.addColorStop(0.5, pal[2]);
  grad.addColorStop(0.75, pal[1]);
  grad.addColorStop(1, pal[0]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  if (['jupiter', 'saturn', 'venus', 'uranus', 'neptune'].includes(key)) {
    const bandCount = key === 'jupiter' ? 28 : 16;
    for (let i = 0; i < bandCount; i++) {
      const y = (i / bandCount) * 512;
      const h = 512 / bandCount;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)';
      ctx.fillRect(0, y, 1024, h * 0.65);
    }
  }

  const featureCount = key === 'mercury' || key === 'moon' ? 95 : 32;
  for (let i = 0; i < featureCount; i++) {
    const x = ((i * 137.5) % 980) + 22;
    const y = ((i * 73.1) % 440) + 36;
    const rx = 10 + (i % 24);
    const ry = key === 'jupiter' || key === 'saturn' ? rx * 0.32 : rx * 0.85;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (key === 'mars') {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
    ctx.fillRect(0, 0, 1024, 24);
    ctx.fillRect(0, 492, 1024, 20);
  }

  if (key === 'jupiter') {
    const spot = ctx.createRadialGradient(520, 325, 8, 520, 325, 68);
    spot.addColorStop(0, '#991b1b');
    spot.addColorStop(0.55, '#dc2626');
    spot.addColorStop(0.85, '#f59e0b');
    spot.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.ellipse(520, 325, 68, 38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSaturnRingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0.0, 'rgba(202, 138, 4, 0.0)');
  grad.addColorStop(0.12, 'rgba(217, 179, 106, 0.35)');
  grad.addColorStop(0.28, 'rgba(253, 230, 138, 0.88)');
  grad.addColorStop(0.54, 'rgba(234, 179, 8, 0.82)');
  grad.addColorStop(0.60, 'rgba(15, 23, 42, 0.05)');
  grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.05)');
  grad.addColorStop(0.70, 'rgba(245, 208, 130, 0.72)');
  grad.addColorStop(0.92, 'rgba(217, 179, 106, 0.42)');
  grad.addColorStop(1.0, 'rgba(217, 179, 106, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
