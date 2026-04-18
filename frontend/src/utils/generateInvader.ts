// Seeded RNG matching Python's random.Random behavior (Mersenne Twister subset)
// We use a simple mulberry32 — consistent within this app, not identical to Python output
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return {
    random() {
      s += 0x6d2b79f5;
      let z = s;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    },
    randint(lo: number, hi: number) {
      return lo + Math.floor(this.random() * (hi - lo + 1));
    },
  };
}

export function generateInvaderCanvas(seed: number): HTMLCanvasElement {
  const rng = mulberry32(seed);
  const canvasGridSize = 20;
  const invaderGridSize = 10;
  const pixelSize = 20;
  const halfW = invaderGridSize >> 1;

  // Build background grid
  type Pixel = [number, number, number, number];
  const bg: Pixel[][] = Array.from({ length: canvasGridSize }, () =>
    Array(canvasGridSize).fill([0, 0, 0, 255])
  );
  for (let y = 0; y < canvasGridSize; y++) {
    for (let x = 0; x < canvasGridSize; x++) {
      if (rng.random() < 0.4) {
        const value = rng.randint(0, 18);
        const blue = rng.randint(0, 35);
        bg[y][x] = [0, Math.floor(value / 3), blue, 255];
      } else {
        const value = rng.randint(0, 55);
        const blue = rng.randint(Math.max(value, 15), 95);
        bg[y][x] = [0, Math.floor(value / 3), blue, 255];
      }
    }
  }

  // Build invader grid (symmetric)
  const grid: number[][] = Array.from({ length: invaderGridSize }, () =>
    Array(invaderGridSize).fill(0)
  );
  for (let y = 0; y < invaderGridSize; y++) {
    for (let x = 0; x < halfW; x++) {
      const fillProb = y >= 2 && y <= 6 ? 0.6 : 0.45;
      if (rng.random() < fillProb) grid[y][x] = 1;
    }
  }
  for (let y = 0; y < invaderGridSize; y++) {
    for (let x = 0; x < halfW; x++) {
      grid[y][invaderGridSize - 1 - x] = grid[y][x];
    }
  }

  // Eyes
  const eyeY = rng.randint(2, 3);
  const leftEyeX = Math.max(1, invaderGridSize / 2 - 2);
  const rightEyeX = Math.min(invaderGridSize - 2, invaderGridSize / 2 + 1);
  grid[eyeY][leftEyeX] = 0;
  grid[eyeY][rightEyeX] = 0;
  if (eyeY + 1 < invaderGridSize) {
    grid[eyeY + 1][leftEyeX] = 0;
    grid[eyeY + 1][rightEyeX] = 0;
  }

  // Body color
  const r = rng.randint(80, 255);
  const g = rng.randint(80, 255);
  const b = rng.randint(80, 255);

  // Draw on canvas
  const imgSize = canvasGridSize * pixelSize;
  const canvas = document.createElement("canvas");
  canvas.width = imgSize;
  canvas.height = imgSize;
  const ctx = canvas.getContext("2d")!;

  for (let y = 0; y < canvasGridSize; y++) {
    for (let x = 0; x < canvasGridSize; x++) {
      const [pr, pg, pb] = bg[y][x];
      ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }

  const offset = (canvasGridSize - invaderGridSize) >> 1;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  for (let y = 0; y < invaderGridSize; y++) {
    for (let x = 0; x < invaderGridSize; x++) {
      if (grid[y][x]) {
        ctx.fillRect(
          (x + offset) * pixelSize,
          (y + offset) * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    }
  }

  return canvas;
}

export function getBodyColor(seed: number): string {
  const rng = mulberry32(seed);
  // Skip background grid RNG calls (same as generateInvaderCanvas)
  const canvasGridSize = 20;
  const invaderGridSize = 10;
  const halfW = invaderGridSize >> 1;
  for (let y = 0; y < canvasGridSize; y++)
    for (let x = 0; x < canvasGridSize; x++) {
      if (rng.random() < 0.4) { rng.randint(0, 18); rng.randint(0, 35); }
      else { rng.randint(0, 55); rng.randint(0, 95); }
    }
  for (let y = 0; y < invaderGridSize; y++)
    for (let x = 0; x < halfW; x++) rng.random();
  rng.randint(2, 3);
  const r = rng.randint(80, 255);
  const g = rng.randint(80, 255);
  const b = rng.randint(80, 255);
  return `rgb(${r},${g},${b})`;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}
