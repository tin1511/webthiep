import QRCode from 'qrcode';

function isInsideHeart(nx: number, ny: number): boolean {
  // Phương trình trái tim: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
  const a = nx * nx + ny * ny - 1;
  return a * a * a - nx * nx * (ny * ny * ny) <= 0;
}

function drawHeartShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  const r = size / 2;
  const topY = cy - r * 0.35;
  const botY = cy + r * 0.95;

  ctx.moveTo(cx, botY);
  ctx.bezierCurveTo(
    cx - r * 1.05,
    cy + r * 0.35,
    cx - r * 1.1,
    cy - r * 0.85,
    cx - r * 0.5,
    cy - r * 0.85
  );
  ctx.bezierCurveTo(cx - r * 0.15, cy - r * 0.85, cx, cy - r * 0.5, cx, topY);
  ctx.bezierCurveTo(cx, cy - r * 0.5, cx + r * 0.15, cy - r * 0.85, cx + r * 0.5, cy - r * 0.85);
  ctx.bezierCurveTo(
    cx + r * 1.1,
    cy - r * 0.85,
    cx + r * 1.05,
    cy + r * 0.35,
    cx,
    botY
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function isFinderPattern(r: number, c: number, matrixSize: number): boolean {
  if (r < 7 && c < 7) return true;
  if (r < 7 && c >= matrixSize - 7) return true;
  if (r >= matrixSize - 7 && c < 7) return true;
  return false;
}

function drawFinderEye(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  cellSize: number
) {
  const outerSize = cellSize * 7;
  const innerWhiteSize = cellSize * 5;
  const innerCoreSize = cellSize * 3;

  ctx.save();
  ctx.fillStyle = '#991b1b';
  drawRoundedRect(ctx, startX, startY, outerSize, outerSize, cellSize * 1.6);
  ctx.fill();

  ctx.fillStyle = '#fff9f5';
  drawRoundedRect(
    ctx,
    startX + cellSize,
    startY + cellSize,
    innerWhiteSize,
    innerWhiteSize,
    cellSize * 1.1
  );
  ctx.fill();

  ctx.fillStyle = '#b91c1c';
  drawRoundedRect(
    ctx,
    startX + cellSize * 2,
    startY + cellSize * 2,
    innerCoreSize,
    innerCoreSize,
    cellSize * 0.85
  );
  ctx.fill();

  drawHeartShape(
    ctx,
    startX + outerSize / 2,
    startY + outerSize / 2,
    innerCoreSize * 0.95,
    '#991b1b'
  );
  ctx.restore();
}

function seededBit(row: number, col: number): boolean {
  const h = Math.sin(row * 127.1 + col * 311.7) * 43758.5453;
  return h - Math.floor(h) > 0.36;
}

/**
 * Tạo ảnh PNG Mã QR Hình Trái Tim (chuẩn quét Level H) từ đường dẫn Web Thiệp.
 */
export function generateHeartQrDataUrl(url: string): string {
  const qr = QRCode.create(url || 'https://example.com', {
    errorCorrectionLevel: 'H',
  });
  const N = qr.modules.size;

  const canvasW = 860;
  const canvasH = 860;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Nền kem hồng ấm sang trọng để in thiệp giấy
  const bgGrad = ctx.createRadialGradient(
    canvasW / 2,
    canvasH * 0.48,
    60,
    canvasW / 2,
    canvasH * 0.48,
    canvasW * 0.72
  );
  bgGrad.addColorStop(0, '#fffdf9');
  bgGrad.addColorStop(0.7, '#fff3ed');
  bgGrad.addColorStop(1, '#fde2e4');
  ctx.fillStyle = bgGrad;
  drawRoundedRect(ctx, 0, 0, canvasW, canvasH, 36);
  ctx.fill();

  ctx.strokeStyle = '#f4b4be';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 18, 18, canvasW - 36, canvasH - 36, 26);
  ctx.stroke();

  // 2. Đường bao hình trái tim
  const heartCenterX = canvasW / 2;
  const heartCenterY = 435;
  const heartScale = 345;

  ctx.save();
  for (let py = 35; py < canvasH - 35; py += 4) {
    for (let px = 35; px < canvasW - 35; px += 4) {
      const nx = (px - heartCenterX) / (heartScale * 1.04);
      const ny = -(py - heartCenterY) / (heartScale * 1.04) + 0.14;
      if (isInsideHeart(nx, ny)) {
        ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
        ctx.fillRect(px, py, 4, 4);
      }
    }
  }
  ctx.restore();

  // 3. Khung QR quét chính xác đặt giữa trái tim
  const qrBoxSize = 370;
  const cellSize = qrBoxSize / N;
  const qrStartX = heartCenterX - qrBoxSize / 2;
  const qrStartY = heartCenterY - qrBoxSize / 2 + 12;

  const quietPad = cellSize * 2.2;
  ctx.save();
  ctx.fillStyle = '#fff9f5';
  drawRoundedRect(
    ctx,
    qrStartX - quietPad,
    qrStartY - quietPad,
    qrBoxSize + quietPad * 2,
    qrBoxSize + quietPad * 2,
    cellSize * 2.2
  );
  ctx.fill();
  ctx.restore();

  // 4. Các hạt trang trí quanh viền trái tim
  const gridRadius = Math.ceil((heartScale * 1.25) / cellSize);
  for (let gr = -gridRadius; gr < N + gridRadius; gr++) {
    for (let gc = -gridRadius; gc < N + gridRadius; gc++) {
      const cx = qrStartX + (gc + 0.5) * cellSize;
      const cy = qrStartY + (gr + 0.5) * cellSize;

      if (gr >= -2 && gr < N + 2 && gc >= -2 && gc < N + 2) {
        continue;
      }

      const nx = (cx - heartCenterX) / heartScale;
      const ny = -(cy - heartCenterY) / heartScale + 0.14;

      if (isInsideHeart(nx, ny)) {
        const isEdge = !isInsideHeart(nx * 1.06, ny * 1.06);
        if (isEdge || seededBit(gr, gc)) {
          const color = isEdge ? '#9f1239' : (gr + gc) % 3 === 0 ? '#e11d48' : '#be123c';
          if ((gr + gc) % 2 === 0 || isEdge) {
            drawHeartShape(ctx, cx, cy, cellSize * 0.92, color);
          } else {
            ctx.fillStyle = color;
            drawRoundedRect(
              ctx,
              cx - cellSize * 0.38,
              cy - cellSize * 0.38,
              cellSize * 0.76,
              cellSize * 0.76,
              cellSize * 0.25
            );
            ctx.fill();
          }
        }
      }
    }
  }

  // 5. 3 mắt định vị QR
  drawFinderEye(ctx, qrStartX, qrStartY, cellSize);
  drawFinderEye(ctx, qrStartX + (N - 7) * cellSize, qrStartY, cellSize);
  drawFinderEye(ctx, qrStartX, qrStartY + (N - 7) * cellSize, cellSize);

  const centerR = N * 0.12;
  const mid = (N - 1) / 2;

  // 6. Các module dữ liệu QR hình trái tim đỏ thẫm độ tương phản cao
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (isFinderPattern(r, c, N)) continue;
      const distFromCenter = Math.hypot(r - mid, c - mid);
      if (distFromCenter < centerR) continue;

      const isDark = qr.modules.get(r, c) === 1;
      if (!isDark) continue;

      const x = qrStartX + c * cellSize;
      const y = qrStartY + r * cellSize;
      const cx = x + cellSize / 2;
      const cy = y + cellSize / 2;

      ctx.fillStyle = '#991b1b';
      drawRoundedRect(
        ctx,
        x + cellSize * 0.06,
        y + cellSize * 0.06,
        cellSize * 0.88,
        cellSize * 0.88,
        cellSize * 0.28
      );
      ctx.fill();

      drawHeartShape(ctx, cx, cy - cellSize * 0.02, cellSize * 0.86, '#b91c1c');
    }
  }

  // 7. Trái tim trung tâm
  const badgeRadius = centerR * cellSize * 1.15;
  const qrCenterX = qrStartX + qrBoxSize / 2;
  const qrCenterY = qrStartY + qrBoxSize / 2;
  ctx.save();
  ctx.fillStyle = '#fff9f5';
  ctx.beginPath();
  ctx.arc(qrCenterX, qrCenterY, badgeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fecdd3';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawHeartShape(ctx, qrCenterX, qrCenterY + 2, badgeRadius * 1.45, '#e11d48');
  ctx.restore();

  return canvas.toDataURL('image/png');
}
