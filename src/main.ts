import './styles/main.css';
import { ObservatoryAudio } from './scene/audio';
import { SolarSystemScene } from './scene/SolarSystemScene';
import { ObservatoryUI } from './ui/ObservatoryUI';
import { store } from './state/store';

function bootstrap(): void {
  const canvasContainer = document.getElementById('canvas-container');
  const labelsContainer = document.getElementById('labels-container');
  const hudRoot = document.getElementById('hud-root');

  if (!canvasContainer || !labelsContainer || !hudRoot) {
    throw new Error('Helios Observatory root containers not found.');
  }

  const audio = new ObservatoryAudio();
  const sceneController = new SolarSystemScene(canvasContainer, labelsContainer, audio);
  new ObservatoryUI(
    hudRoot,
    (preset, bodyId) => sceneController.focusCamera(preset, bodyId),
    () => sceneController.captureSnapshot()
  );

  // Global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    // Ctrl+K / Cmd+K Command Palette works even from inputs
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      store.set({ commandPaletteOpen: !store.get().commandPaletteOpen });
      return;
    }

    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      store.set({ isPlaying: !store.get().isPlaying });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      store.set({ isPlaying: false, jd: store.get().jd + (e.shiftKey ? 15 : 1) });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      store.set({ isPlaying: false, jd: store.get().jd - (e.shiftKey ? 15 : 1) });
    } else if (e.key === '1') {
      store.set({ mode: 'tellurion', activeTourIndex: null });
    } else if (e.key === '2') {
      store.set({ mode: 'solar', activeTourIndex: null });
    } else if (e.key === '3') {
      store.set({ mode: 'comparison', activeTourIndex: null });
    } else if (e.key === 'h' || e.key === 'H') {
      store.set({ presentationMode: !store.get().presentationMode });
    } else if (e.key === 'Escape') {
      if (store.get().commandPaletteOpen) {
        store.set({ commandPaletteOpen: false });
      } else if (store.get().presentationMode) {
        store.set({ presentationMode: false });
      } else if (store.get().activeTourIndex !== null) {
        store.set({ activeTourIndex: null });
      } else if (store.get().activeDrawerTab !== null) {
        store.set({ activeDrawerTab: null });
      }
    }
  });
  // Register PWA Service Worker in production builds
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Ignore SW registration failure in restricted contexts
      });
    });
  }
}

bootstrap();
