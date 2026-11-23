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
  new ObservatoryUI(hudRoot, (preset) => sceneController.focusCamera(preset));

  // Global keyboard shortcuts
  window.addEventListener('keydown', (e) => {
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
    } else if (e.key === 'Escape' && store.get().activeTourIndex !== null) {
      store.set({ activeTourIndex: null });
    }
  });
}

bootstrap();
