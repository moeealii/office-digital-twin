interface SweepBackend { start(): void; close(): void }
const userActivated = () => {
  const activation: unknown = navigator.userActivation;
  return typeof activation === 'object' && activation !== null && 'isActive' in activation && activation.isActive === true;
};
function backend(): SweepBackend {
  const context = new AudioContext();
  return {
    start() {
      void context.resume().then(() => {
        if (context.state !== 'running') return;
        const duration = 0.18;
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const source = context.createBufferSource(); source.buffer = buffer;
        const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(2100, context.currentTime);
        filter.frequency.exponentialRampToValueAtTime(650, context.currentTime + duration); filter.Q.value = 0.65;
        const gain = context.createGain(); gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(0.035, context.currentTime + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
        source.connect(filter); filter.connect(gain); gain.connect(context.destination);
        source.start(); source.stop(context.currentTime + duration);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      }).catch(() => undefined); // Audio permission/device limits must never break tidying.
    },
    close() { void context.close().catch(() => undefined); },
  };
}

/** No context, noise buffer, autoplay or loop exists before a successful user-gesture hide. */
export class SweepSound {
  muted = false;
  private audio: SweepBackend | null = null;
  private readonly active: () => boolean;
  private readonly create: () => SweepBackend;
  constructor(active = userActivated, create = backend) { this.active = active; this.create = create; }
  play(): boolean {
    if (this.muted || !this.active()) return false;
    try { this.audio ??= this.create(); this.audio.start(); return true; } catch { return false; }
  }
  dispose(): void { this.audio?.close(); this.audio = null; }
}
