import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CONFIG, OccasionId } from '../config';

interface HeroParticleDemoProps {
  activeOccasion: OccasionId;
  onSelectOccasion: (id: OccasionId) => void;
}

/**
 * Sprite hạt ánh sáng mềm chuẩn tin1511/noelnt (64x64 radial glow).
 */
function createNoelntSpriteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  if (x) {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.4, 'rgba(255,255,255,.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Kiểm tra WebGL phần mềm (SwiftShader / llvmpipe / WARP) để tối ưu tốc độ khung hình.
 */
function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpuName = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpuName);
  } catch {
    return false;
  }
}

/**
 * Sinh tọa độ mục tiêu 3D & màu sắc chuẩn phong cách hạt tin1511/noelnt cho từng dịp lễ.
 */
function buildTargetsForOccasion(
  occasion: OccasionId,
  count: number,
  outPos: Float32Array,
  outCol: Float32Array
): void {
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

  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let z = 0;

    if (occasion === 'noel') {
      // Đúng công thức cây thông Noel 3D từ tin1511/noelnt (tỉ lệ vừa khung Hero)
      const r = rnd();
      if (r < 0.05) {
        // Thân cây gỗ nâu
        const a = rnd() * 6.283;
        const q = rnd() * 0.22;
        x = Math.cos(a) * q;
        z = Math.sin(a) * q;
        y = -2.35 + rnd() * 0.45;
        setHex(i, '#8a5a2b');
      } else if (r < 0.075) {
        // Ngôi sao tròn phát sáng trên đỉnh
        const a = rnd() * 6.283;
        const b = rnd() * 3.14;
        const q = rnd() * 0.21;
        x = Math.sin(b) * Math.cos(a) * q;
        y = 2.3 + Math.cos(b) * q;
        z = Math.sin(b) * Math.sin(a) * q;
        setHex(i, '#fff1b0');
      } else {
        // Tán cây thông xòe tầng tự nhiên + châu đèn trang trí
        const t = Math.pow(rnd(), 0.85);
        const a = rnd() * 6.283;
        const q = (1 - t) * 1.55 * (0.55 + 0.45 * rnd()) * (0.88 + 0.12 * Math.sin(t * 22));
        x = Math.cos(a) * q;
        z = Math.sin(a) * q;
        y = -1.98 + t * 4.2;
        if (rnd() < 0.13) {
          setHex(i, ['#ff4d5e', '#ffd98a', '#bfe6ff'][(rnd() * 3) | 0]);
        } else {
          setHSL(i, 0.36 + rnd() * 0.06, 0.6, 0.3 + rnd() * 0.25);
        }
      }
    } else if (occasion === 'valentine') {
      // Trái tim 3D hạt sáng bồng bềnh
      const u = rnd() * Math.PI * 2;
      const layer = rnd() * 2 - 1;
      const scale = 0.105 * (1 - Math.abs(layer) * 0.16);
      const hx = 16 * Math.pow(Math.sin(u), 3);
      const hy =
        13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
      x = hx * scale + (rnd() - 0.5) * 0.08;
      y = hy * scale + 0.2 + (rnd() - 0.5) * 0.08;
      z = layer * 0.55 * Math.sqrt(Math.max(0.06, 1 - Math.abs(hx) / 18));
      setHex(i, rnd() < 0.22 ? '#ffd98a' : rnd() < 0.65 ? '#ff4d6d' : '#ff8a9a');
    } else if (occasion === 'to-tinh') {
      // Dấu hỏi lãng mạn & hai vòng nhẫn quỹ đạo
      if (i < count * 0.55) {
        const p = i / (count * 0.55);
        if (p < 0.78) {
          const theta = -0.35 * Math.PI + (p / 0.78) * 1.45 * Math.PI;
          const r = 1.05;
          x = Math.cos(theta) * r + (rnd() - 0.5) * 0.07;
          y = 0.48 + Math.sin(theta) * r + (rnd() - 0.5) * 0.07;
          if (p > 0.6) {
            const tail = (p - 0.6) / 0.18;
            x *= 1 - tail * 0.88;
            y = 0.48 - tail * 1.1;
          }
          z = Math.sin(p * 24) * 0.16;
          setHex(i, '#ffd98a');
        } else {
          const a = rnd() * 6.283;
          const rad = 0.22 * rnd();
          x = Math.cos(a) * rad;
          y = -1.12 + Math.sin(a) * rad;
          z = (rnd() - 0.5) * 0.12;
          setHex(i, '#ff7a8a');
        }
      } else {
        const ring = i % 2 === 0 ? 1 : -1;
        const a = rnd() * 6.283;
        const r = 1.98 + (rnd() - 0.5) * 0.12;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * 0.42 * ring;
        z = Math.sin(a) * r * 0.78;
        setHex(i, ring > 0 ? '#ffd98a' : '#ff7a8a');
      }
    } else if (occasion === 'tet') {
      // Đèn lồng Tết đỏ vàng & cánh hoa mai đào
      if (i < count * 0.65) {
        const p = i / (count * 0.65);
        const lat = (p - 0.5) * Math.PI * 0.92;
        const lon = rnd() * 6.283;
        const r = 1.25 * Math.cos(lat * 0.82);
        x = Math.cos(lon) * r;
        z = Math.sin(lon) * r;
        y = Math.sin(lat) * 1.38 + 0.18;
        setHex(i, rnd() < 0.24 ? '#ffd98a' : '#e11d48');
      } else if (i < count * 0.8) {
        const s = (i - count * 0.65) / (count * 0.15);
        const strand = (i % 7) - 3;
        x = strand * 0.09;
        z = (rnd() - 0.5) * 0.08;
        y = -1.18 - s * 0.8;
        setHex(i, '#ffd98a');
      } else {
        const a = rnd() * 6.283;
        const r = 1.65 + rnd() * 0.7;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = (rnd() - 0.5) * 3.2;
        setHex(i, rnd() < 0.5 ? '#facc15' : '#fda4af');
      }
    } else {
      // Sinh nhật: Bánh kem 2 tầng & ngọn nến lung linh
      if (i < count * 0.58) {
        const isTop = i % 3 === 0;
        const angle = rnd() * 6.283;
        const rad = (isTop ? 0.95 : 1.45) * (0.72 + 0.28 * rnd());
        const heightOffset = isTop ? 0.24 : -0.78;
        const layerY = (rnd() - 0.5) * 0.82;
        x = Math.cos(angle) * rad;
        z = Math.sin(angle) * rad;
        y = heightOffset + layerY;
        setHex(i, isTop ? '#f9a8d4' : '#fde68a');
      } else if (i < count * 0.8) {
        const candleIdx = (i % 3) - 1;
        const a = rnd() * 6.283;
        const isFlame = i % 4 === 0;
        x = candleIdx * 0.42 + Math.cos(a) * (isFlame ? 0.06 : 0.07);
        z = Math.sin(a) * (isFlame ? 0.06 : 0.07);
        y = isFlame ? 1.32 + rnd() * 0.3 : 0.68 + rnd() * 0.6;
        setHex(i, isFlame ? '#ffd98a' : '#fff7ec');
      } else {
        const a = rnd() * 6.283;
        const phi = Math.acos(1 - 2 * rnd());
        const r = 1.9 + rnd() * 0.55;
        x = r * Math.sin(phi) * Math.cos(a);
        y = r * Math.cos(phi) * 0.75 + 0.22;
        z = r * Math.sin(phi) * Math.sin(a);
        setHex(i, '#ffd98a');
      }
    }

    outPos[i * 3] = x;
    outPos[i * 3 + 1] = y;
    outPos[i * 3 + 2] = z;
  }
}

export const HeroParticleDemo: React.FC<HeroParticleDemoProps> = ({
  activeOccasion,
  onSelectOccasion,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeOccasionRef = useRef<OccasionId>(activeOccasion);
  const targetPositionsRef = useRef<Float32Array | null>(null);
  const targetColorsRef = useRef<Float32Array | null>(null);
  const particleCountRef = useRef<number>(4800);
  const swirlUntilRef = useRef<number>(0);

  // Khi người dùng đổi mẫu dịp lễ: xoáy nhẹ thành ngân hà rồi tụ hình giống web form noelnt
  useEffect(() => {
    activeOccasionRef.current = activeOccasion;
    swirlUntilRef.current = performance.now() / 1000 + 0.55;
    if (targetPositionsRef.current && targetColorsRef.current) {
      buildTargetsForOccasion(
        activeOccasion,
        particleCountRef.current,
        targetPositionsRef.current,
        targetColorsRef.current
      );
    }
  }, [activeOccasion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Luôn giữ đầy đủ chuyển động hạt 3D, xoay và tuyết rơi giống bản gốc tin1511/noelnt (RM = false)
    const prefersReducedMotion = false;
    const isSoftwareGl = detectSoftwareWebGL();
    const isWeakDevice =
      isSoftwareGl ||
      (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
      window.innerWidth < 640;

    // Số hạt & tuyết rơi chuẩn chuyển động của web form noelnt
    const count = isSoftwareGl ? 1600 : isWeakDevice ? 2800 : 5200;
    const snowCount = isSoftwareGl ? 220 : isWeakDevice ? 380 : 650;
    particleCountRef.current = count;

    const width = Math.max(container.clientWidth, 280);
    const height = Math.max(container.clientHeight, 260);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1622);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.1, 7.6);

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

    const group = new THREE.Group();
    scene.add(group);

    const spriteTex = createNoelntSpriteTexture();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const swirlColors = new Float32Array(count * 3);
    const targetsPos = new Float32Array(count * 3);
    const targetsCol = new Float32Array(count * 3);
    targetPositionsRef.current = targetsPos;
    targetColorsRef.current = targetsCol;

    const cc = new THREE.Color();
    for (let i = 0; i < count * 4; i++) seed[i] = Math.random();

    buildTargetsForOccasion(activeOccasionRef.current, count, targetsPos, targetsCol);

    // Khởi tạo phân tán không gian & màu ngân hà giống hệt giai đoạn 0 của noelnt
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const r = Math.random();
      cc.set(r < 0.5 ? '#ffd98a' : r < 0.8 ? '#ffffff' : '#9fd4ff');
      swirlColors[idx] = cc.r;
      swirlColors[idx + 1] = cc.g;
      swirlColors[idx + 2] = cc.b;

      if (prefersReducedMotion) {
        positions[idx] = targetsPos[idx];
        positions[idx + 1] = targetsPos[idx + 1];
        positions[idx + 2] = targetsPos[idx + 2];
        colors[idx] = targetsCol[idx];
        colors[idx + 1] = targetsCol[idx + 1];
        colors[idx + 2] = targetsCol[idx + 2];
      } else {
        positions[idx] = (Math.random() - 0.5) * 14;
        positions[idx + 1] = (Math.random() - 0.5) * 9;
        positions[idx + 2] = (Math.random() - 0.5) * 9;
        colors[idx] = swirlColors[idx];
        colors[idx + 1] = swirlColors[idx + 1];
        colors[idx + 2] = swirlColors[idx + 2];
      }
    }

    // Lúc mới mở Hero cho xoáy 0.85s trước khi tụ thành hình để thấy rõ hiệu ứng tụ hạt
    swirlUntilRef.current = prefersReducedMotion ? 0 : performance.now() / 1000 + 0.85;

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colAttr);

    const basePointSize = isWeakDevice ? 0.135 : 0.115;
    const material = new THREE.PointsMaterial({
      size: basePointSize,
      map: spriteTex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    group.add(new THREE.Points(geometry, material));

    // Tuyết nền rơi nhẹ liên tục (chuẩn SN trong tin1511/noelnt)
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 18;
      snowPos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    const snowGeo = new THREE.BufferGeometry();
    const snowAttr = new THREE.BufferAttribute(snowPos, 3);
    snowGeo.setAttribute('position', snowAttr);
    const snowMat = new THREE.PointsMaterial({
      size: 0.09,
      map: spriteTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(snowGeo, snowMat));

    // Kéo ngang để xoay + di chuột nhẹ giống web form noelnt
    let spin = 0;
    let dragging = false;
    let lastX = 0;
    let pointerX = 0;
    const cv = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width) {
        pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      spin += dx * 0.01;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onPointerLeave = () => {
      pointerX = 0;
    };

    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove, { passive: true });
    cv.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointerleave', onPointerLeave);

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

    let last = performance.now() / 1000;
    const t0 = last;
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
        // Fallback nếu không hỗ trợ WebGL2 fenceSync
      }
      frameId = window.setTimeout(cb, 80);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - last);
      const t = now - t0;
      last = now;

      const tPos = targetPositionsRef.current;
      const tCol = targetColorsRef.current;
      const inSwirl = !prefersReducedMotion && now < swirlUntilRef.current;
      const wob = prefersReducedMotion ? 0 : 0.025;
      const isHeart = activeOccasionRef.current === 'valentine' && !inSwirl && !prefersReducedMotion;
      const beat = isHeart ? 1 + Math.sin(t * 3.1) * 0.05 : 1;

      if (tPos && tCol) {
        for (let i = 0; i < count; i++) {
          const j = i * 3;
          const s = i * 4;
          let tx: number;
          let ty: number;
          let tz: number;

          if (inSwirl) {
            // Chuyển động xoáy ngân hà đặc trưng ở pha 0 của noelnt
            const a = seed[s] * 6.283 + t * (0.35 + seed[s + 1] * 0.45);
            const b = seed[s + 2] * 3.14 + t * 0.18;
            const r = 2.4 + seed[s + 3] * 2.8;
            tx = r * Math.sin(b) * Math.cos(a);
            ty = r * Math.cos(b) * 0.7;
            tz = r * Math.sin(b) * Math.sin(a);
          } else {
            // Quỹ đạo đích + rung lắc tự nhiên từng hạt
            tx = tPos[j] * beat + Math.sin(t * 1.7 + i) * wob;
            ty = tPos[j + 1] * beat + Math.cos(t * 1.3 + i) * wob;
            tz = tPos[j + 2] * beat;
          }

          // Tốc độ tụ hạt theo từng hạt (seed[s+1]) tạo cảm giác vệt bụi sao cuốn mượt
          const k = prefersReducedMotion
            ? 1
            : 1 - Math.exp(-dt * (inSwirl ? 1.8 : 1.6 + seed[s + 1] * 3));

          positions[j] += (tx - positions[j]) * k;
          positions[j + 1] += (ty - positions[j + 1]) * k;
          positions[j + 2] += (tz - positions[j + 2]) * k;

          const colSrc = inSwirl ? swirlColors : tCol;
          colors[j] += (colSrc[j] - colors[j]) * k;
          colors[j + 1] += (colSrc[j + 1] - colors[j + 1]) * k;
          colors[j + 2] += (colSrc[j + 2] - colors[j + 2]) * k;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }

      // Chuyển động tổng thể chuẩn noelnt: xoay liên tục, nhấp nhô nhẹ, kích thước hạt nhấp nháy
      if (!prefersReducedMotion) {
        if (!dragging) spin += dt * 0.18;
        group.rotation.y = spin + pointerX * 0.25;
        group.position.y = Math.sin(t * 0.8) * 0.1;
        material.size = basePointSize + Math.sin(t * 2.2) * 0.018;

        for (let i = 0; i < snowCount; i++) {
          snowPos[i * 3 + 1] -= dt * (0.45 + (i % 5) * 0.1);
          snowPos[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.2;
          if (snowPos[i * 3 + 1] < -4.5) snowPos[i * 3 + 1] = 4.5;
        }
        snowAttr.needsUpdate = true;
      }

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      cv.removeEventListener('pointerdown', onPointerDown);
      cv.removeEventListener('pointermove', onPointerMove);
      cv.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointerleave', onPointerLeave);
      geometry.dispose();
      material.dispose();
      snowGeo.dispose();
      snowMat.dispose();
      spriteTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const currentOccasion =
    CONFIG.occasions.find((o) => o.id === activeOccasion) || CONFIG.occasions[0];

  return (
    <div className="relative flex flex-col rounded-2xl border border-[#E6BE73]/20 bg-[#0b1622] overflow-hidden">
      {/* Khung canvas Three.js chuyển động hạt 3D chuẩn web form noelnt */}
      <div className="relative h-[300px] sm:h-[360px] lg:h-[400px] w-full bg-[#0b1622]">
        <div
          ref={containerRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          aria-label={`Demo hiệu ứng hạt 3D cho dịp ${currentOccasion.title}`}
        />

        {/* Chú thích nhẹ góc trên trái — không dùng backdrop-blur lên WebGL */}
        <div className="pointer-events-none absolute top-3.5 left-4 right-4 flex items-center justify-between gap-2 text-xs text-[#E8DDD0]">
          <span className="font-medium tracking-wide text-[#ffd98a]">
            {currentOccasion.particleShapeLabel}
          </span>
          <span className="text-[#94a3b8]">Kéo để xoay · tụ hạt 3D</span>
        </div>

        {/* Lời chúc mẫu viết bằng font Dancing Script */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 text-center">
          <div className="font-script text-2xl sm:text-3xl text-[#fff7ec] leading-tight">
            {currentOccasion.sampleGreeting}
          </div>
          <div className="mt-0.5 text-xs text-[#cbd5e1]">
            {currentOccasion.sampleRecipient} · Hiệu ứng hạt 3D trực tiếp
          </div>
        </div>
      </div>

      {/* Thanh chọn nhanh 5 dịp để đổi hình hiệu ứng hạt ngay trên Hero */}
      <div className="border-t border-[#ffd98a]/15 bg-[#08101a] p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {CONFIG.occasions.map((occ) => {
            const active = occ.id === activeOccasion;
            return (
              <button
                key={occ.id}
                type="button"
                onClick={() => onSelectOccasion(occ.id)}
                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#ffd98a] text-[#1A1208] font-semibold'
                    : 'bg-[#111E2D] text-[#D7CCC0] hover:text-[#F7F1E8] hover:bg-[#192A3D]'
                }`}
              >
                {occ.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
