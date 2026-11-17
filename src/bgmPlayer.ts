import { OccasionId } from './config';

export interface BgmPreset {
  id: string;
  label: string;
  occasion?: OccasionId | 'all';
}

export const BGM_PRESETS: BgmPreset[] = [
  { id: 'preset:we-wish-you', label: 'We Wish You A Merry Christmas (Hộp nhạc Noel)', occasion: 'noel' },
  { id: 'preset:silent-night', label: 'Silent Night · Đêm Thánh Vô Cùng (Du dương)', occasion: 'noel' },
  { id: 'preset:jingle-bells', label: 'Jingle Bells (Nhịp chuông rộn ràng)', occasion: 'noel' },
  { id: 'preset:first-blush', label: 'Lời Ngỏ Dịu Dàng (Hộp nhạc Tỏ tình)', occasion: 'to-tinh' },
  { id: 'preset:love-serenade', label: 'Khúc Tình Ca Ấm Áp (Hộp nhạc Valentine)', occasion: 'valentine' },
  { id: 'preset:spring-blossom', label: 'Xuân Sum Vầy (Ngũ cung Tết êm dịu)', occasion: 'tet' },
  { id: 'preset:happy-birthday', label: 'Happy Birthday (Hộp nhạc Sinh nhật)', occasion: 'sinh-nhat' },
  { id: 'none', label: 'Tắt nhạc nền', occasion: 'all' },
];

export const DEFAULT_BGM = 'preset:we-wish-you';

const NOTE_FREQ: Record<string, number> = {
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  'F#4': 369.99,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  'C#5': 554.37,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  'F#5': 739.99,
  G5: 783.99,
  A5: 880.0,
};

interface NoteStep {
  melody: string;
  bass?: string;
  beats: number;
}

const SONGS: Record<string, { bpm: number; notes: NoteStep[] }> = {
  'preset:we-wish-you': {
    bpm: 126,
    notes: [
      { melody: 'D4', beats: 1 },
      { melody: 'G4', bass: 'G3', beats: 1 },
      { melody: 'G4', beats: 0.5 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'G4', beats: 0.5 },
      { melody: 'F#4', beats: 0.5 },
      { melody: 'E4', bass: 'C4', beats: 1 },
      { melody: 'E4', beats: 1 },
      { melody: 'E4', beats: 1 },
      { melody: 'A4', bass: 'A3', beats: 1 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'B4', beats: 0.5 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'G4', beats: 0.5 },
      { melody: 'F#4', bass: 'D4', beats: 1 },
      { melody: 'D4', beats: 1 },
      { melody: 'D4', beats: 1 },
      { melody: 'B4', bass: 'B3', beats: 1 },
      { melody: 'B4', beats: 0.5 },
      { melody: 'C5', beats: 0.5 },
      { melody: 'B4', beats: 0.5 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'G4', bass: 'E4', beats: 1 },
      { melody: 'E4', beats: 1 },
      { melody: 'D4', beats: 0.5 },
      { melody: 'D4', beats: 0.5 },
      { melody: 'E4', bass: 'C4', beats: 1 },
      { melody: 'A4', beats: 1 },
      { melody: 'F#4', bass: 'D4', beats: 1 },
      { melody: 'G4', bass: 'G3', beats: 2.5 },
    ],
  },
  'preset:jingle-bells': {
    bpm: 142,
    notes: [
      { melody: 'E5', bass: 'C4', beats: 1 },
      { melody: 'E5', beats: 1 },
      { melody: 'E5', beats: 2 },
      { melody: 'E5', bass: 'C4', beats: 1 },
      { melody: 'E5', beats: 1 },
      { melody: 'E5', beats: 2 },
      { melody: 'E5', bass: 'C4', beats: 1 },
      { melody: 'G5', beats: 1 },
      { melody: 'C5', bass: 'A3', beats: 1.5 },
      { melody: 'D5', beats: 0.5 },
      { melody: 'E5', bass: 'C4', beats: 3 },
      { melody: 'F5', bass: 'F4', beats: 1 },
      { melody: 'F5', beats: 1 },
      { melody: 'F5', beats: 1.5 },
      { melody: 'F5', beats: 0.5 },
      { melody: 'F5', bass: 'C4', beats: 1 },
      { melody: 'E5', beats: 1 },
      { melody: 'E5', beats: 1 },
      { melody: 'E5', beats: 1 },
      { melody: 'G5', bass: 'G3', beats: 1 },
      { melody: 'G5', beats: 1 },
      { melody: 'F5', beats: 1 },
      { melody: 'D5', beats: 1 },
      { melody: 'C5', bass: 'C4', beats: 3 },
    ],
  },
  'preset:silent-night': {
    bpm: 84,
    notes: [
      { melody: 'G4', bass: 'C4', beats: 1.5 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'G4', beats: 1 },
      { melody: 'E4', bass: 'C4', beats: 3 },
      { melody: 'G4', bass: 'C4', beats: 1.5 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'G4', beats: 1 },
      { melody: 'E4', bass: 'C4', beats: 3 },
      { melody: 'D5', bass: 'G3', beats: 2 },
      { melody: 'D5', beats: 1 },
      { melody: 'B4', bass: 'G3', beats: 3 },
      { melody: 'C5', bass: 'C4', beats: 2 },
      { melody: 'C5', beats: 1 },
      { melody: 'G4', bass: 'C4', beats: 3 },
      { melody: 'A4', bass: 'F4', beats: 2 },
      { melody: 'A4', beats: 1 },
      { melody: 'C5', bass: 'F4', beats: 1.5 },
      { melody: 'B4', beats: 0.5 },
      { melody: 'A4', beats: 1 },
      { melody: 'G4', bass: 'C4', beats: 1.5 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'G4', beats: 1 },
      { melody: 'E4', bass: 'C4', beats: 3.5 },
    ],
  },
  'preset:first-blush': {
    bpm: 92,
    notes: [
      { melody: 'E4', bass: 'C4', beats: 1 },
      { melody: 'G4', beats: 1 },
      { melody: 'C5', beats: 1.5 },
      { melody: 'B4', beats: 0.5 },
      { melody: 'A4', bass: 'A3', beats: 2 },
      { melody: 'G4', beats: 1 },
      { melody: 'F4', bass: 'F4', beats: 1 },
      { melody: 'A4', beats: 1 },
      { melody: 'G4', bass: 'G3', beats: 2 },
      { melody: 'E4', bass: 'C4', beats: 1 },
      { melody: 'G4', beats: 1 },
      { melody: 'E5', bass: 'A3', beats: 1.5 },
      { melody: 'D5', beats: 0.5 },
      { melody: 'C5', bass: 'F4', beats: 2 },
      { melody: 'D5', bass: 'G3', beats: 1 },
      { melody: 'C5', bass: 'C4', beats: 3 },
    ],
  },
  'preset:love-serenade': {
    bpm: 82,
    notes: [
      { melody: 'G4', bass: 'C4', beats: 1.5 },
      { melody: 'C5', beats: 1 },
      { melody: 'E5', beats: 1.5 },
      { melody: 'D5', bass: 'G3', beats: 1 },
      { melody: 'C5', beats: 1 },
      { melody: 'B4', beats: 1 },
      { melody: 'A4', bass: 'A3', beats: 2 },
      { melody: 'F4', bass: 'F4', beats: 1 },
      { melody: 'A4', beats: 1 },
      { melody: 'C5', beats: 1.5 },
      { melody: 'B4', bass: 'G3', beats: 1 },
      { melody: 'G4', beats: 1.5 },
      { melody: 'E5', bass: 'C4', beats: 1.5 },
      { melody: 'D5', bass: 'G3', beats: 1 },
      { melody: 'C5', bass: 'C4', beats: 3 },
    ],
  },
  'preset:spring-blossom': {
    // Âm hưởng ngũ cung Việt Nam trong trẻo (C - D - E - G - A)
    bpm: 104,
    notes: [
      { melody: 'G4', bass: 'C4', beats: 1 },
      { melody: 'A4', beats: 0.5 },
      { melody: 'C5', beats: 1 },
      { melody: 'D5', bass: 'G3', beats: 1.5 },
      { melody: 'C5', beats: 0.5 },
      { melody: 'A4', bass: 'A3', beats: 1 },
      { melody: 'G4', beats: 1.5 },
      { melody: 'E4', bass: 'C4', beats: 1 },
      { melody: 'G4', beats: 1 },
      { melody: 'A4', bass: 'F4', beats: 1 },
      { melody: 'C5', beats: 1 },
      { melody: 'E5', bass: 'C4', beats: 1.5 },
      { melody: 'D5', beats: 0.5 },
      { melody: 'C5', bass: 'G3', beats: 1 },
      { melody: 'A4', beats: 1 },
      { melody: 'G4', bass: 'C4', beats: 2.5 },
    ],
  },
  'preset:happy-birthday': {
    bpm: 112,
    notes: [
      { melody: 'G4', beats: 0.75 },
      { melody: 'G4', beats: 0.25 },
      { melody: 'A4', bass: 'C4', beats: 1 },
      { melody: 'G4', beats: 1 },
      { melody: 'C5', bass: 'C4', beats: 1 },
      { melody: 'B4', bass: 'G3', beats: 2 },
      { melody: 'G4', beats: 0.75 },
      { melody: 'G4', beats: 0.25 },
      { melody: 'A4', bass: 'G3', beats: 1 },
      { melody: 'G4', beats: 1 },
      { melody: 'D5', bass: 'G3', beats: 1 },
      { melody: 'C5', bass: 'C4', beats: 2 },
      { melody: 'G4', beats: 0.75 },
      { melody: 'G4', beats: 0.25 },
      { melody: 'G5', bass: 'C4', beats: 1 },
      { melody: 'E5', beats: 1 },
      { melody: 'C5', bass: 'F4', beats: 1 },
      { melody: 'B4', beats: 1 },
      { melody: 'A4', beats: 1.5 },
      { melody: 'F5', beats: 0.75 },
      { melody: 'F5', beats: 0.25 },
      { melody: 'E5', bass: 'C4', beats: 1 },
      { melody: 'C5', beats: 1 },
      { melody: 'D5', bass: 'G3', beats: 1 },
      { melody: 'C5', bass: 'C4', beats: 2.5 },
    ],
  },
};

class BgmController {
  private ctx: AudioContext | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private htmlAudio: HTMLAudioElement | null = null;
  private currentTrack = DEFAULT_BGM;
  private muted = false;
  private ducked = false;
  private playing = false;
  private stepIdx = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playBellNote(freq: number, durationSec: number, gainPeak: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;

    const effectivePeak = this.ducked ? gainPeak * 0.22 : gainPeak;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    const release = Math.max(durationSec * 1.4, 0.55);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(effectivePeak, now + 0.018);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + release);

    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(effectivePeak * 0.2, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + release * 0.65);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(ctx.destination);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + release + 0.05);
    osc2.stop(now + release + 0.05);
  }

  private stopLoop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.htmlAudio) {
      this.htmlAudio.pause();
      this.htmlAudio.src = '';
      this.htmlAudio = null;
    }
  }

  private scheduleNextStep() {
    if (!this.playing || this.muted || this.currentTrack === 'none') return;
    const song = SONGS[this.currentTrack] || SONGS[DEFAULT_BGM];
    if (!song) return;

    const step = song.notes[this.stepIdx % song.notes.length];
    this.stepIdx = (this.stepIdx + 1) % song.notes.length;

    const beatSec = 60 / song.bpm;
    const durSec = step.beats * beatSec;

    const melFreq = NOTE_FREQ[step.melody];
    if (melFreq) {
      this.playBellNote(melFreq, durSec, 0.1);
    }
    if (step.bass && NOTE_FREQ[step.bass]) {
      this.playBellNote(NOTE_FREQ[step.bass], durSec * 1.3, 0.05);
    }

    this.timerId = setTimeout(() => this.scheduleNextStep(), durSec * 1000);
  }

  public setTrack(trackIdOrUrl: string) {
    const normalized = (trackIdOrUrl || DEFAULT_BGM).trim() || DEFAULT_BGM;
    if (normalized === this.currentTrack && this.playing) return;
    this.currentTrack = normalized;
    this.stepIdx = 0;
    if (this.playing) {
      this.start();
    }
  }

  public start() {
    this.stopLoop();
    this.playing = true;
    if (this.muted || this.currentTrack === 'none') return;

    if (
      !this.currentTrack.startsWith('preset:') &&
      (this.currentTrack.startsWith('http://') ||
        this.currentTrack.startsWith('https://') ||
        this.currentTrack.startsWith('blob:') ||
        this.currentTrack.startsWith('data:audio/'))
    ) {
      const audio = new Audio(this.currentTrack);
      audio.loop = true;
      audio.volume = this.ducked ? 0.12 : 0.45;
      this.htmlAudio = audio;
      audio.play().catch(() => {});
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    this.scheduleNextStep();
  }

  public stop() {
    this.playing = false;
    this.stopLoop();
  }

  public setDucking(duck: boolean) {
    this.ducked = duck;
    if (this.htmlAudio) {
      this.htmlAudio.volume = duck ? 0.12 : 0.45;
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (mute) {
      this.stopLoop();
    } else if (this.playing) {
      this.start();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getTrack(): string {
    return this.currentTrack;
  }
}

export const bgmPlayer = new BgmController();
