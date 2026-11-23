/**
 * Optional procedural Web Audio API soundscape (off by default).
 * - Mechanical escapement tick when turning the Tellurion wheel
 * - Subtle warm deep-space harmonic drone
 */
export class ObservatoryAudio {
  private ctx: AudioContext | null = null;
  private droneGain: GainNode | null = null;
  private enabled = false;
  private lastTickTime = 0;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (this.droneGain && this.ctx) {
        this.droneGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.35);
      }
    } else if (this.droneGain && this.ctx) {
      this.droneGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.2);
    }
  }

  playMechanicalTick(): void {
    if (!this.enabled) return;
    const now = performance.now();
    if (now - this.lastTickTime < 45) return;
    this.lastTickTime = now;

    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.022);
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  private ensureContext(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.0001;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;

    [55, 82.41, 110].forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
    });

    filter.connect(this.droneGain);
    this.droneGain.connect(this.ctx.destination);
  }
}
