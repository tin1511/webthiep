import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CONFIG, OccasionId } from '../config';

interface HeroParticleDemoProps {
  activeOccasion: OccasionId;
  onSelectOccasion: (id: OccasionId) => void;
}

/**
 * Tạo texture hạt ánh sáng phát sáng mềm bằng Canvas 2D (không phụ thuộc file ảnh ngoài).
 */
function createGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.28, 'rgba(255, 240, 210, 0.88)');
    grad.addColorStop(0.65, 'rgba(255, 215, 150, 0.25)');
    grad.addColorStop(1, 'rgba(255, 215, 150, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
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
 * Sinh tọa độ mục tiêu 3D & màu cho từng dịp lễ để các hạt tụ hình mượt mà.
 */
function buildTargetsForOccasion(
  occasion: OccasionId,
  count: number,
  outPos: Float32Array,
  outCol: Float32Array
): void {
  const primary = new THREE.Color('#E6BE73');
  const secondary = new THREE.Color('#C84B5A');
  const warmWhite = new THREE.Color('#FFF6E8');
  const info = CONFIG.occasions.find((o) => o.id === occasion);
  if (info) {
    primary.set(info.accentHex);
    secondary.set(info.secondaryHex);
  }

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const idx3 = i * 3;
    let x = 0;
    let y = 0;
    let z = 0;
    let mixRatio = 0;

    if (occasion === 'noel') {
      // Cây thông xoắn ốc 3D + ngôi sao đỉnh + tuyết bay nhẹ xung quanh
      if (i < count * 0.08) {
        // Ngôi sao 5 cánh trên đỉnh cây
        const starAngle = (i / (count * 0.08)) * Math.PI * 2;
        const r = i % 2 === 0 ? 0.42 : 0.18;
        x = Math.cos(starAngle * 5) * r * 0.65;
        y = 2.08 + Math.sin(starAngle * 5) * r * 0.65;
        z = (Math.sin(i * 1.7) * 0.08);
        mixRatio = 0.05;
      } else if (i < count * 0.85) {
        // Tán cây thông xoắn ốc
        const h = (i - count * 0.08) / (count * 0.77);
        const radius = (1 - h) * 1.48 + 0.05;
        const angle = h * Math.PI * 18 + (i % 7) * 0.25;
        const jitter = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.12;
        x = Math.cos(angle) * (radius + jitter);
        z = Math.sin(angle) * (radius + jitter);
        y = -1.65 + h * 3.5;
        mixRatio = i % 9 === 0 ? 0.92 : h * 0.3;
      } else {
        // Hạt tuyết nền
        const a = i * 2.39996;
        const r = 1.9 + (t * 1.4);
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
        y = ((i % 40) / 40 - 0.5) * 3.8;
        mixRatio = 0.15;
      }
    } else if (occasion === 'valentine') {
      // Trái tim 3D tham số có chiều sâu
      if (i < count * 0.86) {
        const u = ((i * 2.39996) % (Math.PI * 2));
        const layer = ((i % 15) / 15) * 2 - 1;
        const scale = 0.095 * (1 - Math.abs(layer) * 0.18);
        const hx = 16 * Math.pow(Math.sin(u), 3);
        const hy =
          13 * Math.cos(u) -
          5 * Math.cos(2 * u) -
          2 * Math.cos(3 * u) -
          Math.cos(4 * u);
        x = hx * scale;
        y = hy * scale + 0.15;
        z = layer * 0.48 * Math.sqrt(Math.max(0.05, 1 - Math.abs(hx) / 18));
        mixRatio = 0.35 + 0.65 * (1 - Math.abs(layer));
      } else {
        const a = i * 1.9;
        const r = 2.05 + (i % 5) * 0.16;
        x = Math.cos(a) * r;
        y = Math.sin(a * 0.7) * 1.4;
        z = Math.sin(a) * r * 0.6;
        mixRatio = 0.1;
      }
    } else if (occasion === 'to-tinh') {
      // Vòm sao kết thành dấu hỏi lãng mạn & vòng quỹ đạo
      if (i < count * 0.55) {
        const p = i / (count * 0.55);
        if (p < 0.78) {
          // Đường cong dấu hỏi / nụ cười ngỏ ý
          const theta = -0.35 * Math.PI + (p / 0.78) * 1.45 * Math.PI;
          const r = 0.95;
          x = Math.cos(theta) * r;
          y = 0.45 + Math.sin(theta) * r;
          if (p > 0.6) {
            const tail = (p - 0.6) / 0.18;
            x *= 1 - tail * 0.88;
            y = 0.45 - tail * 1.05;
          }
          z = Math.sin(p * 24) * 0.14;
          mixRatio = 0.25;
        } else {
          // Chấm tròn trái tim nhỏ ở dưới
          const a = p * 40;
          const rad = 0.18 * ((i % 5) / 5);
          x = Math.cos(a) * rad;
          y = -1.08 + Math.sin(a) * rad;
          z = Math.sin(a * 2) * 0.12;
          mixRatio = 0.9;
        }
      } else {
        // Hai vòng nhẫn quỹ đạo bao quanh
        const ring = i % 2 === 0 ? 1 : -1;
        const a = i * 0.19;
        const r = 1.95;
        x = Math.cos(a) * r;
        y = Math.sin(a) * r * 0.42 * ring;
        z = Math.sin(a) * r * 0.8;
        mixRatio = ring > 0 ? 0.15 : 0.75;
      }
    } else if (occasion === 'tet') {
      // Đèn lồng Tết ở giữa + cánh hoa mai đào bay vòng
      if (i < count * 0.62) {
        const p = (i / (count * 0.62));
        const lat = (p - 0.5) * Math.PI * 0.92;
        const lon = i * 2.39996;
        const r = 1.18 * Math.cos(lat * 0.85);
        x = Math.cos(lon) * r;
        z = Math.sin(lon) * r;
        y = Math.sin(lat) * 1.35 + 0.15;
        mixRatio = i % 4 === 0 ? 0.1 : 0.85;
      } else if (i < count * 0.76) {
        // Tua rua đèn lồng
        const s = (i - count * 0.62) / (count * 0.14);
        const strand = (i % 7) - 3;
        x = strand * 0.08;
        z = ((i % 3) - 1) * 0.06;
        y = -1.12 - s * 0.72;
        mixRatio = 0.15;
      } else {
        // Cánh hoa mai vàng & đào hồng bay quanh
        const a = i * 1.618;
        const rad = 1.6 + (i % 7) * 0.18;
        x = Math.cos(a) * rad;
        y = Math.sin(a * 1.3) * 1.5;
        z = Math.sin(a) * rad * 0.85;
        mixRatio = i % 2 === 0 ? 0.05 : 0.75;
      }
    } else {
      // Sinh nhật: Bánh tầng ánh sáng + ngọn nến + pháo hoa nhỏ
      if (i < count * 0.55) {
        // Tầng bánh tròn 2 lớp
        const isTop = i % 3 === 0;
        const angle = i * 2.39996;
        const rad = isTop ? 0.9 : 1.38;
        const heightOffset = isTop ? 0.2 : -0.68;
        const layerY = ((i % 10) / 10 - 0.5) * 0.72;
        x = Math.cos(angle) * rad;
        z = Math.sin(angle) * rad;
        y = heightOffset + layerY;
        mixRatio = isTop ? 0.65 : 0.2;
      } else if (i < count * 0.78) {
        // 3 ngọn nến lung linh phía trên
        const candleIdx = (i % 3) - 1;
        const sub = (i / (count * 0.23)) * 10;
        const isFlame = i % 4 === 0;
        x = candleIdx * 0.42 + Math.cos(sub) * (isFlame ? 0.05 : 0.06);
        z = Math.sin(sub) * (isFlame ? 0.05 : 0.06);
        y = isFlame ? 1.25 + ((i % 5) / 5) * 0.28 : 0.62 + ((i % 8) / 8) * 0.55;
        mixRatio = isFlame ? 0.92 : 0.05;
      } else {
        // Pháo sáng tỏa xung quanh
        const a = i * 2.39996;
        const phi = Math.acos(1 - 2 * ((i % 50) / 50));
        const r = 1.9 + (i % 5) * 0.16;
        x = r * Math.sin(phi) * Math.cos(a);
        y = r * Math.cos(phi) * 0.75 + 0.3;
        z = r * Math.sin(phi) * Math.sin(a);
        mixRatio = 0.45;
      }
    }

    outPos[idx3] = x;
    outPos[idx3 + 1] = y;
    outPos[idx3 + 2] = z;

    const c = primary.clone().lerp(secondary, mixRatio);
    if (i % 11 === 0) {
      c.lerp(warmWhite, 0.55);
    }
    outCol[idx3] = c.r;
    outCol[idx3 + 1] = c.g;
    outCol[idx3 + 2] = c.b;
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
  const particleCountRef = useRef<number>(1800);

  // Cập nhật tọa độ đích khi người dùng đổi mẫu dịp lễ
  useEffect(() => {
    activeOccasionRef.current = activeOccasion;
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

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSoftwareGl = detectSoftwareWebGL();
    const isWeakDevice =
      isSoftwareGl ||
      prefersReducedMotion ||
      (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) ||
      window.innerWidth < 640;

    // Tự động giảm số hạt trên máy yếu hoặc điện thoại
    const count = isSoftwareGl ? 950 : isWeakDevice ? 1500 : 2600;
    particleCountRef.current = count;

    const width = Math.max(container.clientWidth, 280);
    const height = Math.max(container.clientHeight, 260);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(0, 0.15, 6.2);

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

    const spriteTex = createGlowSpriteTexture();

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const targetsPos = new Float32Array(count * 3);
    const targetsCol = new Float32Array(count * 3);
    targetPositionsRef.current = targetsPos;
    targetColorsRef.current = targetsCol;

    buildTargetsForOccasion(activeOccasionRef.current, count, targetsPos, targetsCol);

    // Khởi tạo vị trí ban đầu tản ra nhẹ để thấy hiệu ứng tụ hạt ngay khi vào trang
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      if (prefersReducedMotion) {
        positions[idx] = targetsPos[idx];
        positions[idx + 1] = targetsPos[idx + 1];
        positions[idx + 2] = targetsPos[idx + 2];
      } else {
        positions[idx] = (Math.random() - 0.5) * 6;
        positions[idx + 1] = (Math.random() - 0.5) * 5;
        positions[idx + 2] = (Math.random() - 0.5) * 4;
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
      size: isWeakDevice ? 0.11 : 0.095,
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

    // Tương tác xoay nhẹ bằng chuột / chạm trên màn hình điện thoại
    let pointerX = 0;
    let pointerY = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };
    container.addEventListener('pointermove', onPointerMove, { passive: true });
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
        // Fallback nếu không hỗ trợ WebGL2 fenceSync
      }
      frameId = window.setTimeout(cb, 80);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      const tPos = targetPositionsRef.current;
      const tCol = targetColorsRef.current;
      const posArr = posAttr.array as Float32Array;
      const colArr = colAttr.array as Float32Array;

      if (tPos && tCol) {
        const moveAlpha = prefersReducedMotion ? 1 : 1 - Math.exp(-4.6 * dt);
        const colAlpha = prefersReducedMotion ? 1 : 1 - Math.exp(-5.0 * dt);
        const isHeart = activeOccasionRef.current === 'valentine';
        const beat = isHeart && !prefersReducedMotion ? 1 + Math.sin(elapsed * 3.1) * 0.055 : 1;

        for (let i = 0; i < count; i++) {
          const idx = i * 3;
          const shimmer = prefersReducedMotion
            ? 0
            : Math.sin(elapsed * 1.8 + i * 0.13) * 0.025;
          posArr[idx] += (tPos[idx] * beat - posArr[idx]) * moveAlpha;
          posArr[idx + 1] += (tPos[idx + 1] * beat + shimmer - posArr[idx + 1]) * moveAlpha;
          posArr[idx + 2] += (tPos[idx + 2] * beat - posArr[idx + 2]) * moveAlpha;

          colArr[idx] += (tCol[idx] - colArr[idx]) * colAlpha;
          colArr[idx + 1] += (tCol[idx + 1] - colArr[idx + 1]) * colAlpha;
          colArr[idx + 2] += (tCol[idx + 2] - colArr[idx + 2]) * colAlpha;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }

      if (!prefersReducedMotion) {
        const autoSpin = elapsed * 0.28;
        points.rotation.y = THREE.MathUtils.damp(
          points.rotation.y,
          autoSpin + pointerX * 0.45,
          4,
          dt
        );
        points.rotation.x = THREE.MathUtils.damp(points.rotation.x, pointerY * 0.22, 4, dt);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    // Giải phóng toàn bộ bộ nhớ WebGL khi component unmount
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      geometry.dispose();
      material.dispose();
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
    <div className="relative flex flex-col rounded-2xl border border-[#E6BE73]/20 bg-[#1B1512] overflow-hidden">
      {/* Khung canvas Three.js 3D chạy thật */}
      <div className="relative h-[300px] sm:h-[360px] lg:h-[400px] w-full bg-[radial-gradient(circle_at_50%_45%,rgba(230,190,115,0.12)_0%,rgba(20,16,14,0.98)_72%)]">
        <div
          ref={containerRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          aria-label={`Demo hiệu ứng hạt 3D cho dịp ${currentOccasion.title}`}
        />

        {/* Chú thích nhẹ góc trên trái — không dùng backdrop-blur lên WebGL */}
        <div className="pointer-events-none absolute top-3.5 left-4 right-4 flex items-center justify-between gap-2 text-xs text-[#E8DDD0]">
          <span className="font-medium tracking-wide text-[#E6BE73]">
            {currentOccasion.particleShapeLabel}
          </span>
          <span className="text-[#B8ABA0]">Chạm hoặc di chuột để xoay</span>
        </div>

        {/* Lời chúc mẫu viết bằng font Dancing Script */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 text-center">
          <div className="font-script text-2xl sm:text-3xl text-[#F7F1E8] leading-tight">
            {currentOccasion.sampleGreeting}
          </div>
          <div className="mt-0.5 text-xs text-[#B8ABA0]">
            {currentOccasion.sampleRecipient} · Demo web thiệp 3D chạy trực tiếp
          </div>
        </div>
      </div>

      {/* Thanh chọn nhanh 5 dịp để đổi hình hiệu ứng hạt ngay trên Hero */}
      <div className="border-t border-[#E6BE73]/15 bg-[#181310] p-2.5 sm:p-3">
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
                    ? 'bg-[#E6BE73] text-[#1A1208] font-semibold'
                    : 'bg-[#241D19] text-[#D7CCC0] hover:text-[#F7F1E8] hover:bg-[#2E2520]'
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
