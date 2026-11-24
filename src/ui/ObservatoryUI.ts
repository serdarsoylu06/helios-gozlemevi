import {
  ASTRONOMICAL_EVENTS,
  BodyId,
  CameraPreset,
  CITIES,
  GUIDED_TOURS,
  PLANET_DATA,
  SimMode,
} from '../astronomy/constants';
import {
  computeCitySolarMetrics,
  computeLunarState,
  computePlanetPosition,
  computeSolarDeclinationDeg,
  dateToJulianDate,
  formatTurkishDate,
  getEducationalInsight,
  getEquinoxDayOfYear,
  getSeasonForLatitude,
  julianDateToDate,
} from '../astronomy/ephemeris';
import { AppState, DrawerTab, store } from '../state/store';

const ICON_PAUSE =
  '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const ICON_PLAY =
  '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

interface PaletteItem {
  id: string;
  group: string;
  label: string;
  meta: string;
  keywords: string;
  action: () => void;
}

export class ObservatoryUI {
  private root: HTMLElement;
  private onFocusCamera: (preset: CameraPreset, bodyId?: BodyId) => void;
  private onSnapshot: () => void;
  private lastDateKey = '';
  private lastMoonKey = '';
  private lastEclipseKey = '';
  private paletteItems: PaletteItem[] = [];
  private filteredPalette: PaletteItem[] = [];
  private paletteSelectedIndex = 0;

  constructor(
    root: HTMLElement,
    onFocusCamera: (preset: CameraPreset, bodyId?: BodyId) => void,
    onSnapshot: () => void
  ) {
    this.root = root;
    this.onFocusCamera = onFocusCamera;
    this.onSnapshot = onSnapshot;
    this.buildPaletteItems();
    this.renderShell();
    this.bindEvents();
    store.subscribe((state, changed) => this.sync(state, changed));
    this.sync(store.get(), new Set(Object.keys(store.get()) as (keyof AppState)[]));
  }

  private buildPaletteItems(): void {
    const items: PaletteItem[] = [];

    // 1. Celestial Bodies
    (Object.keys(PLANET_DATA) as BodyId[]).forEach((id) => {
      const p = PLANET_DATA[id];
      items.push({
        id: `body-${id}`,
        group: 'Gök Cisimleri',
        label: p.name,
        meta: p.realScaleText,
        keywords: `${p.name} ${id} gezegen yörünge`.toLowerCase(),
        action: () => {
          const isInner = id === 'sun' || id === 'earth' || id === 'moon' || id === 'iss';
          const nextMode: SimMode =
            !isInner && store.get().mode === 'tellurion' ? 'solar' : store.get().mode;
          const preset: CameraPreset =
            id === 'sun' ? 'sun' : id === 'earth' ? 'earth' : 'body';
          store.set({
            mode: nextMode,
            selectedBody: id,
            cameraPreset: preset,
            commandPaletteOpen: false,
            activeDrawerTab: 'body',
          });
          this.onFocusCamera(preset, id);
        },
      });
    });

    // 2. Astronomical Events (2026-2030)
    ASTRONOMICAL_EVENTS.forEach((ev) => {
      items.push({
        id: `ev-${ev.id}`,
        group: 'Tutulma & Olaylar',
        label: ev.title,
        meta: ev.shortDate,
        keywords: `${ev.title} ${ev.shortDate} tutulma ekinoks gündönümü kanlı ay`.toLowerCase(),
        action: () => {
          store.set({
            mode: 'tellurion',
            isPlaying: false,
            jd: dateToJulianDate(new Date(ev.dateISO)),
            selectedBody: ev.targetBody,
            cameraPreset: 'earth',
            commandPaletteOpen: false,
            activeDrawerTab: 'ephemeris',
          });
          this.onFocusCamera('earth', ev.targetBody);
        },
      });
    });

    // 3. Cities
    CITIES.forEach((c) => {
      items.push({
        id: `city-${c.id}`,
        group: 'Konumlar',
        label: c.label,
        meta: 'Yüzey Odağı',
        keywords: `${c.name} ${c.label} şehir konum pin`.toLowerCase(),
        action: () => {
          store.set({
            mode: 'tellurion',
            selectedCityId: c.id,
            customPin: null,
            selectedBody: 'earth',
            cameraPreset: 'surface',
            commandPaletteOpen: false,
            activeDrawerTab: 'location',
          });
          this.onFocusCamera('surface', 'earth');
        },
      });
    });

    // 4. Modes
    const modes: { id: SimMode; label: string; meta: string }[] = [
      { id: 'tellurion', label: 'Tellurion Modu', meta: 'Kısayol: 1' },
      { id: 'solar', label: 'Tüm Güneş Sistemi', meta: 'Kısayol: 2' },
      { id: 'comparison', label: 'Boyut Karşılaştırması (109x)', meta: 'Kısayol: 3' },
    ];
    modes.forEach((m) => {
      items.push({
        id: `mode-${m.id}`,
        group: 'Görünüm Modları',
        label: m.label,
        meta: m.meta,
        keywords: `${m.label} mod görünüm`.toLowerCase(),
        action: () => {
          store.set({
            mode: m.id,
            cameraPreset: 'default',
            activeTourIndex: null,
            commandPaletteOpen: false,
          });
        },
      });
    });

    this.paletteItems = items;
    this.filteredPalette = items;
  }

  private renderShell(): void {
    const cityOptions = CITIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');
    const eventRows = ASTRONOMICAL_EVENTS.map((ev) => {
      const tagColor =
        ev.category === 'solar-eclipse'
          ? 'text-amber-300 border-amber-400/30 bg-amber-500/10'
          : ev.category === 'lunar-eclipse'
            ? 'text-rose-300 border-rose-400/30 bg-rose-500/10'
            : 'text-slate-300 border-white/10 bg-white/5';
      return `
        <button data-jump="${ev.dateISO}" data-target="${ev.targetBody}" class="jump-btn w-full text-left px-2.5 py-2 rounded-xl obs-subcard hover:border-amber-400/40 hover:bg-white/[0.04] transition flex items-center justify-between gap-2 group">
          <div class="min-w-0">
            <div class="text-[11px] font-medium text-slate-200 group-hover:text-amber-200 truncate">${ev.title}</div>
            <div class="text-[9.5px] text-slate-400 truncate mt-0.5">${ev.desc}</div>
          </div>
          <span class="text-[9.5px] font-mono-num px-1.5 py-0.5 rounded-md border shrink-0 ${tagColor}">${ev.shortDate}</span>
        </button>
      `;
    }).join('');

    const planetQuickChips = (Object.keys(PLANET_DATA) as BodyId[])
      .map(
        (id) => `
          <button data-body-pick="${id}" class="body-pick-btn px-2 py-1 rounded-lg text-[10px] font-medium obs-subcard hover:border-amber-400/45 text-slate-300 hover:text-white transition flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${PLANET_DATA[id].color}"></span>
            <span>${PLANET_DATA[id].name.split(' ')[0]}</span>
          </button>
        `
      )
      .join('');

    this.root.innerHTML = `
      <!-- Sinematik Açılış Perdesi -->
      <div id="intro-overlay" class="fixed inset-0 z-50 bg-[#02040a] flex flex-col items-center justify-center gap-4 pointer-events-auto">
        <div class="w-12 h-12 rounded-2xl border border-amber-400/35 bg-amber-500/10 flex items-center justify-center shadow-[0_0_40px_rgba(232,184,90,0.2)]">
          <svg class="w-6 h-6 text-amber-300 animate-spin" style="animation-duration:16s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
          </svg>
        </div>
        <div class="text-center">
          <div class="font-display text-sm font-semibold tracking-[0.28em] text-amber-100">HELIOS GÖZLEMEVİ</div>
          <div class="text-[11px] font-mono-num text-slate-400 mt-1">Kepler Efemeris &amp; 2K Uydu Dokuları Hazırlanıyor</div>
        </div>
        <div class="w-40 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full w-2/3 bg-gradient-to-r from-transparent via-amber-300 to-transparent animate-pulse"></div>
        </div>
      </div>

      <!-- Üst Minimal Gözlemevi Barı -->
      <header class="absolute top-3 left-3 right-3 md:top-4 md:left-5 md:right-5 flex items-center justify-between gap-2 pointer-events-none">
        <!-- Sol Marka + Canlı Tarih Damgası -->
        <div class="obs-glass px-3 py-1.5 rounded-xl pointer-events-auto flex items-center gap-2.5">
          <div class="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center shrink-0">
            <svg class="w-3.5 h-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
            </svg>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-display text-xs font-bold tracking-[0.14em] text-white">HELIOS</span>
            <span class="h-3 w-px bg-white/15 hidden sm:inline-block"></span>
            <span id="ui-top-date" class="hidden sm:inline text-[11px] font-mono-num text-amber-200/90">21 Mart 2026</span>
            <span id="ui-tex-badge" class="hidden lg:inline-flex items-center gap-1 text-[9.5px] font-mono-num uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/10">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>2K
            </span>
          </div>
        </div>

        <!-- Orta Mod Seçici -->
        <div class="obs-glass p-1 rounded-full pointer-events-auto flex items-center gap-0.5" role="group" aria-label="Simülasyon Modu">
          <button data-mode="tellurion" class="mode-btn px-3 py-1 rounded-full text-[11px] font-semibold transition-all">Tellurion</button>
          <button data-mode="solar" class="mode-btn px-3 py-1 rounded-full text-[11px] font-semibold transition-all">Güneş Sistemi</button>
          <button data-mode="comparison" class="mode-btn px-3 py-1 rounded-full text-[11px] font-semibold transition-all">109x</button>
        </div>

        <!-- Sağ Hızlı Aksiyonlar -->
        <div class="obs-glass p-1 rounded-xl pointer-events-auto flex items-center gap-0.5">
          <button id="btn-open-palette" title="Hızlı Arama (Ctrl+K)" aria-label="Hızlı Arama" class="px-2.5 py-1.5 rounded-lg text-[11px] font-mono-num text-slate-300 hover:text-white hover:bg-white/10 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-amber-300/90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <span class="hidden md:inline text-slate-400">⌘K</span>
          </button>
          <button id="btn-snapshot" title="Yüksek Çözünürlüklü PNG Kaydet" aria-label="Ekran Görüntüsü Al" class="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
          </button>
          <button id="btn-start-tour" title="Rehberli Tur" aria-label="Rehberli Tur" class="px-2 py-1.5 rounded-lg text-[11px] font-medium text-amber-200 hover:bg-amber-400/15 transition flex items-center gap-1">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
            <span class="hidden lg:inline">Tur</span>
          </button>
          <button id="btn-presentation" title="Sunum / Planetaryum Modu (H)" aria-label="Sunum Modu" class="px-2 py-1.5 rounded-lg text-[11px] font-mono-num text-slate-300 hover:text-white hover:bg-white/10 transition">
            H
          </button>
        </div>
      </header>

      <!-- Sol İnce İkon Şeridi + Tek Sekmeli Cam Çekmece -->
      <aside class="absolute top-16 md:top-20 left-3 md:left-5 bottom-24 pointer-events-none flex items-start gap-2.5 z-20">
        <!-- İnce İkon Şeridi (Rail) -->
        <nav class="obs-glass p-1.5 rounded-2xl pointer-events-auto flex flex-col gap-1" aria-label="Gözlemevi Araçları">
          <button data-tab="ephemeris" title="Efemeris & Tutulmalar" aria-label="Efemeris ve Tutulmalar" class="rail-btn">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </button>
          <button data-tab="location" title="Konum, Pin & Gündüz Süresi" aria-label="Konum ve Pin" class="rail-btn">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </button>
          <button data-tab="body" title="Seçili Gök Cismi Telemetrisi" aria-label="Gök Cismi" class="rail-btn">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="7"/><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-24 12 12)"/></svg>
          </button>
          <button data-tab="layers" title="Kamera & Görsel Katmanlar" aria-label="Katmanlar ve Kamera" class="rail-btn">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </button>
        </nav>

        <!-- Açılır Tek Cam Çekmece -->
        <div id="obs-drawer" class="hidden obs-glass rounded-2xl pointer-events-auto w-[290px] sm:w-[320px] max-h-full flex flex-col overflow-hidden">
          <div class="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 shrink-0">
            <span id="ui-drawer-title" class="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-amber-300/90">Efemeris</span>
            <button id="btn-close-drawer" aria-label="Paneli kapat" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition text-xs">✕</button>
          </div>

          <div class="hud-scroll overflow-y-auto p-3.5 space-y-3">
            <!-- SEKME 1: EFEMERİS & TUTULMALAR -->
            <div data-panel="ephemeris" class="drawer-panel space-y-2.5">
              <div class="flex items-center justify-between text-[10px] font-mono-num text-slate-400">
                <span>YÖRÜNGE VERİSİ</span>
                <span id="ui-earth-au" class="text-amber-200/90">1.000 AU · 29.8 km/s</span>
              </div>

              <div class="flex items-center gap-1.5">
                <input id="ui-date-picker" type="date" aria-label="Simülasyon tarihi" class="obs-input flex-1 min-w-0 text-[10.5px] font-mono-num rounded-lg px-2 py-1.5" />
                <input id="ui-time-picker" type="time" aria-label="Simülasyon saati (UTC)" class="obs-input w-[76px] text-[10.5px] font-mono-num rounded-lg px-2 py-1.5" />
                <button id="btn-live-now" class="px-2.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-[10px] font-semibold text-amber-200 transition shrink-0">Şu An</button>
              </div>

              <div class="grid grid-cols-3 gap-1.5">
                <div class="obs-subcard p-2 rounded-xl">
                  <div class="text-[9px] text-slate-400 uppercase">Tarih</div>
                  <div id="ui-date-text" class="text-[11px] font-semibold text-white mt-0.5 truncate">21 Mart</div>
                </div>
                <div class="obs-subcard p-2 rounded-xl">
                  <div id="ui-hemisphere-label" class="text-[9px] text-slate-400 uppercase">Kuzey Y.K.</div>
                  <div id="ui-season-text" class="text-[11px] font-semibold text-amber-200 mt-0.5 truncate">İlkbahar</div>
                </div>
                <div class="obs-subcard p-2 rounded-xl">
                  <div class="text-[9px] text-slate-400 uppercase">Deklinasyon</div>
                  <div id="ui-decl-text" class="text-[11px] font-mono-num font-semibold text-slate-100 mt-0.5">+0.0°</div>
                </div>
              </div>

              <!-- Ay Evresi -->
              <div class="obs-subcard p-2.5 rounded-xl flex items-center gap-3">
                <svg viewBox="0 0 40 40" class="w-9 h-9 shrink-0" aria-hidden="true">
                  <circle cx="20" cy="20" r="17" fill="#090e1c" stroke="rgba(232,184,90,0.3)" stroke-width="1.2"/>
                  <path id="ui-moon-lit" d="" fill="#e2e8f0"/>
                </svg>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-[9px] text-slate-400 uppercase tracking-wider">Ay Evresi · 5.14°</span>
                    <span id="ui-moon-pct" class="text-[10px] font-mono-num text-amber-200">%0</span>
                  </div>
                  <div id="ui-moon-name" class="text-xs font-semibold text-slate-100 truncate mt-0.5">Yeni Ay</div>
                </div>
              </div>

              <div id="ui-eclipse-alert" class="hidden text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border text-center" role="status" aria-live="polite"></div>

              <div id="ui-edu-insight" class="text-[10.5px] text-slate-300 leading-relaxed obs-subcard border-l-2 border-l-amber-400/70 px-2.5 py-2 rounded-lg">
                Güneş ışınları Ekvator'a dik düşüyor.
              </div>

              <div class="pt-1">
                <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1.5">2026–2030 Tutulma &amp; Olaylar</div>
                <div class="space-y-1.5">${eventRows}</div>
              </div>
            </div>

            <!-- SEKME 2: KONUM & PİN -->
            <div data-panel="location" class="drawer-panel hidden space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <label for="ui-city-select" class="text-[10px] text-slate-400 uppercase font-semibold">Gözlem Konumu</label>
                <select id="ui-city-select" aria-label="Şehir seçimi" class="obs-input text-[11px] rounded-lg px-2 py-1">
                  ${cityOptions}
                </select>
              </div>

              <div id="ui-custom-pin-bar" class="hidden flex items-center justify-between gap-1 text-[10px] font-mono-num bg-amber-400/15 text-amber-200 border border-amber-400/35 px-2.5 py-1 rounded-lg">
                <span id="ui-custom-pin-text" class="truncate"></span>
                <button id="btn-clear-pin" aria-label="Özel pini kaldır" class="text-amber-200 hover:text-white">✕</button>
              </div>

              <div class="obs-subcard p-3 rounded-xl">
                <div class="flex items-center gap-3">
                  <svg viewBox="0 0 110 56" class="w-[106px] h-[52px] shrink-0 overflow-visible" aria-hidden="true">
                    <defs>
                      <linearGradient id="sunArcG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#e8b85a" stop-opacity="0.34"/>
                        <stop offset="100%" stop-color="#e8b85a" stop-opacity="0.0"/>
                      </linearGradient>
                    </defs>
                    <line x1="6" y1="48" x2="104" y2="48" stroke="rgba(148,163,184,0.32)" stroke-width="1"/>
                    <path d="M 12 48 A 43 43 0 0 1 98 48" fill="none" stroke="rgba(148,163,184,0.14)" stroke-width="1" stroke-dasharray="2 2"/>
                    <path id="ui-arc-fill" d="M 12 48 Q 55 10 98 48 Z" fill="url(#sunArcG)"/>
                    <path id="ui-arc-path" d="M 12 48 Q 55 10 98 48" fill="none" stroke="#e8b85a" stroke-width="1.8" stroke-linecap="round"/>
                    <circle id="ui-arc-sun" cx="55" cy="24" r="4" fill="#fde68a" stroke="#fffbeb" stroke-width="1.2"/>
                    <text x="6" y="55" fill="#64748b" font-size="7" font-family="JetBrains Mono">D</text>
                    <text x="98" y="55" fill="#64748b" font-size="7" font-family="JetBrains Mono">B</text>
                  </svg>
                  <div class="flex-1 flex flex-col gap-1.5 text-[11px]">
                    <div class="flex justify-between"><span class="text-[10px] text-slate-400">Gündüz</span><strong id="ui-daylight" class="font-mono-num text-amber-200">12 sa 00 dk</strong></div>
                    <div class="flex justify-between"><span class="text-[10px] text-slate-400">Öğle Açısı</span><strong id="ui-noon-alt" class="font-mono-num text-slate-100">49.0°</strong></div>
                  </div>
                </div>
              </div>

              <button data-cam="surface" class="cam-btn w-full py-2 px-3 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-xs font-semibold text-amber-100 transition flex items-center justify-center gap-2">
                <span>Yüzeyden Bakışa Geç (Pin)</span>
              </button>

              <p class="text-[10px] text-slate-400 leading-relaxed">
                İpucu: Dünya seçiliyken küre üzerinde herhangi bir noktaya tıklayarak kendi enlem/boylam pinini bırakabilirsin.
              </p>
            </div>

            <!-- SEKME 3: SEÇİLİ GÖK CİSMİ -->
            <div data-panel="body" class="drawer-panel hidden space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <span id="ui-body-dot" class="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0"></span>
                  <h2 id="ui-body-name" class="font-display text-sm font-bold text-white truncate">Dünya (Yer)</h2>
                </div>
                <span id="ui-body-badge" class="text-[10px] font-mono-num bg-white/[0.06] text-amber-200 border border-white/10 px-2 py-0.5 rounded-md shrink-0">1.0x Ref</span>
              </div>

              <p id="ui-body-desc" class="text-[11px] text-slate-300 leading-relaxed"></p>

              <div class="grid grid-cols-2 gap-1.5 text-[11px]">
                <div class="obs-subcard px-2.5 py-2 rounded-xl"><span class="text-[9px] text-slate-400 uppercase block">Kendi Ekseni</span><strong id="ui-body-day" class="text-slate-100 font-mono-num"></strong></div>
                <div class="obs-subcard px-2.5 py-2 rounded-xl"><span class="text-[9px] text-slate-400 uppercase block">Yörünge (Yıl)</span><strong id="ui-body-year" class="text-slate-100 font-mono-num"></strong></div>
                <div class="obs-subcard px-2.5 py-2 rounded-xl"><span class="text-[9px] text-slate-400 uppercase block">Gerçek Çap</span><strong id="ui-body-real" class="text-amber-200 font-mono-num"></strong></div>
                <div class="obs-subcard px-2.5 py-2 rounded-xl"><span class="text-[9px] text-slate-400 uppercase block">Model Ölçeği</span><strong id="ui-body-model" class="text-slate-200 font-mono-num"></strong></div>
              </div>

              <div>
                <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Hızlı Hedef Seç</div>
                <div class="flex flex-wrap gap-1.5">${planetQuickChips}</div>
              </div>
            </div>

            <!-- SEKME 4: KATMANLAR & KAMERA -->
            <div data-panel="layers" class="drawer-panel hidden space-y-3">
              <div>
                <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Kamera Odağı</div>
                <div class="grid grid-cols-2 gap-1.5">
                  <button data-cam="sun" class="cam-btn px-2.5 py-2 rounded-xl obs-subcard hover:border-amber-400/45 text-[11px] font-medium text-left text-slate-200 hover:text-white transition">Güneş</button>
                  <button data-cam="earth" class="cam-btn px-2.5 py-2 rounded-xl obs-subcard hover:border-amber-400/45 text-[11px] font-medium text-left text-slate-200 hover:text-white transition">Dünya</button>
                  <button data-cam="surface" class="cam-btn px-2.5 py-2 rounded-xl obs-subcard hover:border-amber-400/45 text-[11px] font-medium text-left text-slate-200 hover:text-white transition">Yüzey (Pin)</button>
                  <button data-cam="top" class="cam-btn px-2.5 py-2 rounded-xl obs-subcard hover:border-amber-400/45 text-[11px] font-medium text-left text-slate-200 hover:text-white transition">Kuşbakışı</button>
                </div>
              </div>

              <div class="border-t border-white/10 pt-2.5 space-y-1">
                <div class="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">Görsel Katmanlar</div>
                <label class="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-200 cursor-pointer"><span>Reticle Etiketler</span><input id="sw-labels" type="checkbox" checked class="hud-switch" /></label>
                <label class="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-200 cursor-pointer"><span>Takımyıldızlar</span><input id="sw-constellations" type="checkbox" checked class="hud-switch" /></label>
                <label class="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-200 cursor-pointer"><span>Güneş Huzmesi</span><input id="sw-beam" type="checkbox" checked class="hud-switch" /></label>
                <label class="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-200 cursor-pointer"><span>Bulut, Gölge &amp; Aurora</span><input id="sw-clouds" type="checkbox" checked class="hud-switch" /></label>
                <label class="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-200 cursor-pointer"><span>Dönence, K/G &amp; Işınlar</span><input id="sw-tropics" type="checkbox" class="hud-switch" /></label>
                <label class="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-200 cursor-pointer"><span>Gerçek Gün Hızı</span><input id="sw-realspin" type="checkbox" class="hud-switch" /></label>
                <label class="flex items-center justify-between gap-2 py-1 text-[11.5px] text-slate-200 cursor-pointer"><span>Mekanik Ses</span><input id="sw-sound" type="checkbox" class="hud-switch" /></label>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Rehberli Tur Kartı (Üst Orta) -->
      <div id="ui-tour-card" class="hidden absolute top-16 left-1/2 -translate-x-1/2 w-[92vw] max-w-md obs-glass p-4 rounded-2xl pointer-events-auto border border-amber-400/40 z-30">
        <div class="flex items-start justify-between gap-2 mb-1">
          <div>
            <div id="ui-tour-sub" class="text-[10px] font-mono-num uppercase tracking-wider text-amber-300"></div>
            <h3 id="ui-tour-title" class="font-display text-sm font-bold text-white mt-0.5"></h3>
          </div>
          <button id="btn-tour-close" aria-label="Turu kapat" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">✕</button>
        </div>
        <p id="ui-tour-body" class="text-xs text-slate-300 leading-relaxed mb-3"></p>
        <div class="flex items-center justify-between gap-2">
          <button id="btn-tour-prev" class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 transition">← Önceki</button>
          <button id="btn-tour-next" class="px-3.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-slate-950 transition">Sonraki →</button>
        </div>
      </div>

      <!-- Alt İnce Yüzen Zaman Çarkı (Floating Scrubber Dock) -->
      <footer class="absolute bottom-3 left-3 right-3 md:bottom-4 md:left-5 md:right-5 pointer-events-none flex justify-center z-20">
        <div class="obs-glass w-full max-w-3xl px-3.5 py-2.5 rounded-2xl pointer-events-auto flex flex-col gap-2">
          <div class="flex items-center gap-2.5">
            <button id="btn-play" class="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition active:scale-95 shrink-0">
              <span id="ui-play-icon" class="inline-flex">${ICON_PAUSE}</span>
              <span id="ui-play-text" class="hidden sm:inline">Duraklat</span>
            </button>
            <button id="btn-step-back" class="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-[10.5px] font-mono-num text-slate-300 transition shrink-0">-15g</button>
            <div class="flex-1 flex flex-col gap-0.5 min-w-0">
              <input id="timeline-slider" type="range" min="0" max="365.25" step="0.25" value="0" aria-label="Yıllık yörünge zaman çarkı" class="w-full" />
              <div class="flex justify-between text-[8.5px] font-mono-num text-slate-400 px-0.5">
                <span>21 MAR</span><span>21 HAZ</span><span>23 EYL</span><span>21 ARA</span><span>21 MAR</span>
              </div>
            </div>
            <button id="btn-step-fwd" class="px-2 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-[10.5px] font-mono-num text-slate-300 transition shrink-0">+15g</button>
          </div>

          <div class="flex items-center justify-between gap-4 pt-1 border-t border-white/[0.07] text-[10.5px]">
            <div class="flex items-center gap-2 flex-1 max-w-[200px]">
              <label for="ui-speed" class="text-slate-400 shrink-0">Hız</label>
              <input id="ui-speed" type="range" min="0.1" max="4" step="0.1" value="1.0" class="w-full" />
              <span id="ui-speed-val" class="font-mono-num text-amber-200 w-7 text-right">1.0x</span>
            </div>
            <div class="hidden md:flex items-center gap-2 text-[10px] font-mono-num text-slate-400">
              <span>Space: Oynat</span>
              <span>·</span>
              <span>⌘K: Ara</span>
              <span>·</span>
              <span>H: Sunum</span>
            </div>
            <div class="flex items-center gap-2 flex-1 max-w-[200px]">
              <label for="ui-scale" class="text-slate-400 shrink-0">Ölçek</label>
              <input id="ui-scale" type="range" min="0.6" max="1.8" step="0.1" value="1.0" class="w-full" />
              <span id="ui-scale-val" class="font-mono-num text-slate-200 w-7 text-right">1.0x</span>
            </div>
          </div>
        </div>
      </footer>

      <!-- Ctrl+K / ⌘K Hızlı Arama & Komut Paleti -->
      <div id="ui-command-palette" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[14vh] px-4 pointer-events-auto">
        <div class="obs-glass w-full max-w-lg rounded-2xl overflow-hidden border border-amber-400/30 shadow-2xl">
          <div class="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
            <svg class="w-4 h-4 text-amber-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input id="ui-palette-input" type="text" placeholder="Gezegen, şehir, tutulma veya mod ara... (örn. Satürn, 2027, İstanbul)" class="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none" autocomplete="off" />
            <kbd class="text-[10px] font-mono-num text-slate-400 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">ESC</kbd>
          </div>
          <div id="ui-palette-list" class="hud-scroll max-h-[340px] overflow-y-auto p-2 space-y-0.5"></div>
        </div>
      </div>

      <!-- Sunum / Planetaryum Modu Minimal Damgası -->
      <div id="ui-presentation-badge" class="hidden fixed bottom-5 left-5 z-40 pointer-events-auto obs-glass px-3.5 py-2 rounded-xl flex items-center gap-3">
        <div>
          <div id="ui-pres-date" class="text-xs font-semibold text-white">21 Mart 2026</div>
          <div id="ui-pres-sub" class="text-[10px] font-mono-num text-amber-200">İlkbahar · 1.000 AU</div>
        </div>
        <button id="btn-exit-presentation" class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-medium text-slate-200 transition">H · Arayüz</button>
      </div>
    `;
  }

  private renderPaletteResults(query: string): void {
    const q = query.trim().toLowerCase();
    this.filteredPalette = q
      ? this.paletteItems.filter((item) => item.keywords.includes(q))
      : this.paletteItems;
    this.paletteSelectedIndex = 0;

    const list = document.getElementById('ui-palette-list')!;
    if (this.filteredPalette.length === 0) {
      list.innerHTML = `<div class="px-3 py-6 text-center text-xs text-slate-400">Eşleşen hedef bulunamadı.</div>`;
      return;
    }

    list.innerHTML = this.filteredPalette
      .map(
        (item, idx) => `
        <button data-palette-idx="${idx}" class="palette-row w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-3 transition ${
          idx === this.paletteSelectedIndex
            ? 'bg-amber-400/15 border border-amber-400/35 text-white'
            : 'border border-transparent text-slate-300 hover:bg-white/[0.05]'
        }">
          <div class="min-w-0">
            <div class="text-xs font-medium truncate">${item.label}</div>
            <div class="text-[10px] text-slate-400">${item.group}</div>
          </div>
          <span class="text-[10px] font-mono-num text-amber-200/80 shrink-0">${item.meta}</span>
        </button>
      `
      )
      .join('');

    list.querySelectorAll<HTMLButtonElement>('.palette-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.paletteIdx);
        this.filteredPalette[idx]?.action();
      });
    });
  }

  private bindEvents(): void {
    // Mode switcher
    this.root.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as SimMode;
        store.set({ mode, cameraPreset: 'default', activeTourIndex: null });
      });
    });

    // Left rail tabs
    this.root.querySelectorAll<HTMLButtonElement>('.rail-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as DrawerTab;
        const current = store.get().activeDrawerTab;
        store.set({ activeDrawerTab: current === tab ? null : tab });
      });
    });

    document.getElementById('btn-close-drawer')!.addEventListener('click', () => {
      store.set({ activeDrawerTab: null });
    });

    // Camera buttons
    this.root.querySelectorAll<HTMLButtonElement>('.cam-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.cam as CameraPreset;
        if (preset === 'earth' || preset === 'surface') {
          store.set({ selectedBody: 'earth', cameraPreset: preset });
        } else if (preset === 'sun') {
          store.set({ selectedBody: 'sun', cameraPreset: preset });
        } else {
          store.set({ cameraPreset: preset });
        }
        this.onFocusCamera(preset);
      });
    });

    // Quick planet picker chips inside Body tab
    this.root.querySelectorAll<HTMLButtonElement>('.body-pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.bodyPick as BodyId;
        const isInner = id === 'sun' || id === 'earth' || id === 'moon' || id === 'iss';
        const nextMode: SimMode =
          !isInner && store.get().mode === 'tellurion' ? 'solar' : store.get().mode;
        const preset: CameraPreset = id === 'sun' ? 'sun' : id === 'earth' ? 'earth' : 'body';
        store.set({ mode: nextMode, selectedBody: id, cameraPreset: preset });
        this.onFocusCamera(preset, id);
      });
    });

    // Astronomical event jump buttons
    this.root.querySelectorAll<HTMLButtonElement>('.jump-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const iso = btn.dataset.jump;
        const target = (btn.dataset.target as BodyId) || 'earth';
        if (!iso) return;
        store.set({
          mode: 'tellurion',
          isPlaying: false,
          jd: dateToJulianDate(new Date(iso)),
          selectedBody: target,
        });
      });
    });

    // Date & Time pickers
    const datePicker = document.getElementById('ui-date-picker') as HTMLInputElement;
    const timePicker = document.getElementById('ui-time-picker') as HTMLInputElement;
    const applyDateTime = () => {
      if (!datePicker.value) return;
      const t = timePicker.value || '12:00';
      store.set({ isPlaying: false, jd: dateToJulianDate(new Date(`${datePicker.value}T${t}:00Z`)) });
    };
    datePicker.addEventListener('change', applyDateTime);
    timePicker.addEventListener('change', applyDateTime);

    document.getElementById('btn-live-now')!.addEventListener('click', () => {
      store.set({ isPlaying: false, jd: dateToJulianDate(new Date()) });
    });

    // City select & clear pin
    const citySelect = document.getElementById('ui-city-select') as HTMLSelectElement;
    citySelect.addEventListener('change', () => {
      store.set({ selectedCityId: citySelect.value, customPin: null });
    });

    document.getElementById('btn-clear-pin')!.addEventListener('click', () => {
      store.set({ customPin: null });
    });

    // Command Palette
    const paletteModal = document.getElementById('ui-command-palette')!;
    const paletteInput = document.getElementById('ui-palette-input') as HTMLInputElement;

    document.getElementById('btn-open-palette')!.addEventListener('click', () => {
      store.set({ commandPaletteOpen: !store.get().commandPaletteOpen });
    });

    paletteModal.addEventListener('click', (e) => {
      if (e.target === paletteModal) store.set({ commandPaletteOpen: false });
    });

    paletteInput.addEventListener('input', () => {
      this.renderPaletteResults(paletteInput.value);
    });

    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.paletteSelectedIndex = Math.min(
          this.filteredPalette.length - 1,
          this.paletteSelectedIndex + 1
        );
        this.highlightPaletteRow();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.paletteSelectedIndex = Math.max(0, this.paletteSelectedIndex - 1);
        this.highlightPaletteRow();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.filteredPalette[this.paletteSelectedIndex]?.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        store.set({ commandPaletteOpen: false });
      }
    });

    // Snapshot
    document.getElementById('btn-snapshot')!.addEventListener('click', () => {
      this.onSnapshot();
    });

    // Layer toggles
    const bindCheck = (id: string, key: keyof AppState) => {
      const el = document.getElementById(id) as HTMLInputElement;
      el.addEventListener('change', () => store.set({ [key]: el.checked } as Partial<AppState>));
    };
    bindCheck('sw-labels', 'showLabels');
    bindCheck('sw-constellations', 'showConstellations');
    bindCheck('sw-beam', 'showLightBeam');
    bindCheck('sw-clouds', 'showClouds');
    bindCheck('sw-tropics', 'showTropics');
    bindCheck('sw-realspin', 'useRealSpin');
    bindCheck('sw-sound', 'useSound');

    // Timeline & Playback
    document.getElementById('btn-play')!.addEventListener('click', () => {
      store.set({ isPlaying: !store.get().isPlaying });
    });

    document.getElementById('btn-step-back')!.addEventListener('click', () => {
      store.set({ isPlaying: false, jd: store.get().jd - 15 });
    });

    document.getElementById('btn-step-fwd')!.addEventListener('click', () => {
      store.set({ isPlaying: false, jd: store.get().jd + 15 });
    });

    const timeline = document.getElementById('timeline-slider') as HTMLInputElement;
    timeline.addEventListener('input', () => {
      const targetEqDay = parseFloat(timeline.value);
      const currentEqDay = getEquinoxDayOfYear(store.get().jd);
      let delta = targetEqDay - currentEqDay;
      if (delta > 182.625) delta -= 365.25;
      if (delta < -182.625) delta += 365.25;
      store.set({ isPlaying: false, jd: store.get().jd + delta });
    });

    const speedInput = document.getElementById('ui-speed') as HTMLInputElement;
    speedInput.addEventListener('input', () => {
      store.set({ simSpeed: parseFloat(speedInput.value) });
    });

    const scaleInput = document.getElementById('ui-scale') as HTMLInputElement;
    scaleInput.addEventListener('input', () => {
      store.set({ planetScale: parseFloat(scaleInput.value) });
    });

    // Guided Tour
    document.getElementById('btn-start-tour')!.addEventListener('click', () => {
      this.applyTourStep(0);
    });
    document.getElementById('btn-tour-close')!.addEventListener('click', () => {
      store.set({ activeTourIndex: null });
    });
    document.getElementById('btn-tour-prev')!.addEventListener('click', () => {
      const idx = store.get().activeTourIndex ?? 0;
      this.applyTourStep(Math.max(0, idx - 1));
    });
    document.getElementById('btn-tour-next')!.addEventListener('click', () => {
      const idx = store.get().activeTourIndex ?? 0;
      if (idx >= GUIDED_TOURS.length - 1) {
        store.set({ activeTourIndex: null });
      } else {
        this.applyTourStep(idx + 1);
      }
    });

    // Presentation / Planetarium Mode (H)
    document.getElementById('btn-presentation')!.addEventListener('click', () => {
      store.set({ presentationMode: !store.get().presentationMode });
    });
    document.getElementById('btn-exit-presentation')!.addEventListener('click', () => {
      store.set({ presentationMode: false });
    });
  }

  private highlightPaletteRow(): void {
    const rows = this.root.querySelectorAll<HTMLButtonElement>('.palette-row');
    rows.forEach((row, idx) => {
      const active = idx === this.paletteSelectedIndex;
      row.className = `palette-row w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-3 transition ${
        active
          ? 'bg-amber-400/15 border border-amber-400/35 text-white'
          : 'border border-transparent text-slate-300 hover:bg-white/[0.05]'
      }`;
      if (active) row.scrollIntoView({ block: 'nearest' });
    });
  }

  private applyTourStep(index: number): void {
    const step = GUIDED_TOURS[index];
    if (!step) return;
    store.set({
      activeTourIndex: index,
      mode: step.mode,
      selectedBody: step.targetBody,
      isPlaying: false,
      jd: dateToJulianDate(new Date(step.dateISO)),
      showTropics: step.showTropics ?? false,
      showLightBeam: step.showLightBeam ?? true,
      cameraPreset: step.cameraPreset,
      activeDrawerTab: null,
    });
    window.setTimeout(() => this.onFocusCamera(step.cameraPreset, step.targetBody), 60);
  }

  private sync(state: AppState, changed: Set<keyof AppState>): void {
    // Intro overlay
    if (changed.has('introReady')) {
      const intro = document.getElementById('intro-overlay');
      if (intro) intro.classList.toggle('is-hidden', state.introReady);
    }

    // Command Palette
    if (changed.has('commandPaletteOpen')) {
      const modal = document.getElementById('ui-command-palette')!;
      modal.classList.toggle('hidden', !state.commandPaletteOpen);
      if (state.commandPaletteOpen) {
        const input = document.getElementById('ui-palette-input') as HTMLInputElement;
        input.value = '';
        this.renderPaletteResults('');
        window.setTimeout(() => input.focus(), 20);
      }
    }

    // Drawer tab & rail state
    if (changed.has('activeDrawerTab')) {
      const drawer = document.getElementById('obs-drawer')!;
      const titleEl = document.getElementById('ui-drawer-title')!;
      const tabTitles: Record<Exclude<DrawerTab, null>, string> = {
        ephemeris: 'Kepler Efemeris',
        location: 'Konum & Pin',
        body: 'Gök Cismi Telemetrisi',
        layers: 'Kamera & Katmanlar',
      };

      drawer.classList.toggle('hidden', state.activeDrawerTab === null);
      if (state.activeDrawerTab) {
        titleEl.textContent = tabTitles[state.activeDrawerTab];
      }

      this.root.querySelectorAll<HTMLButtonElement>('.rail-btn').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.tab === state.activeDrawerTab);
      });
      this.root.querySelectorAll<HTMLElement>('.drawer-panel').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.panel !== state.activeDrawerTab);
      });
    }

    // Mode buttons
    if (changed.has('mode')) {
      this.root.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
        const active = btn.dataset.mode === state.mode;
        btn.className = active
          ? 'mode-btn px-3 py-1 rounded-full text-[11px] font-semibold transition-all bg-amber-400 text-slate-950 shadow-sm'
          : 'mode-btn px-3 py-1 rounded-full text-[11px] font-medium transition-all text-slate-300 hover:text-white hover:bg-white/5';
      });
    }

    // Texture badge
    if (changed.has('textureQuality')) {
      const badge = document.getElementById('ui-tex-badge');
      if (badge) {
        if (state.textureQuality === 'nasa-2k') {
          badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>NASA 2K';
        } else if (state.textureQuality === 'procedural') {
          badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>HD';
        }
      }
    }

    // Play/Pause
    if (changed.has('isPlaying')) {
      document.getElementById('ui-play-icon')!.innerHTML = state.isPlaying ? ICON_PAUSE : ICON_PLAY;
      document.getElementById('ui-play-text')!.textContent = state.isPlaying ? 'Duraklat' : 'Oynat';
    }

    // Speed & Scale readouts
    if (changed.has('simSpeed')) {
      (document.getElementById('ui-speed') as HTMLInputElement).value = String(state.simSpeed);
      document.getElementById('ui-speed-val')!.textContent = `${state.simSpeed.toFixed(1)}x`;
    }
    if (changed.has('planetScale')) {
      (document.getElementById('ui-scale') as HTMLInputElement).value = String(state.planetScale);
      document.getElementById('ui-scale-val')!.textContent = `${state.planetScale.toFixed(1)}x`;
    }

    // Layer checkboxes
    if (changed.has('showTropics')) {
      (document.getElementById('sw-tropics') as HTMLInputElement).checked = state.showTropics;
    }
    if (changed.has('showLightBeam')) {
      (document.getElementById('sw-beam') as HTMLInputElement).checked = state.showLightBeam;
    }
    if (changed.has('showConstellations')) {
      (document.getElementById('sw-constellations') as HTMLInputElement).checked =
        state.showConstellations;
    }

    // Selected body card
    if (changed.has('selectedBody')) {
      const p = PLANET_DATA[state.selectedBody];
      document.getElementById('ui-body-dot')!.style.background = p.color;
      document.getElementById('ui-body-name')!.textContent = p.name;
      document.getElementById('ui-body-badge')!.textContent = p.badge;
      document.getElementById('ui-body-desc')!.textContent = p.desc;
      document.getElementById('ui-body-day')!.textContent = p.dayText;
      document.getElementById('ui-body-year')!.textContent = p.yearText;
      document.getElementById('ui-body-real')!.textContent = p.realScaleText;
      document.getElementById('ui-body-model')!.textContent = p.modelScaleText;
    }

    // Custom pin bar
    if (changed.has('customPin') || changed.has('selectedCityId')) {
      const bar = document.getElementById('ui-custom-pin-bar')!;
      const txt = document.getElementById('ui-custom-pin-text')!;
      if (state.customPin) {
        bar.classList.remove('hidden');
        txt.textContent = state.customPin.label;
      } else {
        bar.classList.add('hidden');
      }
    }

    // Guided Tour card
    if (changed.has('activeTourIndex')) {
      const card = document.getElementById('ui-tour-card')!;
      if (state.activeTourIndex === null) {
        card.classList.add('hidden');
      } else {
        const step = GUIDED_TOURS[state.activeTourIndex];
        card.classList.remove('hidden');
        document.getElementById('ui-tour-sub')!.textContent = step.subtitle;
        document.getElementById('ui-tour-title')!.textContent = step.title;
        document.getElementById('ui-tour-body')!.textContent = step.body;
        document.getElementById('btn-tour-next')!.textContent =
          state.activeTourIndex >= GUIDED_TOURS.length - 1 ? 'Bitir ✓' : 'Sonraki →';
      }
    }

    // Presentation / Planetarium Mode (H)
    if (changed.has('presentationMode')) {
      const hide = state.presentationMode;
      this.root.querySelectorAll('header, aside, footer').forEach((el) => {
        el.classList.toggle('hidden', hide);
      });
      if (hide) {
        document.getElementById('ui-tour-card')?.classList.add('hidden');
        document.getElementById('ui-command-palette')?.classList.add('hidden');
      }
      document.getElementById('ui-presentation-badge')!.classList.toggle('hidden', !hide);
    }

    // Ephemeris & Telemetry updates
    if (
      changed.has('jd') ||
      changed.has('selectedCityId') ||
      changed.has('customPin') ||
      changed.has('presentationMode')
    ) {
      this.syncEphemeris(state);
    }
  }

  private syncEphemeris(state: AppState): void {
    const eqDay = getEquinoxDayOfYear(state.jd);
    (document.getElementById('timeline-slider') as HTMLInputElement).value = eqDay.toFixed(2);

    const date = julianDateToDate(state.jd);
    const isoDate = date.toISOString().slice(0, 10);
    const isoTime = date.toISOString().slice(11, 16);
    const activeLat = state.customPin
      ? state.customPin.lat
      : (CITIES.find((c) => c.id === state.selectedCityId) || CITIES[0]).lat;
    const dateKey = `${isoDate}-${isoTime}-${activeLat.toFixed(1)}`;

    if (dateKey !== this.lastDateKey) {
      this.lastDateKey = dateKey;
      const dateStr = formatTurkishDate(date);
      const season = getSeasonForLatitude(eqDay, activeLat);
      const decl = computeSolarDeclinationDeg(state.jd);
      const earthPos = computePlanetPosition('earth', state.jd, 1.0);

      document.getElementById('ui-top-date')!.textContent = dateStr;
      document.getElementById('ui-date-text')!.textContent = dateStr.replace(/ \d{4}$/, '');
      document.getElementById('ui-hemisphere-label')!.textContent = season.hemisphereLabel;
      const seasonEl = document.getElementById('ui-season-text')!;
      seasonEl.textContent = season.name;
      seasonEl.className = `text-[11px] font-semibold mt-0.5 truncate ${season.colorClass}`;
      document.getElementById('ui-decl-text')!.textContent = `${decl >= 0 ? '+' : ''}${decl.toFixed(1)}°`;
      document.getElementById('ui-earth-au')!.textContent =
        `${earthPos.radiusAU.toFixed(3)} AU · ${earthPos.speedKmS.toFixed(1)} km/s`;

      document.getElementById('ui-pres-date')!.textContent = dateStr;
      document.getElementById('ui-pres-sub')!.textContent =
        `${season.name} · ${earthPos.radiusAU.toFixed(3)} AU · ${earthPos.speedKmS.toFixed(1)} km/s`;

      const picker = document.getElementById('ui-date-picker') as HTMLInputElement;
      if (document.activeElement !== picker) picker.value = isoDate;
      const tPicker = document.getElementById('ui-time-picker') as HTMLInputElement;
      if (document.activeElement !== tPicker) tPicker.value = isoTime;

      const metrics = computeCitySolarMetrics(activeLat, decl);
      this.updateSunArcSVG(metrics.daylightHours, metrics.noonAltitudeDeg, metrics.polarState);
    }

    const lunar = computeLunarState(state.jd);
    const moonKey = `${lunar.phaseName}-${Math.round(lunar.illuminationPct)}`;
    if (moonKey !== this.lastMoonKey) {
      this.lastMoonKey = moonKey;
      document.getElementById('ui-moon-name')!.textContent = lunar.phaseName;
      document.getElementById('ui-moon-pct')!.textContent = `%${Math.round(lunar.illuminationPct)}`;
      document.getElementById('ui-moon-lit')!.setAttribute('d', this.buildMoonPhasePath(lunar.synodicAge));
    }

    const eclipseKey = `${lunar.eclipseType}-${this.lastDateKey}`;
    if (eclipseKey !== this.lastEclipseKey) {
      this.lastEclipseKey = eclipseKey;
      const declNow = computeSolarDeclinationDeg(state.jd);
      const earthNow = computePlanetPosition('earth', state.jd, 1.0);
      document.getElementById('ui-edu-insight')!.textContent = getEducationalInsight(
        state.jd,
        declNow,
        earthNow.radiusAU,
        lunar.eclipseType
      );

      const alertEl = document.getElementById('ui-eclipse-alert')!;
      if (lunar.eclipseType === 'solar') {
        alertEl.className =
          'text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border text-center bg-amber-500/15 text-amber-200 border-amber-400/40';
        alertEl.textContent = 'Güneş Tutulması Hizalanması — Ay Gölgesi Dünya\'da';
      } else if (lunar.eclipseType === 'lunar') {
        alertEl.className =
          'text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border text-center bg-rose-500/15 text-rose-200 border-rose-400/40';
        alertEl.textContent = 'Ay Tutulması — Kanlı Ay (Dünya Gölgesinde)';
      } else {
        alertEl.className = 'hidden';
      }
    }
  }

  private updateSunArcSVG(
    daylightHours: number,
    noonAltDeg: number,
    polarState: 'normal' | 'midnight-sun' | 'polar-night'
  ): void {
    const daylightEl = document.getElementById('ui-daylight')!;
    const noonEl = document.getElementById('ui-noon-alt')!;

    if (polarState === 'midnight-sun') {
      daylightEl.textContent = '24 sa (Gece Yok)';
    } else if (polarState === 'polar-night') {
      daylightEl.textContent = '0 sa (Kutup Gecesi)';
    } else {
      const h = Math.floor(daylightHours);
      const m = Math.round((daylightHours - h) * 60);
      daylightEl.textContent = `${h} sa ${String(m).padStart(2, '0')} dk`;
    }
    noonEl.textContent = `${Math.max(0, noonAltDeg).toFixed(1)}°`;

    const clampedAlt = Math.max(0, Math.min(90, noonAltDeg));
    const peakY = 48 - (clampedAlt / 90) * 42;
    const ctrlY = 2 * peakY - 48;
    const pathD = `M 12 48 Q 55 ${ctrlY.toFixed(1)} 98 48`;
    document.getElementById('ui-arc-path')!.setAttribute('d', pathD);
    document.getElementById('ui-arc-fill')!.setAttribute('d', `${pathD} Z`);
    const sunDot = document.getElementById('ui-arc-sun')!;
    sunDot.setAttribute('cy', peakY.toFixed(1));
    sunDot.setAttribute('opacity', clampedAlt <= 0.5 ? '0.2' : '1');
  }

  private buildMoonPhasePath(phaseFraction: number): string {
    const r = 17;
    const cx = 20;
    const cy = 20;
    const k = Math.cos(phaseFraction * Math.PI * 2);
    const rx = Math.max(0.01, Math.abs(k) * r);
    const isWaxing = phaseFraction < 0.5;

    if (isWaxing) {
      const sweepInner = k > 0 ? 0 : 1;
      return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${sweepInner} ${cx} ${cy - r} Z`;
    } else {
      const sweepInner = k > 0 ? 1 : 0;
      return `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${sweepInner} ${cx} ${cy - r} Z`;
    }
  }
}
