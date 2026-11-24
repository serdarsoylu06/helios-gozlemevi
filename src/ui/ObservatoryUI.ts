import {
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
  getEquinoxDayOfYear,
  getSeasonForLatitude,
  julianDateToDate,
} from '../astronomy/ephemeris';
import { AppState, store } from '../state/store';

const ICON_PAUSE =
  '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const ICON_PLAY =
  '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

export class ObservatoryUI {
  private root: HTMLElement;
  private onFocusCamera: (preset: CameraPreset) => void;
  private lastDateKey = '';
  private lastMoonKey = '';
  private lastEclipseKey = '';

  constructor(root: HTMLElement, onFocusCamera: (preset: CameraPreset) => void) {
    this.root = root;
    this.onFocusCamera = onFocusCamera;
    this.renderShell();
    this.bindEvents();
    store.subscribe((state, changed) => this.sync(state, changed));
    this.sync(store.get(), new Set(Object.keys(store.get()) as (keyof AppState)[]));
  }

  private renderShell(): void {
    const cityOptions = CITIES.map(
      (c) => `<option value="${c.id}">${c.label}</option>`
    ).join('');

    this.root.innerHTML = `
      <!-- Üst Gözlemevi Barı -->
      <header class="absolute top-3 left-3 right-3 md:top-4 md:left-5 md:right-5 flex flex-wrap items-center justify-between gap-2.5 pointer-events-none">
        <div class="hud-panel px-3.5 py-2 rounded-2xl pointer-events-auto flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
            <svg class="w-4 h-4 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-display text-sm md:text-[15px] font-bold text-white tracking-tight">HELIOS GÖZLEMEVİ</h1>
              <span id="ui-tex-badge" class="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono-num uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-400/25">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>HD Uydu
              </span>
            </div>
            <p class="text-[11px] text-slate-400 leading-tight">Kepler Yörünge, Tutulma &amp; Tellurion Simülatörü</p>
          </div>
        </div>

        <!-- Mod Seçici + Rehberli Tur -->
        <div class="flex items-center gap-2 pointer-events-auto">
          <div class="hud-panel p-1 rounded-2xl flex items-center gap-1" role="group" aria-label="Simülasyon Modu">
            <button data-mode="tellurion" class="mode-btn px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5">Tellurion</button>
            <button data-mode="solar" class="mode-btn px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5">Güneş Sistemi</button>
            <button data-mode="comparison" class="mode-btn px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5">Boyut (109x)</button>
          </div>
          <button id="btn-start-tour" class="hud-panel px-3 py-2 rounded-2xl text-xs font-semibold text-amber-300 hover:bg-amber-500/15 border border-amber-400/30 transition flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>
            <span class="hidden sm:inline">Rehberli Tur</span>
          </button>
        </div>
      </header>

      <!-- Sol Telemetri Çekmecesi -->
      <aside class="absolute top-[70px] md:top-[72px] left-3 md:left-5 w-[296px] sm:w-[314px] pointer-events-none flex flex-col gap-2 max-h-[calc(100vh-194px)]">
        <div class="pointer-events-auto flex items-center gap-2">
          <button id="btn-toggle-sidebar" aria-expanded="true" aria-controls="sidebar-panels" class="hud-panel px-2.5 py-1 rounded-xl text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/5 transition flex items-center gap-1.5">
            <svg id="sidebar-chevron" class="w-3.5 h-3.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 18l-6-6 6-6"/></svg>
            <span id="sidebar-label">Telemetriyi Gizle</span>
          </button>
        </div>

        <div id="sidebar-panels" class="hud-scroll flex flex-col gap-2.5 overflow-y-auto pr-1 pb-1">
          <!-- Efemeris & Gerçek Takvim -->
          <section class="hud-panel p-3.5 rounded-2xl pointer-events-auto">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/90">Kepler Efemeris</span>
              <span id="ui-earth-au" class="text-[10px] font-mono-num text-sky-300 bg-sky-500/10 border border-sky-400/20 px-2 py-0.5 rounded-md">1.000 AU</span>
            </div>

            <!-- Gerçek Tarih + Saat (UTC) Seçici + Şu An -->
            <div class="flex items-center gap-1 mb-2">
              <input id="ui-date-picker" type="date" aria-label="Simülasyon tarihi" class="flex-1 min-w-0 bg-slate-900/80 text-slate-100 text-[10px] font-mono-num rounded-lg px-1.5 py-1 border border-white/15 focus:outline-none focus:ring-1 focus:ring-amber-400" />
              <input id="ui-time-picker" type="time" aria-label="Simülasyon saati (UTC)" class="w-[74px] bg-slate-900/80 text-slate-100 text-[10px] font-mono-num rounded-lg px-1.5 py-1 border border-white/15 focus:outline-none focus:ring-1 focus:ring-amber-400" />
              <button id="btn-live-now" class="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/30 text-[10px] font-semibold text-emerald-300 transition shrink-0">Şu An</button>
            </div>

            <div class="grid grid-cols-3 gap-1.5 mb-2">
              <div class="hud-subcard p-2 rounded-xl">
                <div class="text-[9px] text-slate-400 uppercase">Tarih</div>
                <div id="ui-date-text" class="text-[11px] font-bold text-white mt-0.5 truncate">21 Mart</div>
              </div>
              <div class="hud-subcard p-2 rounded-xl">
                <div id="ui-hemisphere-label" class="text-[9px] text-slate-400 uppercase">Kuzey Y.K.</div>
                <div id="ui-season-text" class="text-[11px] font-bold text-emerald-400 mt-0.5 truncate">İlkbahar</div>
              </div>
              <div class="hud-subcard p-2 rounded-xl">
                <div class="text-[9px] text-slate-400 uppercase">Deklinasyon</div>
                <div id="ui-decl-text" class="text-[11px] font-mono-num font-semibold text-amber-300 mt-0.5">+0.0°</div>
              </div>
            </div>

            <!-- Ekinoks, Gündönümü, Güneş & Kanlı Ay Tutulması Atlama -->
            <div class="grid grid-cols-3 gap-1 mb-2.5" role="group" aria-label="Önemli astronomik tarihler">
              <button data-jump="2026-03-20T15:00:00Z" class="jump-btn py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-400/25 text-[9px] font-mono-num font-semibold text-emerald-300 transition">21 Mar</button>
              <button data-jump="2026-06-21T12:00:00Z" class="jump-btn py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 border border-amber-400/25 text-[9px] font-mono-num font-semibold text-amber-300 transition">21 Haz</button>
              <button data-jump="2026-09-23T12:00:00Z" class="jump-btn py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/25 border border-orange-400/25 text-[9px] font-mono-num font-semibold text-orange-300 transition">23 Eyl</button>
              <button data-jump="2026-12-21T12:00:00Z" class="jump-btn py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/25 border border-sky-400/25 text-[9px] font-mono-num font-semibold text-sky-300 transition">21 Ara</button>
              <button data-jump="2026-08-12T17:47:00Z" class="jump-btn py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/35 text-[9px] font-mono-num font-semibold text-amber-200 transition" title="12 Ağustos 2026 Tam Güneş Tutulması">Güneş Tut.</button>
              <button data-jump="2026-03-03T11:33:00Z" class="jump-btn py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/35 text-[9px] font-mono-num font-semibold text-rose-300 transition" title="3 Mart 2026 Tam Ay Tutulması (Kanlı Ay)">Kanlı Ay</button>
            </div>

            <!-- Konum Güneş Yüksekliği + Canlı SVG Yay -->
            <div class="hud-subcard p-2.5 rounded-xl mb-2">
              <div class="flex items-center justify-between gap-2 mb-1">
                <label for="ui-city-select" class="text-[10px] text-slate-400 uppercase font-semibold">Konum &amp; Pin</label>
                <select id="ui-city-select" aria-label="Şehir seçimi" class="bg-slate-900/90 text-slate-100 text-[11px] rounded-lg px-2 py-0.5 border border-white/15 focus:outline-none focus:ring-1 focus:ring-amber-400">
                  ${cityOptions}
                </select>
              </div>
              <div id="ui-custom-pin-bar" class="hidden mb-1.5 flex items-center justify-between gap-1 text-[10px] font-mono-num bg-amber-500/15 text-amber-200 border border-amber-400/30 px-2 py-0.5 rounded-md">
                <span id="ui-custom-pin-text" class="truncate"></span>
                <button id="btn-clear-pin" aria-label="Özel pini kaldır" class="text-amber-300 hover:text-white">✕</button>
              </div>
              <div class="text-[9px] text-slate-400 mb-1">İpucu: Dünya üzerine tıklayarak özel pin bırak</div>
              <div class="flex items-center gap-2.5">
                <svg viewBox="0 0 110 56" class="w-[100px] h-[50px] shrink-0 overflow-visible" aria-hidden="true">
                  <defs>
                    <linearGradient id="sunArcG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.35"/>
                      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.0"/>
                    </linearGradient>
                  </defs>
                  <line x1="6" y1="48" x2="104" y2="48" stroke="rgba(148,163,184,0.35)" stroke-width="1"/>
                  <path d="M 12 48 A 43 43 0 0 1 98 48" fill="none" stroke="rgba(148,163,184,0.14)" stroke-width="1" stroke-dasharray="2 2"/>
                  <path id="ui-arc-fill" d="M 12 48 Q 55 10 98 48 Z" fill="url(#sunArcG)"/>
                  <path id="ui-arc-path" d="M 12 48 Q 55 10 98 48" fill="none" stroke="#f59e0b" stroke-width="1.8" stroke-linecap="round"/>
                  <circle id="ui-arc-sun" cx="55" cy="24" r="4" fill="#fbbf24" stroke="#fef3c7" stroke-width="1.2"/>
                  <text x="6" y="55" fill="#64748b" font-size="7" font-family="JetBrains Mono">D</text>
                  <text x="98" y="55" fill="#64748b" font-size="7" font-family="JetBrains Mono">B</text>
                </svg>
                <div class="flex-1 flex flex-col gap-1 text-[11px]">
                  <div class="flex justify-between"><span class="text-[10px] text-slate-400">Gündüz</span><strong id="ui-daylight" class="font-mono-num text-amber-300">12 sa 00 dk</strong></div>
                  <div class="flex justify-between"><span class="text-[10px] text-slate-400">Öğle Açısı</span><strong id="ui-noon-alt" class="font-mono-num text-sky-300">49.0°</strong></div>
                </div>
              </div>
            </div>

            <!-- Geometrik SVG Ay Evresi -->
            <div class="hud-subcard p-2.5 rounded-xl flex items-center gap-3">
              <svg viewBox="0 0 40 40" class="w-9 h-9 shrink-0" aria-hidden="true">
                <circle cx="20" cy="20" r="17" fill="#0f172a" stroke="rgba(148,163,184,0.35)" stroke-width="1.2"/>
                <path id="ui-moon-lit" d="" fill="#e2e8f0"/>
              </svg>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[9px] text-slate-400 uppercase tracking-wider">Ay Evresi · 5.14°</span>
                  <span id="ui-moon-pct" class="text-[10px] font-mono-num text-slate-300">%0</span>
                </div>
                <div id="ui-moon-name" class="text-xs font-semibold text-sky-300 truncate mt-0.5">Yeni Ay</div>
              </div>
            </div>

            <div id="ui-eclipse-alert" class="hidden mt-2 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border text-center" role="status" aria-live="polite"></div>
          </section>

          <!-- Seçili Gök Cismi Kartı -->
          <section class="hud-panel p-3.5 rounded-2xl pointer-events-auto">
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-2 min-w-0">
                <span id="ui-body-dot" class="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0"></span>
                <h2 id="ui-body-name" class="font-display text-sm font-bold text-white truncate">Dünya (Yer)</h2>
              </div>
              <span id="ui-body-badge" class="text-[10px] font-mono-num bg-sky-500/15 text-sky-300 border border-sky-400/25 px-2 py-0.5 rounded-full shrink-0">1.0x Ref</span>
            </div>
            <p id="ui-body-desc" class="text-[11px] text-slate-300 leading-relaxed mb-2"></p>
            <div class="grid grid-cols-2 gap-1.5 text-[11px]">
              <div class="hud-subcard px-2 py-1.5 rounded-lg"><span class="text-[9px] text-slate-400 uppercase block">Kendi Ekseni</span><strong id="ui-body-day" class="text-slate-100 font-mono-num"></strong></div>
              <div class="hud-subcard px-2 py-1.5 rounded-lg"><span class="text-[9px] text-slate-400 uppercase block">Yörünge (Yıl)</span><strong id="ui-body-year" class="text-slate-100 font-mono-num"></strong></div>
              <div class="hud-subcard px-2 py-1.5 rounded-lg"><span class="text-[9px] text-slate-400 uppercase block">Gerçek Çap</span><strong id="ui-body-real" class="text-amber-300 font-mono-num"></strong></div>
              <div class="hud-subcard px-2 py-1.5 rounded-lg"><span class="text-[9px] text-slate-400 uppercase block">Model Ölçeği</span><strong id="ui-body-model" class="text-emerald-300 font-mono-num"></strong></div>
            </div>
          </section>
        </div>
      </aside>

      <!-- Rehberli Tur Kartı (Üst Orta) -->
      <div id="ui-tour-card" class="hidden absolute top-[72px] left-1/2 -translate-x-1/2 w-[92vw] max-w-md hud-panel p-4 rounded-2xl pointer-events-auto border border-amber-400/35 z-30">
        <div class="flex items-start justify-between gap-2 mb-1">
          <div>
            <div id="ui-tour-sub" class="text-[10px] font-mono-num uppercase tracking-wider text-amber-400"></div>
            <h3 id="ui-tour-title" class="font-display text-sm font-bold text-white mt-0.5"></h3>
          </div>
          <button id="btn-tour-close" aria-label="Turu kapat" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">✕</button>
        </div>
        <p id="ui-tour-body" class="text-xs text-slate-300 leading-relaxed mb-3"></p>
        <div class="flex items-center justify-between gap-2">
          <button id="btn-tour-prev" class="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-200 transition">← Önceki</button>
          <button id="btn-tour-next" class="px-3.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-semibold text-slate-950 transition">Sonraki →</button>
        </div>
      </div>

      <!-- Sağ Kamera & Katman Paneli (Mobilde katlanabilir) -->
      <div class="absolute top-[70px] md:top-[72px] right-3 md:right-5 pointer-events-none flex flex-col items-end gap-2">
        <button id="btn-toggle-right" aria-expanded="true" aria-controls="right-panel-body" class="md:hidden pointer-events-auto hud-panel px-2.5 py-1 rounded-xl text-[11px] font-medium text-slate-300 hover:text-white transition">
          Kamera &amp; Katmanlar
        </button>
        <div id="right-panel-body" class="pointer-events-auto hud-panel p-2.5 rounded-2xl flex flex-col gap-1 w-48">
          <span class="text-[9px] text-slate-400 font-semibold uppercase tracking-[0.14em] px-1.5 pb-1">Kamera Odağı</span>
          <button data-cam="sun" class="cam-btn px-2 py-1.5 rounded-xl text-xs font-medium text-left hover:bg-white/10 transition text-amber-300">Güneş (Merkez)</button>
          <button data-cam="earth" class="cam-btn px-2 py-1.5 rounded-xl text-xs font-medium text-left hover:bg-white/10 transition text-sky-300">Dünya &amp; Gece Işıkları</button>
          <button data-cam="surface" class="cam-btn px-2 py-1.5 rounded-xl text-xs font-medium text-left hover:bg-white/10 transition text-emerald-300">Yüzeyden Bakış (Pin)</button>
          <button data-cam="top" class="cam-btn px-2 py-1.5 rounded-xl text-xs font-medium text-left hover:bg-white/10 transition text-slate-200">Kuşbakışı Yörünge</button>

          <div class="border-t border-white/10 my-1"></div>
          <span class="text-[9px] text-slate-400 font-semibold uppercase tracking-[0.14em] px-1.5 pb-0.5">Katmanlar</span>
          <label class="flex items-center justify-between gap-2 px-1.5 py-1 text-[11px] text-slate-300 cursor-pointer"><span>Etiketler</span><input id="sw-labels" type="checkbox" checked class="hud-switch" /></label>
          <label class="flex items-center justify-between gap-2 px-1.5 py-1 text-[11px] text-slate-300 cursor-pointer"><span>Işık Huzmesi</span><input id="sw-beam" type="checkbox" checked class="hud-switch" /></label>
          <label class="flex items-center justify-between gap-2 px-1.5 py-1 text-[11px] text-slate-300 cursor-pointer"><span>Bulut &amp; Atmosfer</span><input id="sw-clouds" type="checkbox" checked class="hud-switch" /></label>
          <label class="flex items-center justify-between gap-2 px-1.5 py-1 text-[11px] text-slate-300 cursor-pointer"><span>Dönence &amp; Ekvator</span><input id="sw-tropics" type="checkbox" class="hud-switch" /></label>
          <label class="flex items-center justify-between gap-2 px-1.5 py-1 text-[11px] text-slate-300 cursor-pointer"><span>Gerçek Gün Hızı</span><input id="sw-realspin" type="checkbox" class="hud-switch" /></label>
          <label class="flex items-center justify-between gap-2 px-1.5 py-1 text-[11px] text-slate-300 cursor-pointer"><span>Mekanik Ses</span><input id="sw-sound" type="checkbox" class="hud-switch" /></label>
        </div>
      </div>

      <!-- Alt Kontrol İskelesi -->
      <footer class="absolute bottom-3 left-3 right-3 md:bottom-5 md:left-5 md:right-5 pointer-events-none flex justify-center">
        <div class="hud-panel w-full max-w-3xl px-4 py-3 rounded-2xl pointer-events-auto flex flex-col gap-2.5">
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-mono-num uppercase tracking-wider text-slate-400 shrink-0 hidden sm:inline">Zaman Çarkı</span>
            <div class="flex-1 flex flex-col gap-1">
              <input id="timeline-slider" type="range" min="0" max="365.25" step="0.25" value="0" aria-label="Yıllık yörünge zaman çarkı" class="w-full" />
              <div class="flex justify-between text-[9px] font-mono-num text-slate-400 px-0.5">
                <span>21 Mar</span><span>21 Haz</span><span>23 Eyl</span><span>21 Ara</span><span>21 Mar</span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
            <div class="flex items-center gap-1.5">
              <button id="btn-play" class="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition active:scale-95">
                <span id="ui-play-icon" class="inline-flex">${ICON_PAUSE}</span>
                <span id="ui-play-text">Duraklat</span>
              </button>
              <button id="btn-step-back" class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono-num text-slate-200 transition">-15g</button>
              <button id="btn-step-fwd" class="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono-num text-slate-200 transition">+15g</button>
            </div>

            <div class="flex items-center gap-2 flex-1 min-w-[150px] max-w-[210px]">
              <label for="ui-speed" class="text-[11px] text-slate-400">Hız</label>
              <input id="ui-speed" type="range" min="0.1" max="4" step="0.1" value="1.0" class="w-full" />
              <span id="ui-speed-val" class="text-[11px] font-mono-num text-amber-300 w-8 text-right">1.0x</span>
            </div>

            <div class="flex items-center gap-2 flex-1 min-w-[150px] max-w-[210px]">
              <label for="ui-scale" class="text-[11px] text-slate-400">Ölçek</label>
              <input id="ui-scale" type="range" min="0.6" max="1.8" step="0.1" value="1.0" class="w-full" />
              <span id="ui-scale-val" class="text-[11px] font-mono-num text-emerald-300 w-8 text-right">1.0x</span>
            </div>
          </div>
        </div>
      </footer>
    `;
  }

  private bindEvents(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as SimMode;
        store.set({ mode, cameraPreset: 'default', activeTourIndex: null });
      });
    });

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

    this.root.querySelectorAll<HTMLButtonElement>('.jump-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const iso = btn.dataset.jump;
        if (!iso) return;
        store.set({ isPlaying: false, jd: dateToJulianDate(new Date(iso)) });
      });
    });

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

    document.getElementById('btn-toggle-sidebar')!.addEventListener('click', () => {
      store.set({ sidebarOpen: !store.get().sidebarOpen });
    });

    document.getElementById('btn-toggle-right')!.addEventListener('click', () => {
      store.set({ rightPanelOpen: !store.get().rightPanelOpen });
    });

    const citySelect = document.getElementById('ui-city-select') as HTMLSelectElement;
    citySelect.addEventListener('change', () => {
      store.set({ selectedCityId: citySelect.value, customPin: null });
    });

    document.getElementById('btn-clear-pin')!.addEventListener('click', () => {
      store.set({ customPin: null });
    });

    const timeline = document.getElementById('timeline-slider') as HTMLInputElement;
    timeline.addEventListener('input', () => {
      const targetEqDay = parseFloat(timeline.value);
      const curDate = julianDateToDate(store.get().jd);
      const year = curDate.getUTCFullYear();
      const eqStartJD = dateToJulianDate(new Date(Date.UTC(year, 2, 20, 15, 0, 0)));
      store.set({ isPlaying: false, jd: eqStartJD + targetEqDay });
    });

    document.getElementById('btn-play')!.addEventListener('click', () => {
      store.set({ isPlaying: !store.get().isPlaying });
    });
    document.getElementById('btn-step-back')!.addEventListener('click', () => {
      store.set({ isPlaying: false, jd: store.get().jd - 15 });
    });
    document.getElementById('btn-step-fwd')!.addEventListener('click', () => {
      store.set({ isPlaying: false, jd: store.get().jd + 15 });
    });

    const speedInput = document.getElementById('ui-speed') as HTMLInputElement;
    speedInput.addEventListener('input', () => {
      store.set({ simSpeed: parseFloat(speedInput.value) });
    });
    const scaleInput = document.getElementById('ui-scale') as HTMLInputElement;
    scaleInput.addEventListener('input', () => {
      store.set({ planetScale: parseFloat(scaleInput.value) });
    });

    (document.getElementById('sw-labels') as HTMLInputElement).addEventListener('change', (e) =>
      store.set({ showLabels: (e.target as HTMLInputElement).checked })
    );
    (document.getElementById('sw-beam') as HTMLInputElement).addEventListener('change', (e) =>
      store.set({ showLightBeam: (e.target as HTMLInputElement).checked })
    );
    (document.getElementById('sw-clouds') as HTMLInputElement).addEventListener('change', (e) =>
      store.set({ showClouds: (e.target as HTMLInputElement).checked })
    );
    (document.getElementById('sw-tropics') as HTMLInputElement).addEventListener('change', (e) =>
      store.set({ showTropics: (e.target as HTMLInputElement).checked })
    );
    (document.getElementById('sw-realspin') as HTMLInputElement).addEventListener('change', (e) =>
      store.set({ useRealSpin: (e.target as HTMLInputElement).checked })
    );
    (document.getElementById('sw-sound') as HTMLInputElement).addEventListener('change', (e) =>
      store.set({ useSound: (e.target as HTMLInputElement).checked })
    );

    // Guided Tour controls
    document.getElementById('btn-start-tour')!.addEventListener('click', () => this.applyTourStep(0));
    document.getElementById('btn-tour-close')!.addEventListener('click', () =>
      store.set({ activeTourIndex: null })
    );
    document.getElementById('btn-tour-prev')!.addEventListener('click', () => {
      const idx = store.get().activeTourIndex;
      if (idx !== null) this.applyTourStep((idx - 1 + GUIDED_TOURS.length) % GUIDED_TOURS.length);
    });
    document.getElementById('btn-tour-next')!.addEventListener('click', () => {
      const idx = store.get().activeTourIndex;
      if (idx !== null) this.applyTourStep((idx + 1) % GUIDED_TOURS.length);
    });
  }

  public applyTourStep(index: number): void {
    const step = GUIDED_TOURS[index];
    if (!step) return;
    store.set({
      activeTourIndex: index,
      isPlaying: false,
      mode: step.mode,
      selectedBody: step.targetBody,
      jd: dateToJulianDate(new Date(step.dateISO)),
      showTropics: step.showTropics ?? store.get().showTropics,
      showLightBeam: step.showLightBeam ?? store.get().showLightBeam,
      cameraPreset: step.cameraPreset,
    });
    this.onFocusCamera(step.cameraPreset);
  }

  private renderMoonSVG(synodicAge: number, illumPct: number): void {
    const pathEl = document.getElementById('ui-moon-lit');
    if (!pathEl) return;
    const r = 17;
    const cx = 20;
    const cy = 20;

    if (illumPct <= 1) {
      pathEl.setAttribute('d', '');
      return;
    }
    if (illumPct >= 99) {
      pathEl.setAttribute(
        'd',
        `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`
      );
      return;
    }

    const phaseAngle = synodicAge * Math.PI * 2;
    const waxing = synodicAge < 0.5;
    const rx = Math.abs(Math.cos(phaseAngle)) * r;
    const outerSweep = waxing ? 1 : 0;
    const innerSweep = waxing ? (synodicAge < 0.25 ? 0 : 1) : synodicAge < 0.75 ? 0 : 1;
    pathEl.setAttribute(
      'd',
      `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${innerSweep} ${cx} ${cy - r} Z`
    );
  }

  private sync(state: AppState, changed: Set<keyof AppState>): void {
    // Mode buttons
    if (changed.has('mode')) {
      this.root.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
        const active = btn.dataset.mode === state.mode;
        btn.setAttribute('aria-pressed', String(active));
        btn.className = active
          ? 'mode-btn px-3 py-1.5 rounded-xl text-xs font-semibold transition-all bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
          : 'mode-btn px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-slate-300 hover:text-white hover:bg-white/5';
      });
    }

    // Texture badge
    if (changed.has('textureQuality')) {
      const badge = document.getElementById('ui-tex-badge');
      if (badge) {
        if (state.textureQuality === 'nasa-2k') {
          badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>NASA 2K';
          badge.className =
            'hidden sm:inline-flex items-center gap-1 text-[10px] font-mono-num uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-400/25';
        } else if (state.textureQuality === 'procedural') {
          badge.classList.add('hidden');
        }
      }
    }

    // Sidebar & right panel collapse
    if (changed.has('sidebarOpen')) {
      const panels = document.getElementById('sidebar-panels')!;
      const btn = document.getElementById('btn-toggle-sidebar')!;
      const chev = document.getElementById('sidebar-chevron')!;
      const lbl = document.getElementById('sidebar-label')!;
      panels.classList.toggle('hidden', !state.sidebarOpen);
      btn.setAttribute('aria-expanded', String(state.sidebarOpen));
      chev.style.transform = state.sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      lbl.textContent = state.sidebarOpen ? 'Telemetriyi Gizle' : 'Telemetriyi Göster';
    }
    if (changed.has('rightPanelOpen')) {
      const body = document.getElementById('right-panel-body')!;
      const btn = document.getElementById('btn-toggle-right')!;
      body.classList.toggle('hidden', !state.rightPanelOpen);
      btn.setAttribute('aria-expanded', String(state.rightPanelOpen));
    }

    // Play/Pause, Speed, Scale, Switches
    if (changed.has('isPlaying')) {
      document.getElementById('ui-play-icon')!.innerHTML = state.isPlaying ? ICON_PAUSE : ICON_PLAY;
      document.getElementById('ui-play-text')!.textContent = state.isPlaying ? 'Duraklat' : 'Oynat';
    }
    if (changed.has('simSpeed')) {
      document.getElementById('ui-speed-val')!.textContent = `${state.simSpeed.toFixed(1)}x`;
    }
    if (changed.has('planetScale')) {
      document.getElementById('ui-scale-val')!.textContent = `${state.planetScale.toFixed(1)}x`;
    }
    if (changed.has('showTropics')) {
      (document.getElementById('sw-tropics') as HTMLInputElement).checked = state.showTropics;
    }
    if (changed.has('showLightBeam')) {
      (document.getElementById('sw-beam') as HTMLInputElement).checked = state.showLightBeam;
    }

    // Selected body telemetry
    if (changed.has('selectedBody')) {
      const info = PLANET_DATA[state.selectedBody];
      const dot = document.getElementById('ui-body-dot')!;
      dot.style.backgroundColor = info.color;
      dot.style.boxShadow = `0 0 10px ${info.color}`;
      document.getElementById('ui-body-name')!.textContent = info.name;
      document.getElementById('ui-body-badge')!.textContent = info.badge;
      document.getElementById('ui-body-desc')!.textContent = info.desc;
      document.getElementById('ui-body-day')!.textContent = info.dayText;
      document.getElementById('ui-body-year')!.textContent = info.yearText;
      document.getElementById('ui-body-real')!.textContent = info.realScaleText;
      document.getElementById('ui-body-model')!.textContent = info.modelScaleText;
    }

    // Guided Tour overlay
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
      }
    }

    // Ephemeris & City Metrics & Moon Phase
    if (changed.has('jd') || changed.has('selectedCityId') || changed.has('customPin')) {
      const eqDay = getEquinoxDayOfYear(state.jd);
      (document.getElementById('timeline-slider') as HTMLInputElement).value = eqDay.toFixed(2);

      const dateObj = julianDateToDate(state.jd);
      const isoDate = dateObj.toISOString().slice(0, 10);
      const isoTime = dateObj.toISOString().slice(11, 16);
      const pinKey = state.customPin ? `${state.customPin.lat.toFixed(2)},${state.customPin.lon.toFixed(2)}` : state.selectedCityId;
      const dateKey = `${isoDate}-${isoTime}-${pinKey}`;

      if (dateKey !== this.lastDateKey) {
        this.lastDateKey = dateKey;
        const datePicker = document.getElementById('ui-date-picker') as HTMLInputElement;
        const timePicker = document.getElementById('ui-time-picker') as HTMLInputElement;
        if (document.activeElement !== datePicker) datePicker.value = isoDate;
        if (document.activeElement !== timePicker) timePicker.value = isoTime;

        document.getElementById('ui-date-text')!.textContent = formatTurkishDate(dateObj);

        const city = CITIES.find((c) => c.id === state.selectedCityId) || CITIES[0];
        const activeLat = state.customPin ? state.customPin.lat : city.lat;

        const customBar = document.getElementById('ui-custom-pin-bar')!;
        if (state.customPin) {
          customBar.classList.remove('hidden');
          document.getElementById('ui-custom-pin-text')!.textContent = state.customPin.label;
        } else {
          customBar.classList.add('hidden');
        }

        const season = getSeasonForLatitude(eqDay, activeLat);
        document.getElementById('ui-hemisphere-label')!.textContent = season.hemisphereLabel;
        const seasonEl = document.getElementById('ui-season-text')!;
        seasonEl.textContent = season.name;
        seasonEl.className = `text-[11px] font-bold mt-0.5 truncate ${season.colorClass}`;

        const earthOrb = computePlanetPosition('earth', state.jd);
        document.getElementById('ui-earth-au')!.textContent = `${earthOrb.radiusAU.toFixed(3)} AU`;

        const declDeg = computeSolarDeclinationDeg(state.jd);
        document.getElementById('ui-decl-text')!.textContent = `${declDeg >= 0 ? '+' : ''}${declDeg.toFixed(1)}°`;

        const metrics = computeCitySolarMetrics(activeLat, declDeg);
        document.getElementById('ui-daylight')!.textContent = metrics.daylightFormatted;
        document.getElementById('ui-noon-alt')!.textContent = `${metrics.noonAltitudeDeg.toFixed(1)}°`;

        // Update solar altitude SVG arc
        const peakY = 46 - (metrics.noonAltitudeDeg / 90) * 38;
        const ctrlY = peakY * 2 - 48;
        const halfSpan = Math.max(10, Math.min(44, (metrics.daylightHours / 24) * 44 + 14));
        const arcD = `M ${(55 - halfSpan).toFixed(1)} 48 Q 55 ${ctrlY.toFixed(1)} ${(55 + halfSpan).toFixed(1)} 48`;
        document.getElementById('ui-arc-path')!.setAttribute('d', arcD);
        document.getElementById('ui-arc-fill')!.setAttribute('d', `${arcD} Z`);
        const sunDot = document.getElementById('ui-arc-sun')!;
        sunDot.setAttribute('cy', peakY.toFixed(1));
        sunDot.setAttribute('opacity', metrics.noonAltitudeDeg > 0.5 ? '1' : '0.2');
      }

      // Lunar phase & eclipse banner
      const lunar = computeLunarState(state.jd);
      const moonKey = `${Math.round(lunar.synodicAge * 100)}`;
      if (moonKey !== this.lastMoonKey) {
        this.lastMoonKey = moonKey;
        document.getElementById('ui-moon-pct')!.textContent = `%${lunar.illuminationPct}`;
        document.getElementById('ui-moon-name')!.textContent = lunar.phaseName;
        this.renderMoonSVG(lunar.synodicAge, lunar.illuminationPct);
      }

      if (lunar.eclipseType !== this.lastEclipseKey) {
        this.lastEclipseKey = lunar.eclipseType;
        const alertEl = document.getElementById('ui-eclipse-alert')!;
        if (lunar.eclipseType === 'solar') {
          alertEl.textContent = 'Güneş Tutulması! Ay gölgesi Dünya yüzeyinde';
          alertEl.className =
            'mt-2 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border text-center bg-amber-500/15 border-amber-400/40 text-amber-200';
        } else if (lunar.eclipseType === 'lunar') {
          alertEl.textContent = 'Ay Tutulması (Kanlı Ay)! Ay Dünya gölgesinde';
          alertEl.className =
            'mt-2 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border text-center bg-rose-500/15 border-rose-400/40 text-rose-200';
        } else {
          alertEl.className = 'hidden';
        }
      }
    }
  }
}
