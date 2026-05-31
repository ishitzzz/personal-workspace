/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ZenAudioSynth - A professional client-side soundscape synthesizer
 * powered entirely by the HTML5 Web Audio API.
 * 
 * Provides 100% reliable, zero-latency, non-buffering ambient loops:
 * - Rain: Bandpass-filtered white noise with organic atmospheric LFO wave modulations.
 * - Crackling Fire: Low-rumble thermal noise paired with randomized snap/pop triggers.
 * - Forest Birds: Randomized high-frequency sine oscillator sweeps modeling calls.
 * - Cozy Cafe: Resonant mid-range murmurs coupled with dynamic glass/ceramic saucer clinks (high sine waves).
 * 
 * Secure, offline-ready, and browser-autoplays compliant.
 */

export class ZenAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Active Sound State Nodes
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainLfo: OscillatorNode | null = null;

  private fireRumbleSource: AudioBufferSourceNode | null = null;
  private fireRumbleGain: GainNode | null = null;
  private fireCracklerTimer: any = null;

  private birdTimer: any = null;
  private cafeHumSource: AudioBufferSourceNode | null = null;
  private cafeHumGain: GainNode | null = null;
  private cafeClinkerTimer: any = null;

  // Current Target Volumes (0.0 to 1.0)
  private volumes: { [key: string]: number } = {
    rain: 0,
    forest: 0,
    fireplace: 0,
    cafe: 0,
  };

  constructor() {}

  /**
   * Lazily initialized on the first user gesture to comply with browser safety autoplay limits
   */
  private initContext() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Boot active loops in the background
    this.setupRainLoop();
    this.setupFireRumbleLoop();
    this.setupFireCracklerSchedule();
    this.setupForestBirdsSchedule();
    this.setupCafeHumLoop();
    this.setupCafeClinkerSchedule();
    
    console.log('[Zen Synth] Audio Engine Context established successfully.');
  }

  /**
   * Generates a 2-second AudioBuffer filled with White Noise
   */
  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext is not initialized.');
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Modulates soft rain: Lowpass + Bandpass filtered noise + custom slow wave gust LFO
   */
  private setupRainLoop() {
    if (!this.ctx || !this.masterGain) return;

    try {
      const noise = this.createNoiseBuffer();
      this.rainSource = this.ctx.createBufferSource();
      this.rainSource.buffer = noise;
      this.rainSource.loop = true;

      // Filter to rain roof rumble
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1000;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 450;
      bp.Q.value = 0.55;

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);

      // Low frequency oscillator representing dynamic wind gusts and downpours
      this.rainLfo = this.ctx.createOscillator();
      this.rainLfo.type = 'sine';
      this.rainLfo.frequency.value = 0.08; // 8 seconds per wave

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.15; // 15% amplitude change

      // Connect LFO to rain volume envelope
      this.rainLfo.connect(lfoGain);
      lfoGain.connect(this.rainGain.gain);

      // Map Nodes chain
      this.rainSource.connect(lp);
      lp.connect(bp);
      bp.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);

      this.rainLfo.start();
      this.rainSource.start();
    } catch (e) {
      console.warn('[Zen Synth] Failed to initialize Rain Loop node:', e);
    }
  }

  /**
   * Low-frequency hearth fire rumble
   */
  private setupFireRumbleLoop() {
    if (!this.ctx || !this.masterGain) return;

    try {
      const noise = this.createNoiseBuffer();
      this.fireRumbleSource = this.ctx.createBufferSource();
      this.fireRumbleSource.buffer = noise;
      this.fireRumbleSource.loop = true;

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 120; // deep thermal roaring

      this.fireRumbleGain = this.ctx.createGain();
      this.fireRumbleGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.fireRumbleSource.connect(lp);
      lp.connect(this.fireRumbleGain);
      this.fireRumbleGain.connect(this.masterGain);

      this.fireRumbleSource.start();
    } catch (e) {
      console.warn('[Zen Synth] Failed to initialize Fire Rumble node:', e);
    }
  }

  /**
   * Schedulers firing randomize popping clicks modeling wood crackling logs
   */
  private setupFireCracklerSchedule() {
    const triggerCrackles = () => {
      if (!this.ctx || !this.masterGain) return;
      const vol = this.volumes['fireplace'];
      if (vol <= 0 || this.ctx.state === 'suspended') return;

      // Play crackling transients with random densities and lengths
      const now = this.ctx.currentTime;
      
      const numCrackles = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < numCrackles; i++) {
        const delay = Math.random() * 0.15;
        const clickTime = now + delay;

        // Clean micro high-pass click trigger
        const osc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();

        // Randomize the character of crackles
        osc.type = Math.random() > 0.55 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(4500 + Math.random() * 3000, clickTime);
        
        // Rapid snap envelope
        clickGain.gain.setValueAtTime(0, clickTime);
        clickGain.gain.linearRampToValueAtTime(vol * 0.12 * (Math.random() * 0.8 + 0.2), clickTime + 0.001);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, clickTime + 0.003 + Math.random() * 0.008);

        osc.connect(clickGain);
        clickGain.connect(this.masterGain);

        osc.start(clickTime);
        osc.stop(clickTime + 0.03);
      }
    };

    // Keep randomized checks going
    this.fireCracklerTimer = setInterval(() => {
      if (Math.random() > 0.3) {
        triggerCrackles();
      }
    }, 180);
  }

  /**
   * Periodically schedules realistic wild forest bird chirp sweeps
   */
  private setupForestBirdsSchedule() {
    const triggerBirdCall = () => {
      if (!this.ctx || !this.masterGain) return;
      const vol = this.volumes['forest'];
      if (vol <= 0 || this.ctx.state === 'suspended') return;

      const now = this.ctx.currentTime;
      // Setup sweet, staggered frequency call sets
      const reps = Math.floor(Math.random() * 3) + 2; // 2 to 4 sweet sweeps
      const baseFreq = 2200 + Math.random() * 800; // bird call frequency spectrum

      let runningDelay = 0;
      for (let i = 0; i < reps; i++) {
        const sweepTime = now + runningDelay;
        const osc = this.ctx.createOscillator();
        const callGain = this.ctx.createGain();

        osc.type = 'sine';
        // Elegant frequency pitch sweep resembling real calls
        osc.frequency.setValueAtTime(baseFreq, sweepTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq + 600 + Math.random() * 400, sweepTime + 0.06);
        osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, sweepTime + 0.12);

        callGain.gain.setValueAtTime(0, sweepTime);
        callGain.gain.linearRampToValueAtTime(vol * 0.09 * (Math.random() * 0.6 + 0.4), sweepTime + 0.02);
        callGain.gain.exponentialRampToValueAtTime(0.0001, sweepTime + 0.12);

        osc.connect(callGain);
        callGain.connect(this.masterGain);

        osc.start(sweepTime);
        osc.stop(sweepTime + 0.13);

        runningDelay += 0.18 + Math.random() * 0.08;
      }
    };

    // Stagger bird calls every 6 to 12 seconds
    const birdTimerTick = () => {
      triggerBirdCall();
      const nextDelay = 5000 + Math.random() * 7000;
      this.birdTimer = setTimeout(birdTimerTick, nextDelay);
    };

    this.birdTimer = setTimeout(birdTimerTick, 3000);
  }

  /**
   * Resonant low mid-range collective talking hum representing espresso bar activity
   */
  private setupCafeHumLoop() {
    if (!this.ctx || !this.masterGain) return;

    try {
      const noise = this.createNoiseBuffer();
      this.cafeHumSource = this.ctx.createBufferSource();
      this.cafeHumSource.buffer = noise;
      this.cafeHumSource.loop = true;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 350; // muffled talking range
      bp.Q.value = 0.4;

      this.cafeHumGain = this.ctx.createGain();
      this.cafeHumGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.cafeHumSource.connect(bp);
      bp.connect(this.cafeHumGain);
      this.cafeHumGain.connect(this.masterGain);

      this.cafeHumSource.start();
    } catch (e) {
      console.warn('[Zen Synth] Failed to initialize Cafe Hum node:', e);
    }
  }

  /**
   * Schedulers metallic, warm bell elements capturing glass cup and porcelain saucer clicks
   */
  private setupCafeClinkerSchedule() {
    const triggerClink = () => {
      if (!this.ctx || !this.masterGain) return;
      const vol = this.volumes['cafe'];
      if (vol <= 0 || this.ctx.state === 'suspended') return;

      const now = this.ctx.currentTime;
      const f1 = 2800 + Math.random() * 1500;
      const f2 = f1 * 1.5 + (Math.random() * 200 - 100);

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const clinkGain = this.ctx.createGain();

      osc1.frequency.setValueAtTime(f1, now);
      osc2.frequency.setValueAtTime(f2, now);

      clinkGain.gain.setValueAtTime(0, now);
      clinkGain.gain.linearRampToValueAtTime(vol * 0.05 * (Math.random() * 0.7 + 0.3), now + 0.002);
      clinkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08 + Math.random() * 0.12);

      osc1.connect(clinkGain);
      osc2.connect(clinkGain);
      clinkGain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
    };

    const cafeTimerTick = () => {
      triggerClink();
      const nextDelay = 3000 + Math.random() * 9000; // clinks every 3-12 seconds
      this.cafeClinkerTimer = setTimeout(cafeTimerTick, nextDelay);
    };

    this.cafeClinkerTimer = setTimeout(cafeTimerTick, 4000);
  }

  /**
   * Dynamically modifies specific sound gains
   */
  public setVolume(id: string, vol0to100: number) {
    this.initContext();
    if (!this.ctx) return;

    // Resures audio context if browser suspended it
    if (vol0to100 > 0 && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const value0to1 = Math.max(0, Math.min(100, vol0to100)) / 100;
    this.volumes[id] = value0to1;

    const fadeTime = 0.15; // smooth fading to prevent sudden popping clicks
    const now = this.ctx.currentTime;

    if (id === 'rain' && this.rainGain) {
      this.rainGain.gain.linearRampToValueAtTime(value0to1, now + fadeTime);
    } else if (id === 'fireplace' && this.fireRumbleGain) {
      // Fire is rumbler + timer crackling (intensity driven by volume array)
      this.fireRumbleGain.gain.linearRampToValueAtTime(value0to1 * 0.6, now + fadeTime);
    } else if (id === 'cafe' && this.cafeHumGain) {
      // Cafe is conversational hubbub + periodic clinker trigger
      this.cafeHumGain.gain.linearRampToValueAtTime(value0to1 * 0.4, now + fadeTime);
    }
  }

  /**
   * Suspends background processing completely to conserve browser device energy
   */
  public destroy() {
    clearInterval(this.fireCracklerTimer);
    clearTimeout(this.birdTimer);
    clearTimeout(this.cafeClinkerTimer);

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

// Single active globally managed Instance for unified mixer scopes
export const zenAudioSynthInstance = new ZenAudioSynth();
