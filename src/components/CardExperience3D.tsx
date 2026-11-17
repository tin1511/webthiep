import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Hand,
  Heart,
  Lock,
  Music2,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CONFIG, OccasionId } from '../config';
import { WebCardPhoto, WebCardRecord, buildCardShareUrl } from '../firebase';
import { bgmPlayer } from '../bgmPlayer';

interface CardExperience3DProps {
  card: WebCardRecord;
  isPreview?: boolean;
  onBackHome?: () => void;
}

type CardStage = 'particles' | 'greeting' | 'couple-or-question' | 'envelope' | 'open';

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

function createGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.28, 'rgba(255,238,204,0.88)');
    g.addColorStop(0.7, 'rgba(255,210,145,0.2)');
    g.addColorStop(1, 'rgba(255,210,145,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function fillOccasionTargets(
  occasion: OccasionId,
  accentHex: string,
  count: number,
  outPos: Float32Array,
  outCol: Float32Array
) {
  const info = CONFIG.occasions.find((o) => o.id === occasion);
  const primary = new THREE.Color(accentHex || info?.accentHex || '#E6BE73');
  const secondary = new THREE.Color(info?.secondaryHex || '#B83B4A');
  const warmWhite = new THREE.Color('#FFF8EC');

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    let x = 0;
    let y = 0;
    let z = 0;
    let mix = 0;

    if (occasion === 'noel') {
      if (i < count * 0.08) {
        const ang = (i / (count * 0.08)) * Math.PI * 2;
        const r = i % 2 === 0 ? 0.42 : 0.17;
        x = Math.cos(ang * 5) * r * 0.65;
        y = 2.12 + Math.sin(ang * 5) * r * 0.65;
        z = Math.sin(i * 1.9) * 0.06;
        mix = 0.04;
      } else if (i < count * 0.84) {
        const h = (i - count * 0.08) / (count * 0.76);
        const radius = (1 - h) * 1.55 + 0.05;
        const angle = h * Math.PI * 18 + (i % 7) * 0.25;
        x = Math.cos(angle) * radius;
        z = Math.sin(angle) * radius;
        y = -1.7 + h * 3.55;
        mix = i % 8 === 0 ? 0.92 : h * 0.25;
      } else {
        const a = i * 2.39996;
        const r = 1.85 + (i % 9) * 0.16;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = ((i % 45) / 45 - 0.5) * 4.2;
        mix = 0.12;
      }
    } else if (occasion === 'valentine') {
      if (i < count * 0.86) {
        const u = (i * 2.39996) % (Math.PI * 2);
        const layer = ((i % 15) / 15) * 2 - 1;
        const scale = 0.098 * (1 - Math.abs(layer) * 0.16);
        const hx = 16 * Math.pow(Math.sin(u), 3);
        const hy =
          13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
        x = hx * scale;
        y = hy * scale + 0.18;
        z = layer * 0.5 * Math.sqrt(Math.max(0.05, 1 - Math.abs(hx) / 18));
        mix = 0.3 + 0.65 * (1 - Math.abs(layer));
      } else {
        const a = i * 1.9;
        const r = 2.0 + (i % 6) * 0.18;
        x = Math.cos(a) * r;
        y = Math.sin(a * 0.8) * 1.5;
        z = Math.sin(a) * r * 0.6;
        mix = 0.1;
      }
    } else if (occasion === 'to-tinh') {
      if (i < count * 0.58) {
        const p = i / (count * 0.58);
        if (p < 0.78) {
          const theta = -0.35 * Math.PI + (p / 0.78) * 1.45 * Math.PI;
          const r = 0.98;
          x = Math.cos(theta) * r;
          y = 0.45 + Math.sin(theta) * r;
          if (p > 0.6) {
            const tail = (p - 0.6) / 0.18;
            x *= 1 - tail * 0.88;
            y = 0.45 - tail * 1.05;
          }
          z = Math.sin(p * 24) * 0.14;
          mix = 0.28;
        } else {
          const a = p * 40;
          const rad = 0.19 * ((i % 5) / 5);
          x = Math.cos(a) * rad;
          y = -1.1 + Math.sin(a) * rad;
          z = Math.sin(a * 2) * 0.12;
          mix = 0.92;
        }
      } else {
        const ring = i % 2 === 0 ? 1 : -1;
        const a = i * 0.19;
        const r = 2.0;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * 0.44 * ring;
        z = Math.sin(a) * r * 0.8;
        mix = ring > 0 ? 0.18 : 0.75;
      }
    } else if (occasion === 'tet') {
      if (i < count * 0.62) {
        const p = i / (count * 0.62);
        const lat = (p - 0.5) * Math.PI * 0.92;
        const lon = i * 2.39996;
        const r = 1.2 * Math.cos(lat * 0.85);
        x = Math.cos(lon) * r;
        z = Math.sin(lon) * r;
        y = Math.sin(lat) * 1.38 + 0.15;
        mix = i % 4 === 0 ? 0.12 : 0.86;
      } else if (i < count * 0.76) {
        const s = (i - count * 0.62) / (count * 0.14);
        const strand = (i % 7) - 3;
        x = strand * 0.085;
        z = ((i % 3) - 1) * 0.06;
        y = -1.14 - s * 0.72;
        mix = 0.18;
      } else {
        const a = i * 1.618;
        const rad = 1.65 + (i % 7) * 0.18;
        x = Math.cos(a) * rad;
        y = Math.sin(a * 1.3) * 1.5;
        z = Math.sin(a) * rad * 0.85;
        mix = i % 2 === 0 ? 0.06 : 0.78;
      }
    } else {
      if (i < count * 0.55) {
        const isTop = i % 3 === 0;
        const angle = i * 2.39996;
        const rad = isTop ? 0.92 : 1.4;
        const heightOffset = isTop ? 0.22 : -0.68;
        const layerY = ((i % 10) / 10 - 0.5) * 0.72;
        x = Math.cos(angle) * rad;
        z = Math.sin(angle) * rad;
        y = heightOffset + layerY;
        mix = isTop ? 0.62 : 0.22;
      } else if (i < count * 0.78) {
        const candleIdx = (i % 3) - 1;
        const sub = (i / (count * 0.23)) * 10;
        const isFlame = i % 4 === 0;
        x = candleIdx * 0.42 + Math.cos(sub) * (isFlame ? 0.05 : 0.06);
        z = Math.sin(sub) * (isFlame ? 0.05 : 0.06);
        y = isFlame ? 1.25 + ((i % 5) / 5) * 0.28 : 0.62 + ((i % 8) / 8) * 0.55;
        mix = isFlame ? 0.92 : 0.08;
      } else {
        const a = i * 2.39996;
        const phi = Math.acos(1 - 2 * ((i % 50) / 50));
        const r = 1.95 + (i % 5) * 0.16;
        x = r * Math.sin(phi) * Math.cos(a);
        y = r * Math.cos(phi) * 0.75 + 0.3;
        z = r * Math.sin(phi) * Math.sin(a);
        mix = 0.45;
      }
    }

    outPos[idx] = x;
    outPos[idx + 1] = y;
    outPos[idx + 2] = z;

    const c = primary.clone().lerp(secondary, mix);
    if (i % 10 === 0) c.lerp(warmWhite, 0.55);
    outCol[idx] = c.r;
    outCol[idx + 1] = c.g;
    outCol[idx + 2] = c.b;
  }
}

export const CardExperience3D: React.FC<CardExperience3DProps> = ({
  card,
  isPreview = false,
  onBackHome,
}) => {
  // Hỗ trợ tham số ?to=Tên để đổi nhanh tên người nhận khi chia sẻ
  const effectiveRecipient = useMemo(() => {
    if (typeof window === 'undefined' || isPreview) return card.recipientName;
    const params = new URLSearchParams(window.location.search);
    const toOverride = params.get('to')?.trim();
    return toOverride ? toOverride.slice(0, 120) : card.recipientName;
  }, [card.recipientName, isPreview]);

  const isExpired =
    !isPreview && typeof card.expiresAtMs === 'number' && Date.now() > card.expiresAtMs;
  const isLocked = !isPreview && card.locked;

  const [stage, setStage] = useState<CardStage>('particles');
  const [muted, setMuted] = useState<boolean>(false);
  const [voicePlaying, setVoicePlaying] = useState<boolean>(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<WebCardPhoto | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [noBtnPos, setNoBtnPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [noAttempts, setNoAttempts] = useState<number>(0);
  const [frostClearedPct, setFrostClearedPct] = useState<number>(0);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const frostCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const dodgeZoneRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<CardStage>(stage);
  stageRef.current = stage;

  // Khởi tạo nhạc nền không bản quyền theo cấu hình của thiệp
  useEffect(() => {
    if (isLocked || isExpired) return;
    bgmPlayer.setTrack(card.bgmId || 'preset:we-wish-you');
    return () => {
      if (!isPreview) bgmPlayer.stop();
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current = null;
      }
      bgmPlayer.setDucking(false);
    };
  }, [card.bgmId, isLocked, isExpired, isPreview]);

  const ensureAudioStarts = () => {
    if (!muted && card.bgmId !== 'none') {
      bgmPlayer.setTrack(card.bgmId || 'preset:we-wish-you');
      bgmPlayer.start();
    }
  };

  // Tự chuyển giai đoạn intro nhẹ nhàng ở phần mở đầu
  useEffect(() => {
    if (isLocked || isExpired) return;
    if (stage === 'particles') {
      const t = setTimeout(() => setStage('greeting'), 2400);
      return () => clearTimeout(t);
    }
  }, [stage, isLocked, isExpired]);

  // Khởi tạo sân khấu Three.js 3D duy nhất cho trải nghiệm thiệp
  useEffect(() => {
    if (isLocked || isExpired) return;
    const container = canvasMountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSoftwareGl = detectSoftwareWebGL();
    const isWeak =
      isSoftwareGl ||
      prefersReducedMotion ||
      (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
      window.innerWidth < 640;

    const count = isSoftwareGl ? 900 : isWeak ? 1500 : 2800;

    const width = Math.max(container.clientWidth, 280);
    const height = Math.max(container.clientHeight, 260);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 60);
    camera.position.set(0, 0.2, 6.1);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
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
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const spriteTex = createGlowTexture();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const targetsPos = new Float32Array(count * 3);
    const targetsCol = new Float32Array(count * 3);

    fillOccasionTargets(card.occasion, card.accentColor, count, targetsPos, targetsCol);

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      if (prefersReducedMotion) {
        positions[idx] = targetsPos[idx];
        positions[idx + 1] = targetsPos[idx + 1];
        positions[idx + 2] = targetsPos[idx + 2];
      } else {
        positions[idx] = (Math.random() - 0.5) * 8;
        positions[idx + 1] = (Math.random() - 0.5) * 6;
        positions[idx + 2] = (Math.random() - 0.5) * 5;
      }
      colors[idx] = targetsCol[idx];
      colors[idx + 1] = targetsCol[idx + 1];
      colors[idx + 2] = targetsCol[idx + 2];
    }

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colAttr);

    const material = new THREE.PointsMaterial({
      size: isWeak ? 0.115 : 0.098,
      map: spriteTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    container.addEventListener('pointermove', onPointerMove, { passive: true });

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(entry.contentRect.width, 240);
      const h = Math.max(entry.contentRect.height, 240);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    const clock = new THREE.Clock();
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
        // fallback timeout
      }
      frameId = window.setTimeout(cb, 80);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      const posArr = posAttr.array as Float32Array;
      const moveAlpha = prefersReducedMotion ? 1 : 1 - Math.exp(-4.2 * dt);
      const isHeart = card.occasion === 'valentine';
      const beat = isHeart && !prefersReducedMotion ? 1 + Math.sin(elapsed * 3.2) * 0.065 : 1;

      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const shimmer = prefersReducedMotion ? 0 : Math.sin(elapsed * 1.9 + i * 0.14) * 0.025;
        posArr[idx] += (targetsPos[idx] * beat - posArr[idx]) * moveAlpha;
        posArr[idx + 1] += (targetsPos[idx + 1] * beat + shimmer - posArr[idx + 1]) * moveAlpha;
        posArr[idx + 2] += (targetsPos[idx + 2] * beat - posArr[idx + 2]) * moveAlpha;
      }
      posAttr.needsUpdate = true;

      if (!prefersReducedMotion) {
        points.rotation.y = THREE.MathUtils.damp(
          points.rotation.y,
          elapsed * 0.25 + pointerX * 0.45,
          4,
          dt
        );
        points.rotation.x = THREE.MathUtils.damp(points.rotation.x, pointerY * 0.2, 4, dt);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      geometry.dispose();
      material.dispose();
      spriteTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [card.occasion, card.accentColor, isLocked, isExpired, stage === 'open']);

  // Khởi tạo lớp sương giá lau trên Canvas ở bước Phong thư (`envelope`)
  useEffect(() => {
    if (stage !== 'envelope') return;
    const canvas = frostCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 300;
    ctx.globalCompositeOperation = 'source-over';
    const grad = ctx.createLinearGradient(0, 0, 480, 300);
    grad.addColorStop(0, '#E8EEF5');
    grad.addColorStop(0.5, '#D4DFEC');
    grad.addColorStop(1, '#E2E9F2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 480, 300);

    // Vẽ tinh thể sương mờ nhẹ
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.1})`;
      ctx.beginPath();
      ctx.arc((i * 73) % 480, (i * 137) % 300, 1 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#3B4252';
    ctx.font = '600 18px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Lau nhẹ lớp sương để mở phong thư', 240, 145);
    ctx.font = '400 13px "Be Vietnam Pro", sans-serif';
    ctx.fillStyle = '#525E75';
    ctx.fillText('Chạm hoặc kéo ngang màn hình', 240, 174);

    let isDrawing = false;
    let wipedSteps = 0;

    const wipeAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 38, 0, Math.PI * 2);
      ctx.fill();
      wipedSteps += 1;
      const pct = Math.min(100, Math.round((wipedSteps / 26) * 100));
      setFrostClearedPct(pct);
      if (wipedSteps >= 26) {
        ensureAudioStarts();
        setStage('open');
      }
    };

    const down = (e: PointerEvent) => {
      isDrawing = true;
      wipeAt(e.clientX, e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (isDrawing) wipeAt(e.clientX, e.clientY);
    };
    const up = () => {
      isDrawing = false;
    };

    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [stage]);

  const handleDodgeNoButton = () => {
    const zone = dodgeZoneRef.current;
    const maxW = zone ? Math.max(80, Math.min(150, zone.clientWidth / 2 - 70)) : 95;
    const maxH = 58;
    const nx = (Math.random() * 2 - 1) * maxW;
    const ny = (Math.random() * 2 - 1) * maxH;
    setNoBtnPos({ x: nx, y: ny });
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

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(buildCardShareUrl(card.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  // Trạng thái bị Admin khóa
  if (isLocked) {
    return (
      <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[#E6BE73]/25 bg-[#1B1512] p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#B83B4A]/20 text-[#F09D8B] flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold m-0">Thiệp này tạm thời bị khóa</h2>
          <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
            Quản trị viên đã tạm khóa đường dẫn <code className="text-[#E6BE73]">/c/{card.code}</code>. Nếu bạn là người tạo thiệp, vui lòng liên hệ shop để được hỗ trợ mở lại.
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

  // Trạng thái hết hạn link theo gói
  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-[#E6BE73]/25 bg-[#1B1512] p-6 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#E6BE73]/15 text-[#E6BE73] flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold m-0">Đường dẫn thiệp đã hết hạn lưu trữ</h2>
          <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">
            Web thiệp <code className="text-[#E6BE73]">/c/{card.code}</code> đã kết thúc thời gian lưu giữ theo gói đã chọn. Cảm ơn bạn đã tin dùng {CONFIG.shopName}!
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

  const occasionMeta =
    CONFIG.occasions.find((o) => o.id === card.occasion) || CONFIG.occasions[0];

  return (
    <div
      className={`${
        isPreview ? 'min-h-[540px] rounded-2xl border border-[#E6BE73]/25' : 'min-h-screen'
      } bg-[#120E0C] text-[#F7F1E8] flex flex-col overflow-hidden`}
    >
      {/* Thanh điều khiển âm thanh & liên kết phía trên (không backdrop-blur lên WebGL) */}
      <div className="border-b border-[#E6BE73]/15 bg-[#181310] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBackHome && !isPreview && (
            <button
              type="button"
              onClick={onBackHome}
              className="min-h-[40px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#221B17] text-xs font-medium text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#E6BE73]" />
              <span>Trang chủ</span>
            </button>
          )}
          <div className="truncate">
            <span className="text-xs text-[#E6BE73] font-medium">{occasionMeta.title}</span>
            <span className="text-xs text-[#A89B8E] mx-1.5">·</span>
            <span className="text-xs text-[#F7F1E8] font-semibold">
              Gửi {effectiveRecipient}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isPreview && (
            <button
              type="button"
              onClick={handleCopyUrl}
              className="min-h-[40px] px-3 rounded-xl border border-[#E6BE73]/25 bg-[#221B17] text-xs text-[#F7F1E8] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#E6BE73]" />}
              <span className="hidden sm:inline">{copied ? 'Đã sao chép' : 'Sao chép link'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Bật nhạc nền' : 'Tắt nhạc nền'}
            className="min-h-[40px] px-3 rounded-xl bg-[#261E19] hover:bg-[#322721] border border-[#E6BE73]/25 text-xs text-[#E6BE73] inline-flex items-center gap-1.5 cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{muted ? 'Đang tắt nhạc' : 'Nhạc nền'}</span>
          </button>
        </div>
      </div>

      {/* GIAI ĐOẠN MỞ THƯ (OPEN): Cây thông/hình 3D + ảnh bên trái (hoặc trên mobile), Thư bên phải (hoặc dưới mobile) */}
      {stage === 'open' ? (
        <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Khối trái / trên: Sân khấu 3D + bộ ảnh kỷ niệm treo */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative h-[300px] sm:h-[360px] rounded-2xl border border-[#E6BE73]/20 bg-[#191310] overflow-hidden">
              <div ref={canvasMountRef} className="absolute inset-0" />
              <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between text-xs text-[#D7CCC0]">
                <span className="font-medium text-[#E6BE73]">{occasionMeta.particleShapeLabel}</span>
                <span className="text-[#A89B8E]">Chạm để xoay 3D</span>
              </div>
            </div>

            {/* Album ảnh kỷ niệm treo cùng khung hình */}
            {card.photos.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-[#E6BE73] m-0">
                  Kỷ niệm lưu giữ ({card.photos.length} ảnh · chạm để phóng to)
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {card.photos.map((photo, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-[#E6BE73]/25 bg-[#1B1512] cursor-pointer p-0"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || `Kỷ niệm ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      {photo.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-[10px] text-[#F7F1E8] truncate">
                          {photo.caption}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Khối phải / dưới: Bức thư ấm áp + ghi âm giọng nói */}
          <div className="lg:col-span-6 rounded-2xl border border-[#E6BE73]/30 bg-[#1D1612] p-5 sm:p-8 space-y-5">
            <div className="space-y-1.5 border-b border-[#E6BE73]/15 pb-4">
              <p className="text-xs font-medium text-[#E6BE73] m-0">
                Thư gửi {effectiveRecipient}
              </p>
              <h2 className="font-script text-3xl sm:text-4xl text-[#F7F1E8] m-0 leading-tight">
                {card.greeting}
              </h2>
            </div>

            {card.voiceAudioUrl && (
              <div className="rounded-xl border border-[#E6BE73]/30 bg-[#14100E] p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[#E6BE73]/15 text-[#E6BE73] flex items-center justify-center shrink-0">
                    <Music2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#F7F1E8] truncate">
                      Lời nhắn giọng nói từ {card.senderName}
                    </div>
                    <div className="text-[11px] text-[#A89B8E]">
                      {voicePlaying ? 'Đang phát ghi âm...' : 'Nhấn để nghe giọng nói thật'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleVoiceAudio}
                  className="min-h-[40px] px-4 rounded-xl bg-[#E6BE73] text-[#1A1208] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {voicePlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{voicePlaying ? 'Tạm dừng' : 'Nghe'}</span>
                </button>
              </div>
            )}

            <div className="space-y-3 text-sm sm:text-base text-[#EAE0D5] leading-[1.8] whitespace-pre-line">
              {card.letter}
            </div>

            <div className="pt-4 border-t border-[#E6BE73]/15 flex items-end justify-between gap-4">
              <div className="text-xs text-[#A89B8E]">
                Tạo riêng tại {CONFIG.shopName}
              </div>
              <div className="text-right">
                <div className="text-xs text-[#A89B8E]">Thương mến,</div>
                <div className="font-script text-2xl text-[#E6BE73] font-bold">
                  {card.senderName}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CÁC BƯỚC TRÌNH DIỄN HẠT 3D THEO TRÌNH TỰ */
        <div className="relative flex-1 min-h-[460px] flex flex-col">
          <div ref={canvasMountRef} className="absolute inset-0" />

          <div className="relative z-10 flex-1 flex flex-col items-center justify-end p-5 sm:p-8 text-center">
            {stage === 'particles' && (
              <div className="max-w-md rounded-2xl bg-[#181310]/90 border border-[#E6BE73]/25 p-5 space-y-3">
                <p className="text-xs font-medium text-[#E6BE73] m-0">
                  Đang thắp sáng những hạt kỷ niệm...
                </p>
                <h2 className="font-script text-3xl text-[#F7F1E8] m-0">{card.greeting}</h2>
                <button
                  type="button"
                  onClick={() => {
                    ensureAudioStarts();
                    setStage('greeting');
                  }}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Chạm để mở thiệp</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {stage === 'greeting' && (
              <div className="max-w-md w-full rounded-2xl bg-[#181310]/92 border border-[#E6BE73]/30 p-6 space-y-4">
                <p className="text-xs font-medium text-[#E6BE73] m-0">
                  Từ {card.senderName} gửi tặng
                </p>
                <h2 className="font-script text-4xl text-[#F7F1E8] m-0 leading-tight">
                  {effectiveRecipient}
                </h2>
                <p className="text-sm text-[#D7CCC0] m-0">{card.greeting}</p>
                <button
                  type="button"
                  onClick={() => {
                    ensureAudioStarts();
                    if (card.occasion === 'to-tinh' || card.photos.length > 0) {
                      setStage('couple-or-question');
                    } else {
                      setStage('envelope');
                    }
                  }}
                  className="w-full min-h-[46px] rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Tiếp tục khám phá</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {stage === 'couple-or-question' && card.occasion === 'to-tinh' && (
              <div
                ref={dodgeZoneRef}
                className="max-w-md w-full rounded-2xl bg-[#181310]/95 border border-[#F09D8B]/40 p-6 space-y-5 overflow-hidden"
              >
                <Heart className="w-8 h-8 text-[#F09D8B] mx-auto" />
                <div className="space-y-1.5">
                  <h2 className="font-script text-3xl text-[#F7F1E8] m-0">
                    {effectiveRecipient} ơi, {card.greeting}
                  </h2>
                  <p className="text-xs text-[#C8BDB2] m-0">
                    {noAttempts > 0
                      ? 'Nút kia ngại quá nên chạy mất rồi, chọn Đồng ý đi mà!'
                      : `${card.senderName} đang hồi hộp chờ câu trả lời của bạn`}
                  </p>
                </div>

                <div className="relative min-h-[120px] flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      ensureAudioStarts();
                      setStage('envelope');
                    }}
                    className="min-h-[48px] px-7 py-2.5 rounded-xl bg-[#E6BE73] hover:bg-[#F0CC88] text-[#1A1208] text-sm font-bold inline-flex items-center gap-2 cursor-pointer z-10"
                  >
                    <Heart className="w-4 h-4" />
                    <span>Đồng ý luôn</span>
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
                    className="min-h-[44px] px-5 py-2 rounded-xl border border-[#E6BE73]/30 bg-[#261E1A] text-[#C8BDB2] text-xs font-medium cursor-pointer select-none"
                  >
                    Suy nghĩ lại
                  </button>
                </div>
              </div>
            )}

            {stage === 'couple-or-question' && card.occasion !== 'to-tinh' && (
              <div className="max-w-sm w-full rounded-2xl bg-[#181310]/94 border border-[#E6BE73]/30 p-5 space-y-4">
                {card.photos[0] && (
                  <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[#E6BE73]/25">
                    <img
                      src={card.photos[0].url}
                      alt={card.photos[0].caption || 'Khoảnh khắc kỷ niệm'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <p className="text-sm text-[#F7F1E8] font-medium m-0">
                  {card.photos[0]?.caption || `Khoảnh khắc đặc biệt cùng ${effectiveRecipient}`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    ensureAudioStarts();
                    setStage('envelope');
                  }}
                  className="w-full min-h-[46px] rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold cursor-pointer"
                >
                  Mở phong thư bí mật
                </button>
              </div>
            )}

            {stage === 'envelope' && (
              <div className="max-w-md w-full rounded-2xl bg-[#181310]/95 border border-[#E6BE73]/35 p-5 space-y-4">
                <div className="flex items-center justify-between text-xs text-[#E6BE73]">
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <Hand className="w-4 h-4" />
                    <span>Phong thư lau sương</span>
                  </span>
                  <span className="tabular-nums">{frostClearedPct}%</span>
                </div>

                {/* Phong thư thật nằm dưới, lớp sương giá Canvas phủ lên trên để người dùng lau */}
                <div className="relative h-[220px] rounded-xl overflow-hidden border border-[#E6BE73]/30 bg-[#2B2019] flex flex-col items-center justify-center p-4 select-none">
                  <div className="space-y-2 text-center">
                    <p className="font-script text-3xl text-[#E6BE73] m-0">
                      Gửi {effectiveRecipient}
                    </p>
                    <p className="text-xs text-[#EAE0D5] m-0">
                      Một bức thư viết riêng từ {card.senderName}
                    </p>
                  </div>
                  <canvas
                    ref={frostCanvasRef}
                    className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    ensureAudioStarts();
                    setStage('open');
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-[#E6BE73]/35 bg-[#251D19] hover:bg-[#312620] text-[#F7F1E8] text-xs font-medium cursor-pointer"
                >
                  Mở thư ngay
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox xem ảnh lớn */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-lg w-full rounded-2xl border border-[#E6BE73]/30 bg-[#1B1512] p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[#F7F1E8] truncate">
                {lightboxPhoto.caption || 'Ảnh kỷ niệm'}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="min-h-[38px] min-w-[38px] rounded-lg bg-[#261E1A] text-[#F7F1E8] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || 'Ảnh kỷ niệm'}
              className="w-full max-h-[68vh] object-contain rounded-xl bg-black/30"
            />
          </div>
        </div>
      )}
    </div>
  );
};
