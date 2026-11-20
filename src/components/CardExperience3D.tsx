import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  BookOpen,
  Camera,
  CameraOff,
  Flame,
  Heart,
  Lock,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import { CONFIG, OccasionId } from '../config';
import { WebCardPhoto, WebCardRecord } from '../firebase';
import { bgmPlayer } from '../bgmPlayer';

interface CardExperience3DProps {
  card: WebCardRecord;
  isPreview?: boolean;
  onBackHome?: () => void;
}

type CardStage = 0 | 1 | 2 | 3;

function splitHeadlineLines(greeting: string): [string, string] {
  const clean = (greeting || '').normalize('NFC').trim();
  if (!clean) return ['Chúc Mừng', 'Giáng Sinh'];
  if (clean.includes('\n')) {
    const parts = clean
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return [parts[0] || 'Chúc Mừng', parts.slice(1).join(' ') || 'Giáng Sinh'];
  }
  const words = clean.split(/\s+/);
  if (words.length >= 4) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
  }
  return [clean, ''];
}

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function buildTextTargets(
  headline: [string, string],
  N: number,
  outPos: Float32Array,
  outCol: Float32Array,
  accentHex: string
) {
  const W = 900;
  const H = 420;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const line1 = headline[0] || 'Chúc Mừng';
  const line2 = headline[1] || '';

  const len1 = line1.length;
  const len2 = line2.length;
  const fontSize1 = len1 > 16 ? 95 : len1 > 11 ? 118 : 142;
  const fontSize2 = len2 > 16 ? 95 : len2 > 11 ? 118 : 142;

  if (line2) {
    ctx.font = `700 ${fontSize1}px "Be Vietnam Pro", system-ui, "Segoe UI", Arial, sans-serif`;
    ctx.fillText(line1, W / 2, H * 0.31);
    ctx.font = `700 ${fontSize2}px "Be Vietnam Pro", system-ui, "Segoe UI", Arial, sans-serif`;
    ctx.fillText(line2, W / 2, H * 0.7);
  } else {
    ctx.font = `700 ${fontSize1}px "Be Vietnam Pro", system-ui, "Segoe UI", Arial, sans-serif`;
    ctx.fillText(line1, W / 2, H * 0.5);
  }

  const d = ctx.getImageData(0, 0, W, H).data;
  const pts: [number, number][] = [];
  for (let y = 0; y < H; y += 3) {
    for (let u = 0; u < W; u += 3) {
      if (d[(y * W + u) * 4 + 3] > 128) {
        pts.push([((u - W / 2) * 13) / W, (-(y - H / 2) * 13) / W]);
      }
    }
  }
  if (pts.length === 0) pts.push([0, 0]);

  const gold = new THREE.Color(accentHex || '#ffe2a0');
  const white = new THREE.Color('#ffffff');

  for (let i = 0; i < N; i++) {
    const q = pts[(Math.random() * pts.length) | 0];
    outPos[i * 3] = q[0] + (Math.random() - 0.5) * 0.05;
    outPos[i * 3 + 1] = q[1] + (Math.random() - 0.5) * 0.05;
    outPos[i * 3 + 2] = (Math.random() - 0.5) * 0.45;
    const c = Math.random() < 0.72 ? gold : white;
    outCol[i * 3] = c.r;
    outCol[i * 3 + 1] = c.g;
    outCol[i * 3 + 2] = c.b;
  }
}

function buildEnvelopeTargets(N: number, outPos: Float32Array, outCol: Float32Array) {
  const w = 4;
  const h = 2.75;
  const P = '#ff7a8a';
  const Y = '#ffd98a';
  const sg: [number, number, number, number, string][] = [
    [-w, -h, w, -h, P],
    [w, -h, w, h, P],
    [w, h, -w, h, P],
    [-w, h, -w, -h, P],
    [-w, h, 0, 0.3, Y],
    [w, h, 0, 0.3, Y],
  ];
  const L = sg.map((s) => Math.hypot(s[2] - s[0], s[3] - s[1]));
  const T = L.reduce((a, b) => a + b, 0);
  const cc = new THREE.Color();

  for (let i = 0; i < N; i++) {
    let x: number;
    let y: number;
    let hex: string;
    if (Math.random() < 0.2) {
      x = (Math.random() * 2 - 1) * w;
      y = (Math.random() * 2 - 1) * h;
      hex = '#a8404f';
    } else {
      let r = Math.random() * T;
      let k = 0;
      while (r > L[k] && k < L.length - 1) {
        r -= L[k];
        k++;
      }
      const s = sg[k];
      const t = r / L[k];
      x = s[0] + (s[2] - s[0]) * t;
      y = s[1] + (s[3] - s[1]) * t;
      hex = s[4];
    }
    outPos[i * 3] = x + (Math.random() - 0.5) * 0.06;
    outPos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.06;
    outPos[i * 3 + 2] = (Math.random() - 0.5) * 0.28;
    cc.set(hex);
    outCol[i * 3] = cc.r;
    outCol[i * 3 + 1] = cc.g;
    outCol[i * 3 + 2] = cc.b;
  }
}

const BIRTHDAY_CAKE_END_RATIO = 0.58;
const BIRTHDAY_CANDLE_END_RATIO = 0.8;

function isBirthdayCandleIndex(i: number, N: number): boolean {
  const start = Math.floor(N * BIRTHDAY_CAKE_END_RATIO);
  const end = Math.floor(N * BIRTHDAY_CANDLE_END_RATIO);
  return i >= start && i < end;
}

function isBirthdayCandleFlameIndex(i: number, N: number): boolean {
  return isBirthdayCandleIndex(i, N) && Math.floor(i / 3) % 3 === 0;
}

function buildStage3Targets(
  occasion: OccasionId,
  accentHex: string,
  N: number,
  outPos: Float32Array,
  outCol: Float32Array
) {
  const cc = new THREE.Color();
  const rnd = Math.random;
  const setHex = (i: number, h: string) => {
    cc.set(h);
    outCol[i * 3] = cc.r;
    outCol[i * 3 + 1] = cc.g;
    outCol[i * 3 + 2] = cc.b;
  };
  const setHSL = (i: number, h: number, s: number, l: number) => {
    cc.setHSL(h, s, l);
    outCol[i * 3] = cc.r;
    outCol[i * 3 + 1] = cc.g;
    outCol[i * 3 + 2] = cc.b;
  };

  for (let i = 0; i < N; i++) {
    let x = 0;
    let y = 0;
    let z = 0;

    if (occasion === 'noel') {
      // Đúng mẫu Cây Thông 3D từ tin1511/noelnt
      const r = rnd();
      if (r < 0.05) {
        const a = rnd() * 6.283;
        const q = rnd() * 0.45;
        x = Math.cos(a) * q;
        z = Math.sin(a) * q;
        y = -5.2 + rnd() * 1;
        setHex(i, '#8a5a2b');
      } else if (r < 0.075) {
        const a = rnd() * 6.283;
        const b = rnd() * 3.14;
        const q = rnd() * 0.42;
        x = Math.sin(b) * Math.cos(a) * q;
        y = 5.05 + Math.cos(b) * q;
        z = Math.sin(b) * Math.sin(a) * q;
        setHex(i, '#fff1b0');
      } else {
        const t = Math.pow(rnd(), 0.85);
        const a = rnd() * 6.283;
        const q = (1 - t) * 3.4 * (0.55 + 0.45 * rnd()) * (0.88 + 0.12 * Math.sin(t * 22));
        x = Math.cos(a) * q;
        z = Math.sin(a) * q;
        y = -4.4 + t * 9.2;
        if (rnd() < 0.13) {
          setHex(i, ['#ff4d5e', '#ffd98a', '#bfe6ff'][(rnd() * 3) | 0]);
        } else {
          setHSL(i, 0.36 + rnd() * 0.06, 0.6, 0.3 + rnd() * 0.25);
        }
      }
    } else if (occasion === 'valentine') {
      const u = rnd() * Math.PI * 2;
      const layer = rnd() * 2 - 1;
      const scale = 0.24 * (1 - Math.abs(layer) * 0.16);
      const hx = 16 * Math.pow(Math.sin(u), 3);
      const hy = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
      x = hx * scale + (rnd() - 0.5) * 0.15;
      y = hy * scale + 0.5 + (rnd() - 0.5) * 0.15;
      z = layer * 1.15 * Math.sqrt(Math.max(0.06, 1 - Math.abs(hx) / 18));
      setHex(i, rnd() < 0.22 ? '#ffd98a' : rnd() < 0.65 ? '#ff4d6d' : '#ff8a9a');
    } else if (occasion === 'to-tinh') {
      if (i < N * 0.55) {
        const p = i / (N * 0.55);
        if (p < 0.78) {
          const theta = -0.35 * Math.PI + (p / 0.78) * 1.45 * Math.PI;
          const r = 2.4;
          x = Math.cos(theta) * r + (rnd() - 0.5) * 0.14;
          y = 1.0 + Math.sin(theta) * r + (rnd() - 0.5) * 0.14;
          if (p > 0.6) {
            const tail = (p - 0.6) / 0.18;
            x *= 1 - tail * 0.88;
            y = 1.0 - tail * 2.5;
          }
          z = Math.sin(p * 24) * 0.35;
          setHex(i, '#ffd98a');
        } else {
          const a = rnd() * 6.283;
          const rad = 0.45 * rnd();
          x = Math.cos(a) * rad;
          y = -2.6 + Math.sin(a) * rad;
          z = (rnd() - 0.5) * 0.25;
          setHex(i, '#ff7a8a');
        }
      } else {
        const ring = i % 2 === 0 ? 1 : -1;
        const a = rnd() * 6.283;
        const r = 4.4 + (rnd() - 0.5) * 0.25;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * 0.42 * ring;
        z = Math.sin(a) * r * 0.75;
        setHex(i, ring > 0 ? accentHex || '#ffd98a' : '#ff7a8a');
      }
    } else if (occasion === 'tet') {
      if (i < N * 0.65) {
        const p = i / (N * 0.65);
        const lat = (p - 0.5) * Math.PI * 0.92;
        const lon = rnd() * 6.283;
        const r = 2.8 * Math.cos(lat * 0.82);
        x = Math.cos(lon) * r;
        z = Math.sin(lon) * r;
        y = Math.sin(lat) * 3.1 + 0.4;
        setHex(i, rnd() < 0.22 ? '#ffd98a' : '#e11d48');
      } else if (i < N * 0.8) {
        const s = (i - N * 0.65) / (N * 0.15);
        const strand = (i % 7) - 3;
        x = strand * 0.2;
        z = (rnd() - 0.5) * 0.18;
        y = -2.7 - s * 1.8;
        setHex(i, '#ffd98a');
      } else {
        const a = rnd() * 6.283;
        const r = 3.8 + rnd() * 1.4;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = (rnd() - 0.5) * 7.5;
        setHex(i, rnd() < 0.5 ? '#facc15' : '#fda4af');
      }
    } else {
      // Sinh nhật: Bánh kem 2 tầng & 3 ngọn nến lung linh
      if (i < Math.floor(N * BIRTHDAY_CAKE_END_RATIO)) {
        const isTop = i % 3 === 0;
        const angle = rnd() * 6.283;
        const rad = (isTop ? 2.1 : 3.2) * (0.72 + 0.28 * rnd());
        const heightOffset = isTop ? 0.5 : -1.8;
        const layerY = (rnd() - 0.5) * 1.8;
        x = Math.cos(angle) * rad;
        z = Math.sin(angle) * rad;
        y = heightOffset + layerY;
        setHex(i, isTop ? '#f9a8d4' : '#fde68a');
      } else if (isBirthdayCandleIndex(i, N)) {
        const candleIdx = (i % 3) - 1;
        const a = rnd() * 6.283;
        const isFlame = isBirthdayCandleFlameIndex(i, N);
        const flameT = rnd();
        const flameRad = isFlame ? (1 - flameT * 0.72) * 0.15 : 0.14;
        x = candleIdx * 0.95 + Math.cos(a) * flameRad;
        z = Math.sin(a) * flameRad;
        y = isFlame ? 2.88 + flameT * 0.78 : 1.45 + rnd() * 1.4;
        setHex(
          i,
          isFlame ? (flameT < 0.35 ? '#fff7d6' : flameT < 0.7 ? '#ffd98a' : '#ff8c42') : '#fff7ec'
        );
      } else {
        const a = rnd() * 6.283;
        const phi = Math.acos(1 - 2 * rnd());
        const r = 4.2 + rnd() * 1.2;
        x = r * Math.sin(phi) * Math.cos(a);
        y = r * Math.cos(phi) * 0.75 + 0.5;
        z = r * Math.sin(phi) * Math.sin(a);
        setHex(i, accentHex || '#ffd98a');
      }
    }

    outPos[i * 3] = x;
    outPos[i * 3 + 1] = y;
    outPos[i * 3 + 2] = z;
  }
}

export const CardExperience3D: React.FC<CardExperience3DProps> = ({
  card,
  isPreview = false,
  onBackHome,
}) => {
  const effectiveRecipient = useMemo(() => {
    if (typeof window === 'undefined' || isPreview) return card.recipientName;
    const params = new URLSearchParams(window.location.search);
    const toOverride = params.get('to')?.trim();
    return toOverride ? toOverride.slice(0, 120) : card.recipientName;
  }, [card.recipientName, isPreview]);

  const headlinePair = useMemo(() => splitHeadlineLines(card.greeting), [card.greeting]);
  const letterParagraphs = useMemo(() => {
    const raw = (card.letter || '').normalize('NFC').trim();
    const parts = raw
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [raw || 'Gửi đến bạn những lời chúc tốt đẹp nhất.'];
  }, [card.letter]);

  const isExpired =
    !isPreview &&
    (card.status === 'expired' ||
      (typeof card.expiresAtMs === 'number' && Date.now() > card.expiresAtMs));
  const isLocked = !isPreview && card.locked;
  const isPendingApproval = !isPreview && !isLocked && !isExpired && card.status === 'pending_payment';

  const [stage, setStage] = useState<CardStage>(0);
  const [stageUiReady, setStageUiReady] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [letterModalOpen, setLetterModalOpen] = useState<boolean>(false);
  const [letterAnimPhase, setLetterAnimPhase] = useState<
    'opening_flap' | 'pulling_letter' | 'typing_text'
  >('opening_flap');
  const [typedCharCount, setTypedCharCount] = useState<number>(0);
  const [replayLetterKey, setReplayLetterKey] = useState<number>(0);
  const [lightboxPhoto, setLightboxPhoto] = useState<WebCardPhoto | null>(null);
  const [voicePlaying, setVoicePlaying] = useState<boolean>(false);
  const [toTinhAccepted, setToTinhAccepted] = useState<boolean>(false);
  const [noBtnPos, setNoBtnPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [noAttempts, setNoAttempts] = useState<number>(0);

  // Thổi nến sinh nhật bằng camera ẩn (không hiển thị khuôn mặt)
  const [candlesBlownOut, setCandlesBlownOut] = useState<boolean>(false);
  const [blowLevel, setBlowLevel] = useState<number>(0);
  const [camStatus, setCamStatus] = useState<
    'idle' | 'requesting' | 'active' | 'denied' | 'unsupported'
  >('idle');

  const fullLetterJoined = useMemo(() => letterParagraphs.join('\n\n'), [letterParagraphs]);
  const totalLetterChars = fullLetterJoined.length;

  // Điều phối hiệu ứng: (1) Mở nắp phong bì 3D -> (2) Rút lá thư từ phong bì ra ngoài -> (3) Hiện từng chữ
  useEffect(() => {
    if (!letterModalOpen) return;
    setLetterAnimPhase('opening_flap');
    setTypedCharCount(0);

    const pullTimer = window.setTimeout(() => {
      setLetterAnimPhase('pulling_letter');
    }, 680);

    const readTimer = window.setTimeout(() => {
      setLetterAnimPhase('typing_text');
    }, 1520);

    return () => {
      clearTimeout(pullTimer);
      clearTimeout(readTimer);
    };
  }, [letterModalOpen, replayLetterKey]);

  // Hiệu ứng từng chữ hiện lên (Typewriter) sau khi lá thư đã được rút ra ngoài
  useEffect(() => {
    if (!letterModalOpen || letterAnimPhase !== 'typing_text') return;
    if (typedCharCount >= totalLetterChars) return;

    const stepMs = totalLetterChars > 350 ? 18 : totalLetterChars > 180 ? 24 : 32;
    const timer = window.setTimeout(() => {
      setTypedCharCount((prev) => Math.min(totalLetterChars, prev + 1));
    }, stepMs);

    return () => clearTimeout(timer);
  }, [letterModalOpen, letterAnimPhase, typedCharCount, totalLetterChars]);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const dodgeZoneRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<CardStage>(0);
  const toTinhAcceptedRef = useRef<boolean>(false);
  const goStageRef = useRef<((s: CardStage) => void) | null>(null);
  const blowVideoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const blowLoopRef = useRef<number>(0);
  const candlesBlownOutRef = useRef<boolean>(false);
  const blownOutAtRef = useRef<number>(0);
  const blowLevelRef = useRef<number>(0);

  stageRef.current = stage;
  toTinhAcceptedRef.current = toTinhAccepted;
  candlesBlownOutRef.current = candlesBlownOut;

  // Nhạc nền không bản quyền hoặc link tự chọn
  useEffect(() => {
    if (isLocked || isExpired || isPendingApproval) return;
    bgmPlayer.setTrack(card.bgmId || 'preset:we-wish-you');
    return () => {
      if (!isPreview) bgmPlayer.stop();
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current = null;
      }
      bgmPlayer.setDucking(false);
    };
  }, [card.bgmId, isLocked, isExpired, isPendingApproval, isPreview]);

  const ensureAudioStarts = () => {
    if (!muted && card.bgmId !== 'none') {
      bgmPlayer.setTrack(card.bgmId || 'preset:we-wish-you');
      bgmPlayer.start();
    }
  };

  // Khởi tạo sân khấu Three.js 4 giai đoạn chuẩn tin1511/noelnt
  useEffect(() => {
    if (isLocked || isExpired || isPendingApproval) return;
    const container = canvasMountRef.current;
    if (!container) return;

    // Luôn giữ đầy đủ animation hạt 3D, tuyết rơi, xoay mô hình & hiệu ứng bung ảnh Polaroid (RM = false như bản gốc noelnt)
    const prefersReducedMotion = false;
    const isSoftwareGl = detectSoftwareWebGL();
    const isWeak =
      isSoftwareGl ||
      (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
      window.innerWidth < 640;

    const N = isSoftwareGl ? 2400 : isWeak ? 4500 : 7000;
    const SN = isSoftwareGl ? 320 : isWeak ? 600 : 900;

    const width = Math.max(container.clientWidth, 280);
    const height = Math.max(container.clientHeight, 360);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.replaceChildren(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1622);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    const updateCameraDistance = (w: number, h: number) => {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.position.z = Math.max(16.5, 16 / (2 * Math.tan((25 * Math.PI) / 180) * camera.aspect));
    };
    updateCameraDistance(width, height);

    const group = new THREE.Group();
    scene.add(group);

    // Dữ liệu vị trí & màu cho 4 giai đoạn
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const seed = new Float32Array(N * 4);
    const TP: (Float32Array | null)[] = [
      null,
      new Float32Array(N * 3),
      new Float32Array(N * 3),
      new Float32Array(N * 3),
    ];
    const TC: Float32Array[] = [
      new Float32Array(N * 3),
      new Float32Array(N * 3),
      new Float32Array(N * 3),
      new Float32Array(N * 3),
    ];

    const cc = new THREE.Color();
    for (let i = 0; i < N * 4; i++) seed[i] = Math.random();
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      const r = Math.random();
      cc.set(r < 0.5 ? '#ffd98a' : r < 0.8 ? '#ffffff' : '#9fd4ff');
      TC[0][i * 3] = cc.r;
      TC[0][i * 3 + 1] = cc.g;
      TC[0][i * 3 + 2] = cc.b;
    }

    // Đích 1: Chữ 2 dòng người dùng tự nhập
    if (TP[1]) {
      buildTextTargets(headlinePair, N, TP[1], TC[1], card.accentColor);
      if (document.fonts && typeof document.fonts.load === 'function') {
        Promise.race([
          document.fonts.load('700 142px "Be Vietnam Pro"', `${headlinePair[0]} ${headlinePair[1]}`),
          new Promise((res) => setTimeout(res, 1200)),
        ]).then(() => {
          if (TP[1] && !disposed) {
            buildTextTargets(headlinePair, N, TP[1], TC[1], card.accentColor);
          }
        });
      }
    }

    // Đích 2: Phong thư 3D
    if (TP[2]) {
      buildEnvelopeTargets(N, TP[2], TC[2]);
    }

    // Đích 3: Cây thông / mô hình 3D theo dịp
    if (TP[3]) {
      buildStage3Targets(card.occasion, card.accentColor, N, TP[3], TC[3]);
    }

    // Sprite hạt sáng mềm
    const spr = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d')!;
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.4, 'rgba(255,255,255,.65)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pm = new THREE.PointsMaterial({
      size: 0.17,
      map: spr,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Points(geo, pm));

    // Tuyết / cánh hoa nền rơi nhẹ
    const sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 36;
      sp[i * 3 + 1] = (Math.random() - 0.5) * 18;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const sm = new THREE.PointsMaterial({
      size: 0.14,
      map: spr,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(sg, sm));

    // Các khung ảnh Polaroid treo xoắn ốc quanh mô hình 3D (Stage 3)
    const disposableTextures: THREE.Texture[] = [spr];
    const disposableGeos: THREE.BufferGeometry[] = [geo, sg];
    const disposableMats: THREE.Material[] = [pm, sm];

    // Thiệp sinh nhật không treo/đặt ảnh trong bánh kem 3D; ảnh kỷ niệm duy nhất hiển thị trong bức thư
    const photoList: WebCardPhoto[] =
      card.occasion === 'sinh-nhat'
        ? []
        : card.photos && card.photos.length > 0
          ? card.photos
          : [
              {
                url: '',
                caption: card.greeting.replace(/\n/g, ' · '),
              },
            ];

    const photoGroups: THREE.Group[] = [];
    const picMeshes: THREE.Object3D[] = [];
    const backGeo = new THREE.PlaneGeometry(1.5, 1.78);
    const picGeo = new THREE.PlaneGeometry(1.3, 1.3);
    const hookGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const backMat = new THREE.MeshBasicMaterial({ color: 0xfff7ec, side: THREE.DoubleSide });
    const hookMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    disposableGeos.push(backGeo, picGeo, hookGeo);
    disposableMats.push(backMat, hookMat);

    photoList.forEach((p, i, arr) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 512;
      const x = cv.getContext('2d')!;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      disposableTextures.push(tex);

      const drawPlaceholder = () => {
        const g = x.createLinearGradient(0, 0, 512, 512);
        g.addColorStop(0, '#ff8a9a');
        g.addColorStop(1, '#ffd98a');
        x.fillStyle = g;
        x.fillRect(0, 0, 512, 512);
        x.fillStyle = '#fff';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.font = '180px sans-serif';
        x.fillText('♥', 256, 225);
        x.font = '600 36px "Be Vietnam Pro", sans-serif';
        x.fillText(arr.length === 1 && !p.url ? 'Thư Gửi Bạn' : `Ảnh ${i + 1}`, 256, 395);
        tex.needsUpdate = true;
      };

      drawPlaceholder();
      if (p.url) {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => {
          if (disposed) return;
          const s = Math.min(im.width, im.height);
          x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 512, 512);
          tex.needsUpdate = true;
        };
        im.src = p.url;
      }

      const pg = new THREE.Group();
      const back = new THREE.Mesh(backGeo, backMat);
      const picMat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      disposableMats.push(picMat);
      const pic = new THREE.Mesh(picGeo, picMat);
      pic.position.set(0, 0.14, 0.015);
      const hook = new THREE.Mesh(hookGeo, hookMat);
      hook.position.y = 0.95;
      pg.add(back, pic, hook);

      const y = arr.length === 1 ? -0.4 : -2.7 + (i / Math.max(1, arr.length - 1)) * 5.2;
      const a = i * 2.4;
      const r = (1 - (y + 4.4) / 9.2) * 3.4 * 0.95 + 0.35;
      pg.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
      pg.rotation.set(0, a, i % 2 ? 0.08 : -0.08);
      pg.scale.setScalar(0.001);
      pg.userData = { p, i, fallbackUrl: () => cv.toDataURL('image/jpeg', 0.9) };
      group.add(pg);
      photoGroups.push(pg);
      pic.userData.g = pg;
      picMeshes.push(pic);
    });

    // Điều phối 4 giai đoạn
    let curStage: CardStage = 0;
    let st = 0;
    let last = performance.now() / 1000;
    const t0 = last;
    let spin = 0;
    let drag = false;
    let moved = 0;
    let px = 0;

    let uiTimer: ReturnType<typeof setTimeout> | null = null;

    const goStage = (s: CardStage) => {
      curStage = s;
      stageRef.current = s;
      setStage(s);
      setStageUiReady(false);
      st = performance.now() / 1000 - t0;
      if (uiTimer) clearTimeout(uiTimer);
      const delayMs = s === 2 ? 1800 : s === 3 ? 2600 : 0;
      uiTimer = setTimeout(() => {
        if (!disposed) setStageUiReady(true);
      }, delayMs);
      if (s === 3 && !isPreview) {
        ensureAudioStarts();
      }
    };
    goStageRef.current = goStage;

    const timer1 = setTimeout(() => {
      if (curStage === 0) goStage(1);
    }, 3200);
    const timer2 = setTimeout(() => {
      if (curStage === 1) goStage(2);
    }, 8400);

    // Raycast & kéo xoay 3D bằng pointer
    const ray = new THREE.Raycaster();
    const cv = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      drag = true;
      moved = 0;
      px = e.clientX;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - px;
      px = e.clientX;
      moved += Math.abs(dx);
      if (curStage === 3) spin += dx * 0.008;
    };

    const onPointerUp = (e: PointerEvent) => {
      drag = false;
      if (moved > 8) return;

      if (curStage === 0) {
        goStage(1);
        return;
      }
      if (curStage === 1) {
        goStage(2);
        return;
      }
      if (curStage === 2) {
        if (card.occasion !== 'to-tinh' || toTinhAcceptedRef.current) {
          ensureAudioStarts();
          goStage(3);
        }
        return;
      }

      if (curStage === 3) {
        const rect = cv.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
          ),
          camera
        );
        const hit = ray.intersectObjects(picMeshes)[0];
        if (hit && hit.object.userData.g && hit.object.userData.g.scale.x > 0.6) {
          const ud = hit.object.userData.g.userData;
          const p: WebCardPhoto = ud.p;
          setLightboxPhoto({
            url: p.url || ud.fallbackUrl(),
            caption: p.caption,
          });
        }
      }
    };

    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(entry.contentRect.width, 260);
      const h = Math.max(entry.contentRect.height, 260);
      renderer.setSize(w, h);
      updateCameraDistance(w, h);
    });
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
          return;
        }
      } catch {
        // fallback
      }
      frameId = window.setTimeout(cb, 80);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - last);
      const t = now - t0;
      last = now;

      const tp = TP[curStage];
      const tc = TC[curStage];
      const wob = prefersReducedMotion ? 0 : 0.03;
      const isHeartBeat = card.occasion === 'valentine' && curStage === 3 && !prefersReducedMotion;
      const beat = isHeartBeat ? 1 + Math.sin(t * 3.1) * 0.05 : 1;
      const isBirthdayStage3 = card.occasion === 'sinh-nhat' && curStage === 3;
      const blownElapsed = candlesBlownOutRef.current
        ? Math.max(0, now - blownOutAtRef.current)
        : 0;
      const blowNorm = Math.min(1, blowLevelRef.current / 100);

      for (let i = 0; i < N; i++) {
        const j = i * 3;
        const s = i * 4;
        let tx: number;
        let ty: number;
        let tz: number;
        let targetR = tc[j];
        let targetG = tc[j + 1];
        let targetB = tc[j + 2];

        const isBirthdayFlame = isBirthdayStage3 && isBirthdayCandleFlameIndex(i, N);
        const isBirthdayStick =
          isBirthdayStage3 && isBirthdayCandleIndex(i, N) && !isBirthdayFlame;

        if (curStage === 0 || !tp) {
          const a = seed[s] * 6.283 + t * (0.2 + seed[s + 1] * 0.3);
          const b = seed[s + 2] * 3.14 + t * 0.12;
          const r = 5 + seed[s + 3] * 6;
          tx = r * Math.sin(b) * Math.cos(a);
          ty = r * Math.cos(b) * 0.7;
          tz = r * Math.sin(b) * Math.sin(a);
        } else if (isBirthdayFlame && candlesBlownOutRef.current) {
          // Khi người dùng thổi: cả 3 ngọn nến hóa thành làn khói nhẹ bay lên rồi tắt hẳn
          const puff = Math.min(2.4, blownElapsed);
          const curl = seed[s] * 6.283;
          tx = tp[j] + Math.sin(t * 4.5 + curl) * (0.12 + puff * 0.32);
          ty = tp[j + 1] + puff * (1.25 + seed[s + 1] * 0.9);
          tz = tp[j + 2] + Math.cos(t * 3.8 + curl) * (0.1 + puff * 0.28);
          const smokeFade = Math.max(0, 1 - blownElapsed / 1.45);
          targetR = 0.55 * smokeFade;
          targetG = 0.62 * smokeFade;
          targetB = 0.72 * smokeFade;
        } else if (isBirthdayFlame) {
          // Cả 3 ngọn nến đang cháy: bập bùng tự nhiên, nghiêng mạnh khi cảm nhận hơi thổi
          const sway = blowNorm * 0.55;
          tx =
            tp[j] +
            Math.sin(t * 9.5 + i * 0.6) * (0.045 + sway * 0.14) +
            sway * (0.28 + Math.sin(t * 14) * 0.1);
          ty = tp[j + 1] + Math.sin(t * 12.2 + i * 0.9) * 0.07 - sway * 0.14;
          tz = tp[j + 2] + Math.cos(t * 8.7 + i * 0.5) * (0.045 + sway * 0.1);
        } else {
          tx = tp[j] * beat + Math.sin(t * 1.7 + i) * wob;
          ty = tp[j + 1] * beat + Math.cos(t * 1.3 + i) * wob;
          tz = tp[j + 2] * beat;
          if (isBirthdayStick && candlesBlownOutRef.current) {
            targetR *= 0.52;
            targetG *= 0.52;
            targetB *= 0.56;
          }
        }

        const k = prefersReducedMotion
          ? 1
          : 1 -
            Math.exp(
              -dt *
                (curStage === 0
                  ? 1.2
                  : isBirthdayFlame
                    ? 6.5
                    : 1.6 + seed[s + 1] * 3)
            );
        pos[j] += (tx - pos[j]) * k;
        pos[j + 1] += (ty - pos[j + 1]) * k;
        pos[j + 2] += (tz - pos[j + 2]) * k;

        col[j] += (targetR - col[j]) * k;
        col[j + 1] += (targetG - col[j + 1]) * k;
        col[j + 2] += (targetB - col[j + 2]) * k;
      }

      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      if (curStage === 3) {
        if (!drag && !prefersReducedMotion) spin += dt * 0.15;
        photoGroups.forEach((pg, i) => {
          const e = Math.max(0, Math.min(1, (t - st - 1.4 - i * 0.25) / 0.8));
          pg.scale.setScalar(0.001 + e * e * (3 - 2 * e));
          pg.rotation.x = Math.sin(t * 1.2 + i) * 0.04;
        });
        sm.opacity += (0.8 - sm.opacity) * dt;
      } else {
        photoGroups.forEach((pg) => {
          pg.scale.setScalar(0.001);
        });
      }

      group.rotation.y = curStage === 3 ? spin : prefersReducedMotion ? 0 : Math.sin(t * 0.4) * 0.12;
      group.position.y = prefersReducedMotion ? 0 : Math.sin(t * 0.8) * 0.15;
      pm.size = prefersReducedMotion ? 0.17 : 0.17 + Math.sin(t * 2.2) * 0.025;

      if (!prefersReducedMotion) {
        for (let i = 0; i < SN; i++) {
          sp[i * 3 + 1] -= dt * (0.8 + (i % 5) * 0.15);
          sp[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.35;
          if (sp[i * 3 + 1] < -9) sp[i * 3 + 1] = 9;
        }
        sg.attributes.position.needsUpdate = true;
      }

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (uiTimer) clearTimeout(uiTimer);
      resizeObserver.disconnect();
      cv.removeEventListener('pointerdown', onPointerDown);
      cv.removeEventListener('pointermove', onPointerMove);
      cv.removeEventListener('pointerup', onPointerUp);
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableTextures.forEach((tx) => tx.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [card.occasion, card.accentColor, card.greeting, card.photos, isLocked, isExpired, isPendingApproval]);

  const handleDodgeNoButton = () => {
    const zone = dodgeZoneRef.current;
    const maxW = zone ? Math.max(70, Math.min(140, zone.clientWidth / 2 - 65)) : 90;
    const maxH = 52;
    setNoBtnPos({
      x: (Math.random() * 2 - 1) * maxW,
      y: (Math.random() * 2 - 1) * maxH,
    });
    setNoAttempts((n) => n + 1);
  };

  const toggleVoiceAudio = () => {
    if (!card.voiceAudioUrl) return;
    if (!voiceAudioRef.current) {
      const audio = new Audio(card.voiceAudioUrl);
      audio.onended = () => {
        setVoicePlaying(false);
        bgmPlayer.setDucking(false);
      };
      voiceAudioRef.current = audio;
    }
    const audio = voiceAudioRef.current;
    if (voicePlaying) {
      audio.pause();
      setVoicePlaying(false);
      bgmPlayer.setDucking(false);
    } else {
      bgmPlayer.setDucking(true);
      audio.play().catch(() => {});
      setVoicePlaying(true);
    }
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    bgmPlayer.setMuted(next);
    if (!next) {
      bgmPlayer.setTrack(card.bgmId || 'preset:we-wish-you');
      bgmPlayer.start();
    }
  };

  const stopHiddenCamera = () => {
    if (blowLoopRef.current) {
      window.clearInterval(blowLoopRef.current);
      blowLoopRef.current = 0;
    }
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((track) => track.stop());
      camStreamRef.current = null;
    }
    if (blowVideoRef.current) {
      blowVideoRef.current.srcObject = null;
    }
    blowLevelRef.current = 0;
    setBlowLevel(0);
    setCamStatus((prev) => (prev === 'denied' || prev === 'unsupported' ? prev : 'idle'));
  };

  const extinguishCandles = () => {
    if (candlesBlownOutRef.current) return;
    blownOutAtRef.current = performance.now() / 1000;
    candlesBlownOutRef.current = true;
    setCandlesBlownOut(true);
    stopHiddenCamera();
  };

  const startHiddenCamera = async () => {
    if (card.occasion !== 'sinh-nhat' || candlesBlownOutRef.current) return;
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCamStatus('unsupported');
      return;
    }

    stopHiddenCamera();
    setCamStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
        audio: false,
      });

      camStreamRef.current = stream;
      const video = blowVideoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        camStreamRef.current = null;
        setCamStatus('idle');
        return;
      }

      video.srcObject = stream;
      await video.play().catch(() => {});
      setCamStatus('active');

      // Phân tích khung hình ẩn (96x72) để nhận diện cử chỉ thổi vùng miệng mà không hiển thị khuôn mặt
      const W = 96;
      const H = 72;
      const analysisCanvas = document.createElement('canvas');
      analysisCanvas.width = W;
      analysisCanvas.height = H;
      const ctx = analysisCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const prevLuma = new Float32Array(W * H);
      let warmupFrames = 0;
      let progress = 0;

      blowLoopRef.current = window.setInterval(() => {
        if (candlesBlownOutRef.current || !blowVideoRef.current || blowVideoRef.current.readyState < 2) {
          return;
        }

        ctx.drawImage(blowVideoRef.current, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        let mouthDiffSum = 0;
        let mouthActivePixels = 0;
        let mouthTotalPixels = 0;
        let outerDiffSum = 0;
        let outerTotalPixels = 0;

        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const p = y * W + x;
            const idx = p * 4;
            const luma = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            const diff = Math.abs(luma - prevLuma[p]);
            prevLuma[p] = luma;

            const inMouthZone = x >= 26 && x <= 70 && y >= 32 && y <= 64;
            if (inMouthZone) {
              mouthDiffSum += diff;
              if (diff > 9) mouthActivePixels++;
              mouthTotalPixels++;
            } else if (x < 18 || x > 78 || y < 14) {
              outerDiffSum += diff;
              outerTotalPixels++;
            }
          }
        }

        warmupFrames++;
        if (warmupFrames <= 7) return;

        const mouthMotion = mouthTotalPixels > 0 ? mouthDiffSum / mouthTotalPixels : 0;
        const mouthActiveRatio = mouthTotalPixels > 0 ? mouthActivePixels / mouthTotalPixels : 0;
        const outerMotion = outerTotalPixels > 0 ? outerDiffSum / outerTotalPixels : 0;

        // Tập trung chuyển động vùng miệng/hơi thổi phía trước camera và tránh nhiễu rung cả khung hình lớn
        const isBlowingGesture =
          mouthMotion > 5.0 &&
          mouthActiveRatio > 0.055 &&
          outerMotion < 28 &&
          mouthMotion >= outerMotion * 0.85;

        if (isBlowingGesture) {
          const focusRatio = Math.min(2.2, mouthMotion / Math.max(2.5, outerMotion));
          const gain = Math.min(18, (mouthMotion - 4.2) * 1.45 * Math.max(0.85, focusRatio));
          progress = Math.min(100, progress + gain);
        } else {
          progress = Math.max(0, progress - 4.2);
        }

        blowLevelRef.current = progress;
        setBlowLevel(Math.round(progress));

        if (progress >= 100) {
          extinguishCandles();
        }
      }, 65);
    } catch {
      setCamStatus('denied');
    }
  };

  const relightCandles = () => {
    candlesBlownOutRef.current = false;
    setCandlesBlownOut(false);
    blowLevelRef.current = 0;
    setBlowLevel(0);
    if (!isPreview) {
      startHiddenCamera();
    }
  };

  // Tự động mở camera ẩn (không hiện mặt) khi vào màn bánh kem sinh nhật (Stage 3)
  useEffect(() => {
    if (
      card.occasion !== 'sinh-nhat' ||
      stage !== 3 ||
      isPreview ||
      isLocked ||
      isExpired ||
      isPendingApproval ||
      candlesBlownOut
    ) {
      if (stage !== 3) stopHiddenCamera();
      return;
    }

    startHiddenCamera();
    return () => {
      stopHiddenCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.occasion, stage, isPreview, isLocked, isExpired, isPendingApproval]);

  useEffect(() => {
    return () => {
      stopHiddenCamera();
    };
  }, []);

  // Trạng thái bị khóa hoặc từ chối duyệt
  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#0b1622] text-[#F7F1E8] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[#E6BE73]/25 bg-[#111E2D] p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#B83B4A]/20 text-[#F09D8B] flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold m-0">Web thiệp đã bị từ chối hoặc tạm khóa</h2>
          <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
            Quản trị viên đã từ chối duyệt hoặc tạm khóa web thiệp này. Vui lòng hoàn tất thanh toán hoặc liên hệ shop để được hỗ trợ.
          </p>
          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold cursor-pointer"
            >
              Về trang chủ {CONFIG.shopName}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Trạng thái đang chờ Admin duyệt thanh toán
  if (isPendingApproval) {
    return (
      <div className="min-h-screen bg-[#0b1622] text-[#F7F1E8] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-amber-500/35 bg-[#111E2D] p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold m-0">Web thiệp đang chờ Admin duyệt</h2>
          <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
            Web thiệp này đang ở trạng thái <strong>Chờ duyệt thanh toán</strong>. Ngay sau khi Admin xác nhận, thiệp 3D và mã QR sẽ tự động được kích hoạt.
          </p>
          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold cursor-pointer"
            >
              Về trang chủ {CONFIG.shopName}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Trạng thái hết hạn
  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#0b1622] text-[#F7F1E8] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[#E6BE73]/25 bg-[#111E2D] p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#E6BE73]/15 text-[#E6BE73] flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold m-0">Đường dẫn thiệp đã hết hạn lưu trữ</h2>
          <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
            Web thiệp <code className="text-[#E6BE73]">/c/{card.code}</code> đã hết thời hạn lưu trữ theo gói đã chọn. Cảm ơn bạn đã tin dùng {CONFIG.shopName}!
          </p>
          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold cursor-pointer"
            >
              Tạo web thiệp mới
            </button>
          )}
        </div>
      </div>
    );
  }

  const birthdayLetterPhoto =
    card.occasion === 'sinh-nhat' ? card.photos?.find((p) => Boolean(p?.url)) || null : null;

  return (
    <div
      className={`${
        isPreview ? 'h-[560px] rounded-2xl border border-[#E6BE73]/25' : 'fixed inset-0'
      } bg-[#0b1622] text-[#F7F1E8] flex flex-col overflow-hidden select-none`}
    >
      {/* Video camera ẩn hoàn toàn (không hiển thị khuôn mặt lên màn hình) dùng để phát hiện thổi nến sinh nhật */}
      {card.occasion === 'sinh-nhat' && (
        <video
          ref={blowVideoRef}
          playsInline
          muted
          autoPlay
          aria-hidden="true"
          className="fixed -left-[9999px] -top-[9999px] w-px h-px opacity-0 pointer-events-none"
        />
      )}

      {/* Không gian 3D toàn màn hình chuẩn tin1511/noelnt — link riêng chỉ hiện thiệp */}
      <div className="relative flex-1 min-h-0">
        <div ref={canvasMountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

        {/* Nút tắt/bật nhạc góc trên phải gọn nhẹ như tin1511/noelnt */}
        {card.bgmId !== 'none' && (
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Bật nhạc nền' : 'Tắt nhạc nền'}
            title={muted ? 'Bật nhạc nền' : 'Tắt nhạc nền'}
            className="absolute top-3.5 right-3.5 z-10 w-10 h-10 rounded-full border border-[#ffd98a]/35 bg-[#08101a]/85 text-[#fff7ec] flex items-center justify-center cursor-pointer hover:border-[#ffd98a]"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}

        {/* Chỉ dẫn & nút mở thư ở cạnh dưới xuất hiện mượt sau khi hạt tụ xong giống hoàn toàn noelnt */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-6 sm:pb-8 px-4 flex flex-col items-center gap-3 text-center z-10">
          {stage === 2 && stageUiReady && card.occasion === 'to-tinh' && !toTinhAccepted && (
            <div
              ref={dodgeZoneRef}
              className="animate-card-fade-up pointer-events-auto max-w-md w-full rounded-2xl bg-[#08101a]/95 border border-[#F09D8B]/40 p-4 sm:p-5 space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-center gap-2 text-[#F09D8B] text-xs font-semibold">
                <Heart className="w-4 h-4" />
                <span>{effectiveRecipient} ơi, {headlinePair[0]} {headlinePair[1]}</span>
              </div>
              <p className="text-xs text-[#cbd5e1] m-0">
                {noAttempts > 0
                  ? 'Nút Suy nghĩ lại chạy mất rồi, bấm Đồng ý luôn nhé!'
                  : `${card.senderName} đang chờ câu trả lời từ bạn`}
              </p>
              <div className="relative min-h-[82px] flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setToTinhAccepted(true);
                    ensureAudioStarts();
                    goStageRef.current?.(3);
                  }}
                  className="min-h-[44px] px-6 rounded-full bg-[#ffd98a] text-[#1a1208] text-xs sm:text-sm font-bold cursor-pointer z-10"
                >
                  Đồng ý luôn
                </button>
                <button
                  type="button"
                  onMouseEnter={handleDodgeNoButton}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleDodgeNoButton();
                  }}
                  onClick={handleDodgeNoButton}
                  style={{
                    transform: `translate(${noBtnPos.x}px, ${noBtnPos.y}px)`,
                    transition: 'transform 160ms ease-out',
                  }}
                  className="min-h-[40px] px-4 rounded-full border border-[#ffd98a]/30 bg-[#111E2D] text-[#cbd5e1] text-xs cursor-pointer"
                >
                  Suy nghĩ lại
                </button>
              </div>
            </div>
          )}

          {stage === 2 && stageUiReady && (card.occasion !== 'to-tinh' || toTinhAccepted) && (
            <div className="animate-card-fade-up pointer-events-auto flex flex-col items-center gap-2.5">
              <p className="text-xs sm:text-sm text-[#e2e8f0] opacity-75 m-0">
                Chạm vào phong thư để mở
              </p>
              <button
                type="button"
                onClick={() => {
                  ensureAudioStarts();
                  goStageRef.current?.(3);
                }}
                className="min-h-[44px] px-7 rounded-full bg-[#ffd98a] hover:bg-[#ffe5aa] text-[#1a1208] text-sm font-semibold cursor-pointer shadow-lg transition-transform active:scale-95"
              >
                Mở thư
              </button>
            </div>
          )}

          {stage === 3 && stageUiReady && (
            <div className="animate-card-fade-up pointer-events-auto flex flex-col items-center gap-2.5 w-full max-w-sm">
              {card.occasion === 'sinh-nhat' && (
                <div className="w-full rounded-2xl border border-[#ffd98a]/30 bg-[#08101a]/88 px-4 py-2.5 space-y-2 backdrop-blur-sm">
                  {!candlesBlownOut ? (
                    <>
                      <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-[#ffd98a] font-medium">
                        {camStatus === 'active' ? (
                          <Camera className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <CameraOff className="w-3.5 h-3.5 shrink-0 text-[#cbd5e1]" />
                        )}
                        <span>
                          {camStatus === 'active'
                            ? 'Camera đang bật ẩn (không hiện mặt) · Hãy thổi để tắt nến'
                            : camStatus === 'requesting'
                              ? 'Đang bật camera ẩn để nhận diện hơi thổi...'
                              : camStatus === 'denied' || camStatus === 'unsupported'
                                ? 'Chưa bật được camera · Bấm nút bên dưới để thổi nến'
                                : 'Bật camera ẩn (không hiện mặt) để thổi tắt nến'}
                        </span>
                      </div>

                      {camStatus === 'active' && (
                        <div className="w-full h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#ffd98a] to-[#ff8c42] transition-all duration-75"
                            style={{ width: `${Math.max(4, blowLevel)}%` }}
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {camStatus !== 'active' && camStatus !== 'requesting' && (
                          <button
                            type="button"
                            onClick={startHiddenCamera}
                            className="min-h-[34px] px-3.5 rounded-full border border-[#ffd98a]/40 bg-[#111E2D] hover:bg-[#192b40] text-[#ffd98a] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Mở camera thổi nến</span>
                          </button>
                        )}
                        {camStatus === 'active' && (
                          <button
                            type="button"
                            onClick={stopHiddenCamera}
                            className="min-h-[34px] px-3 rounded-full border border-white/15 bg-[#111E2D] text-[#cbd5e1] text-[11px] cursor-pointer"
                          >
                            Tắt cam
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={extinguishCandles}
                          className="min-h-[34px] px-3.5 rounded-full border border-[#ffd98a]/35 bg-[#1a1208]/80 hover:bg-[#2a1d0d] text-[#fff7ec] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Wind className="w-3.5 h-3.5 text-[#ffd98a]" />
                          <span>Thổi nến ngay</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-[#ffd98a] font-medium">
                        Nến đã tắt — ước một điều thật đẹp nhé!
                      </span>
                      <button
                        type="button"
                        onClick={relightCandles}
                        className="min-h-[32px] px-3 rounded-full border border-[#ffd98a]/40 bg-[#111E2D] hover:bg-[#192b40] text-[#ffd98a] text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Flame className="w-3.5 h-3.5" />
                        <span>Thắp lại nến</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs sm:text-sm text-[#e2e8f0] opacity-75 m-0">
                {card.occasion === 'sinh-nhat'
                  ? birthdayLetterPhoto
                    ? 'Kéo để xoay bánh kem · mở thư để xem ảnh kỷ niệm'
                    : 'Kéo để xoay bánh kem'
                  : 'Kéo để xoay · chạm vào ảnh để xem'}
              </p>
              <button
                type="button"
                onClick={() => setLetterModalOpen(true)}
                className="min-h-[44px] px-7 rounded-full bg-[#ffd98a] hover:bg-[#ffe5aa] text-[#1a1208] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-lg transition-transform active:scale-95"
              >
                <BookOpen className="w-4 h-4" />
                <span>Đọc lá thư</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Phong Thư Mở Nắp -> Rút Lá Thư Ra Ngoài -> Hiện Từng Chữ */}
      {letterModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#050a12]/90 flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLetterModalOpen(false);
          }}
        >
          {letterAnimPhase !== 'typing_text' ? (
            /* GIAI ĐOẠN 1 & 2: PHONG BÌ MỞ NẮP 3D VÀ RÚT BỨC THƯ RA NGOÀI */
            <div
              key={`env-stage-${replayLetterKey}`}
              className="relative my-auto w-full max-w-[440px] h-[340px] flex items-center justify-center select-none"
              style={{ perspective: '1100px' }}
            >
              {/* Thân dưới / Mặt lưng phong bì */}
              <div
                className={`relative w-[330px] sm:w-[380px] h-[230px] rounded-xl bg-[#c99b72] border border-[#e6be73]/45 shadow-2xl transition-all duration-700 ${
                  letterAnimPhase === 'pulling_letter'
                    ? 'translate-y-16 scale-95 opacity-75'
                    : 'translate-y-4 scale-100 opacity-100'
                }`}
              >
                {/* Lòng trong phong bì */}
                <div className="absolute inset-1.5 rounded-lg bg-[#6e482e] overflow-visible">
                  {/* Tờ giấy thư bên trong đang được rút dần lên trên ra ngoài phong bì */}
                  <div
                    className={`absolute left-3 right-3 rounded-md bg-[#fff7ec] text-[#2a1a1c] p-4 sm:p-5 shadow-xl border border-[#e2ceb5] transition-all duration-700 ease-out ${
                      letterAnimPhase === 'pulling_letter'
                        ? '-top-32 h-[265px] scale-[1.03]'
                        : 'top-3 h-[185px] scale-95'
                    }`}
                  >
                    <div className="border-b border-[#d9c3b8] pb-2 flex items-center justify-between">
                      <div>
                        <div className="text-[11px] font-medium text-[#7c5c4b]">Thư gửi</div>
                        <div className="text-sm sm:text-base font-bold text-[#2a1a1c] truncate">
                          {effectiveRecipient}
                        </div>
                      </div>
                      <Heart className="w-4 h-4 text-[#b83b4a] shrink-0" />
                    </div>
                    <div className="mt-3 flex items-start gap-3">
                      {birthdayLetterPhoto && (
                        <div className="w-14 h-16 shrink-0 rounded-sm bg-white p-1 pb-2.5 border border-[#e2ceb5] shadow-sm -rotate-2">
                          <div className="w-full h-full bg-[#e8d5be] rounded-[1px]" />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <div className="h-2.5 w-4/5 rounded bg-[#e8d5be]" />
                        <div className="h-2.5 w-full rounded bg-[#efe0cd]" />
                        <div className="h-2.5 w-3/4 rounded bg-[#e8d5be]" />
                        <div className="h-2.5 w-5/6 rounded bg-[#efe0cd]" />
                      </div>
                    </div>
                    <div className="mt-4 text-right text-xs italic text-[#7c5c4b]">
                      {card.senderName}
                    </div>
                  </div>
                </div>

                {/* Vạt túi trước của phong bì (Che phần thân dưới của tờ thư khi đang rút lên) */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none z-20"
                  style={{
                    background:
                      'linear-gradient(155deg, transparent 43%, #d8ad84 43.5%, #c5956b 100%)',
                  }}
                />
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none z-20"
                  style={{
                    background:
                      'linear-gradient(205deg, transparent 43%, #cfa176 43.5%, #b9895f 100%)',
                  }}
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-[58%] rounded-b-xl pointer-events-none z-20 border-t border-[#e6be73]/25"
                  style={{
                    background: 'linear-gradient(180deg, #deb48c 0%, #c49469 100%)',
                    clipPath: 'polygon(0 100%, 50% 18%, 100% 100%)',
                  }}
                />

                {/* Nắp phong bì tam giác phía trên mở lật 180 độ */}
                <div
                  className={`animate-envelope-flap absolute inset-x-0 top-0 h-[58%] pointer-events-none ${
                    letterAnimPhase === 'pulling_letter' ? 'z-0' : 'z-30'
                  }`}
                  style={{
                    background: 'linear-gradient(180deg, #e5bc93 0%, #c8986c 100%)',
                    clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                  }}
                />

                {/* Con dấu sáp đỏ ở giữa phong bì bung mở */}
                <div className="animate-wax-seal absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 z-40 w-11 h-11 rounded-full bg-[#9e2a2b] border-2 border-[#ffd98a]/70 shadow-lg flex items-center justify-center text-[#ffd98a]">
                  <Heart className="w-4 h-4 fill-current" />
                </div>
              </div>
            </div>
          ) : (
            /* GIAI ĐOẠN 3: BỨC THƯ ĐÃ ĐƯỢC LẤY RA NGOÀI & TỪNG CHỮ HIỆN LÊN */
            <div
              key={`letter-read-${replayLetterKey}`}
              className={`animate-letter-pullout my-auto w-full ${
                birthdayLetterPhoto ? 'max-w-[680px]' : 'max-w-[560px]'
              } rounded-md bg-[#fff7ec] text-[#2a1a1c] p-4 sm:p-6 shadow-2xl space-y-3.5 border border-[#e5d2bc]`}
            >
              <div className="border-b border-[#d9c3b8] pb-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-[#7c5c4b]">Thư gửi</div>
                  <div className="text-base sm:text-lg font-bold text-[#2a1a1c] truncate">
                    {effectiveRecipient}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReplayLetterKey((k) => k + 1)}
                    title="Xem lại hiệu ứng mở phong thư & từng chữ hiện lên"
                    className="min-h-[34px] px-2.5 rounded-full bg-[#f5e6d3] hover:bg-[#ecd8be] text-[#5c3a28] text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mở lại thư</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLetterModalOpen(false)}
                    aria-label="Đóng lá thư"
                    className="min-h-[34px] min-w-[34px] rounded-full bg-[#f5e6d3] text-[#2a1a1c] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {card.voiceAudioUrl && (
                <div className="rounded-lg border border-[#d9c3b8] bg-[#f7ecdc] p-2.5 sm:p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Music2 className="w-4 h-4 text-[#9a3412] shrink-0" />
                    <div className="text-xs text-[#2a1a1c] truncate">
                      <strong>Lời nhắn giọng nói</strong> từ {card.senderName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleVoiceAudio}
                    className="min-h-[34px] px-3.5 rounded-full bg-[#ffd98a] text-[#1a1208] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {voicePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{voicePlaying ? 'Tạm dừng' : 'Nghe'}</span>
                  </button>
                </div>
              )}

              <div
                className={
                  birthdayLetterPhoto
                    ? 'flex flex-col min-[440px]:flex-row items-center min-[440px]:items-stretch gap-4 sm:gap-5'
                    : 'space-y-3'
                }
              >
                {birthdayLetterPhoto && (
                  <div className="shrink-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxPhoto({
                          url: birthdayLetterPhoto.url,
                          caption: birthdayLetterPhoto.caption,
                        })
                      }
                      title="Bấm để phóng to ảnh"
                      className="group bg-white p-2 pb-2.5 rounded-sm shadow-md border border-[#e2ceb5] -rotate-1 hover:rotate-0 transition-transform cursor-pointer text-center w-[150px] sm:w-[184px]"
                    >
                      <img
                        src={birthdayLetterPhoto.url}
                        alt={birthdayLetterPhoto.caption || 'Ảnh kỷ niệm sinh nhật'}
                        className="w-full aspect-square object-cover rounded-[2px] block"
                      />
                      {birthdayLetterPhoto.caption && (
                        <span className="mt-1.5 block text-[11px] font-medium text-[#5c3a28] truncate">
                          {birthdayLetterPhoto.caption}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                <div className="flex-1 min-w-0 w-full flex flex-col justify-between gap-3">
                  {/* Nội dung bức thư hiện lên từng chữ (Chạm vào nội dung để hiện toàn bộ ngay nếu muốn) */}
                  <div
                    onClick={() => {
                      if (typedCharCount < totalLetterChars) {
                        setTypedCharCount(totalLetterChars);
                      }
                    }}
                    title={
                      typedCharCount < totalLetterChars
                        ? 'Chạm vào thư để hiện toàn bộ chữ ngay'
                        : undefined
                    }
                    className={`space-y-2.5 text-[0.95rem] sm:text-[1rem] leading-[1.75] text-[#2a1a1c] cursor-pointer ${
                      birthdayLetterPhoto ? 'min-h-[48px]' : 'min-h-[96px]'
                    }`}
                  >
                    {(() => {
                      let consumed = 0;
                      return letterParagraphs.map((para, idx) => {
                        const start = consumed;
                        const end = start + para.length;
                        consumed = end + 2; // +2 cho '\n\n' giữa các đoạn
                        if (typedCharCount <= start && idx > 0) return null;
                        const visibleLen = Math.max(0, Math.min(para.length, typedCharCount - start));
                        const visibleText = para.slice(0, visibleLen);
                        const isCurrentTypingPara =
                          typedCharCount < totalLetterChars &&
                          typedCharCount >= start &&
                          typedCharCount <= end;

                        return (
                          <p key={idx} className="m-0 whitespace-pre-line">
                            {visibleText}
                            {isCurrentTypingPara && (
                              <span className="animate-caret-blink inline-block ml-0.5 w-[2px] h-[1.05em] align-middle bg-[#8c4a27]" />
                            )}
                          </p>
                        );
                      });
                    })()}
                  </div>

                  {/* Chữ ký người gửi hiện lên mượt mà sau khi viết xong nội dung thư */}
                  <div
                    className={`pt-1 text-right italic text-[1rem] font-semibold text-[#5c3a28] transition-all duration-500 ${
                      typedCharCount >= totalLetterChars
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2'
                    }`}
                  >
                    {card.senderName}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#d9c3b8]/70 flex items-center justify-between gap-3">
                {typedCharCount < totalLetterChars ? (
                  <button
                    type="button"
                    onClick={() => setTypedCharCount(totalLetterChars)}
                    className="text-xs text-[#7c5c4b] underline bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Hiện toàn bộ chữ ngay
                  </button>
                ) : birthdayLetterPhoto ? (
                  <span className="text-[11px] text-[#7c5c4b]">Chạm vào ảnh để phóng to</span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setLetterModalOpen(false)}
                  className="min-h-[38px] px-5 rounded-full bg-[#ffd98a] hover:bg-[#ffe5aa] text-[#1a1208] text-sm font-semibold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox Ảnh Polaroid khi chạm vào ảnh treo trên mô hình 3D */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-[#050a12]/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="animate-card-modal-pop max-w-md w-full text-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inline-block bg-[#fff7ec] p-3 pb-8 rounded-sm shadow-2xl">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.caption || 'Ảnh kỷ niệm'}
                className="max-w-full max-h-[64vh] object-contain block"
              />
            </div>
            {lightboxPhoto.caption && (
              <p className="text-sm text-[#fff7ec] m-0">{lightboxPhoto.caption}</p>
            )}
            <div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="min-h-[40px] px-5 rounded-full bg-[#ffd98a] text-[#1a1208] text-xs font-semibold cursor-pointer"
              >
                Đóng ảnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
