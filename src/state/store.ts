import { BodyId, CameraPreset, CITIES, SimMode } from '../astronomy/constants';
import { dateToJulianDate } from '../astronomy/ephemeris';

export interface CustomPin {
  lat: number;
  lon: number;
  label: string;
}

export interface AppState {
  jd: number;
  isPlaying: boolean;
  simSpeed: number; // days per second multiplier (1.0 = ~10.8 days/sec)
  planetScale: number;
  mode: SimMode;
  selectedBody: BodyId;
  cameraPreset: CameraPreset;
  selectedCityId: string;
  customPin: CustomPin | null;
  showLabels: boolean;
  showLightBeam: boolean;
  showClouds: boolean;
  showTropics: boolean;
  useRealSpin: boolean;
  useSound: boolean;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  presentationMode: boolean;
  activeTourIndex: number | null;
  textureQuality: 'loading' | 'nasa-2k' | 'procedural';
}

type Listener = (state: AppState, changedKeys: Set<keyof AppState>) => void;

class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  set(partial: Partial<AppState>): void {
    const changed = new Set<keyof AppState>();
    for (const k of Object.keys(partial) as (keyof AppState)[]) {
      if (this.state[k] !== partial[k]) {
        changed.add(k);
      }
    }
    if (changed.size === 0) return;
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => fn(this.state, changed));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 768 : true;

export const store = new Store({
  jd: dateToJulianDate(new Date('2026-03-21T12:00:00Z')),
  isPlaying: true,
  simSpeed: 1.0,
  planetScale: 1.0,
  mode: 'tellurion',
  selectedBody: 'earth',
  cameraPreset: 'default',
  selectedCityId: CITIES[0].id,
  customPin: null,
  showLabels: true,
  showLightBeam: true,
  showClouds: true,
  showTropics: false,
  useRealSpin: false,
  useSound: false,
  sidebarOpen: isDesktop,
  rightPanelOpen: isDesktop,
  presentationMode: false,
  activeTourIndex: null,
  textureQuality: 'loading',
});
