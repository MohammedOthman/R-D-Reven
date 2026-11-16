export type AmbientVariant = 'merge' | 'ribbons' | 'contours' | 'rings';

type Field = { draw(t: number): void };
type Pointer = { x: number; y: number; on: boolean };

const TAU = Math.PI * 2;
const BLUE = '44,91,255';
const PERIWINKLE = '141,164,255';
const ICE = '209,224,255';

/** Deterministic layout: every visit and every resize produces the same composition. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fract = (value: number) => value - Math.floor(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rgb: string,
  alpha: number,
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

const smooth = (from: number, to: number, value: number) => {
  const x = clamp((value - from) / (to - from), 0, 1);
  return x * x * (3 - 2 * x);
};

/** Marching squares: adds the iso-line of `values` at `level` to the current path. */
function trace(
  ctx: CanvasRenderingContext2D,
  values: Float32Array,
  cols: number,
  rows: number,
  cell: number,
  level: number,
) {
  const stride = cols + 1;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * stride + c;
      const tl = values[i]!,
        tr = values[i + 1]!,
        bl = values[i + stride]!,
        br = values[i + stride + 1]!;
      const code =
        (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const x = c * cell,
        y = r * cell;
      const top = x + (cell * (level - tl)) / (tr - tl),
        bottom = x + (cell * (level - bl)) / (br - bl),
        left = y + (cell * (level - tl)) / (bl - tl),
        right = y + (cell * (level - tr)) / (br - tr);
      const line = (x0: number, y0: number, x1: number, y1: number) => {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      };
      if (code === 1 || code === 14 || code === 10) line(x, left, bottom, y + cell);
      if (code === 2 || code === 13 || code === 5) line(bottom, y + cell, x + cell, right);
      if (code === 3 || code === 12) line(x, left, x + cell, right);
      if (code === 4 || code === 11 || code === 10) line(top, y, x + cell, right);
      if (code === 6 || code === 9) line(top, y, bottom, y + cell);
      if (code === 7 || code === 8 || code === 5) line(x, left, top, y);
    }
}

/** Two companies as liquid masses that drift together, fuse into one body and part again. */
function merge(ctx: CanvasRenderingContext2D, w: number, h: number, pointer: Pointer): Field {
  const cell = w < 720 ? 8 : 6;
  const cols = Math.ceil(w / cell),
    rows = Math.ceil(h / cell);
  const stride = cols + 1;
  const values = new Float32Array(stride * (rows + 1));
  // The fill is computed once per grid point and upscaled; the traced outline keeps the edge crisp.
  const buffer = document.createElement('canvas');
  buffer.width = stride;
  buffer.height = rows + 1;
  const bufferContext = buffer.getContext('2d');
  const image = bufferContext?.createImageData(stride, rows + 1);
  const size = Math.min(w, h * 1.5);
  const random = seeded(7);
  const drops = Array.from({ length: 5 }, () => ({
    orbit: 0.2 + random() * 0.26,
    speed: (random() < 0.5 ? -1 : 1) * (0.1 + random() * 0.14),
    phase: random() * TAU,
    radius: size * (0.035 + random() * 0.03),
  }));
  const blobs: { x: number; y: number; r2: number }[] = [];
  return {
    draw(t) {
      // Separation eases between apart and overlapping on a 20 second cycle.
      const together = smooth(-0.55, 0.55, Math.sin(t * 0.31));
      const gap = w * (0.27 - together * 0.19);
      const cx = w * 0.5 + Math.sin(t * 0.11) * w * 0.05,
        cy = h * 0.5;
      blobs.length = 0;
      const big = size * 0.145;
      blobs.push(
        { x: cx - gap, y: cy + Math.sin(t * 0.4) * h * 0.1, r2: big * big },
        { x: cx + gap, y: cy - Math.sin(t * 0.33 + 1) * h * 0.1, r2: big * big * 0.72 },
      );
      for (const drop of drops) {
        const angle = t * drop.speed + drop.phase;
        blobs.push({
          x: cx + Math.cos(angle) * w * drop.orbit,
          y: cy + Math.sin(angle * 1.3) * h * 0.36,
          r2: drop.radius * drop.radius,
        });
      }
      if (pointer.on) blobs.push({ x: pointer.x, y: pointer.y, r2: size * size * 0.0036 });
      for (let r = 0; r <= rows; r++)
        for (let c = 0; c <= cols; c++) {
          const x = c * cell,
            y = r * cell;
          let sum = 0;
          for (const blob of blobs) {
            const dx = x - blob.x,
              dy = y - blob.y;
            sum += blob.r2 / (dx * dx + dy * dy + 1);
          }
          values[r * stride + c] = sum;
          if (image) {
            const o = (r * stride + c) * 4;
            // Brighter toward each core so the bodies read as volumes, not flat shapes.
            const inside = smooth(0.92, 1.08, sum);
            const core = Math.min(1, (sum - 1) / 2.2);
            image.data[o] = 44 + core * 70;
            image.data[o + 1] = 91 + core * 60;
            image.data[o + 2] = 255;
            image.data[o + 3] = inside * (44 + core * 84);
          }
        }
      glow(ctx, cx, cy, Math.max(w, h) * 0.5, BLUE, 0.1 + together * 0.08);
      if (image && bufferContext) {
        bufferContext.putImageData(image, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(buffer, -cell / 2, -cell / 2, stride * cell, (rows + 1) * cell);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${PERIWINKLE},0.16)`;
      ctx.beginPath();
      trace(ctx, values, cols, rows, cell, 0.55);
      ctx.stroke();
      ctx.strokeStyle = `rgba(${PERIWINKLE},0.3)`;
      ctx.beginPath();
      trace(ctx, values, cols, rows, cell, 0.75);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `rgba(${ICE},0.85)`;
      ctx.beginPath();
      trace(ctx, values, cols, rows, cell, 1);
      ctx.stroke();
    },
  };
}

/** Three partner streams join one governed flow, then leave as unequal shares. */
function ribbons(ctx: CanvasRenderingContext2D, w: number, h: number, rtl: boolean): Field {
  const unit = clamp(Math.min(h / 16, w / 26), 14, 34);
  // Tall, narrow sections would turn the spread into steep diagonals, so it tightens with aspect.
  const spread = clamp((w / h) * 0.9, 0.3, 1);
  const bands = [
    { start: 0.16, end: 0.2, share: 2.1, rgb: BLUE, alpha: 0.36 },
    { start: 0.5, end: 0.56, share: 1.15, rgb: PERIWINKLE, alpha: 0.2 },
    { start: 0.84, end: 0.86, share: 0.6, rgb: ICE, alpha: 0.13 },
  ];
  const step = 20;
  const fade = (rgb: string, alpha: number) => {
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, `rgba(${rgb},0)`);
    gradient.addColorStop(0.14, `rgba(${rgb},${alpha})`);
    gradient.addColorStop(0.86, `rgba(${rgb},${alpha})`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    return gradient;
  };
  const fills = bands.map((band) => fade(band.rgb, band.alpha));
  const edges = bands.map((band) => fade(band.rgb, Math.min(1, band.alpha * 1.6)));
  return {
    draw(t) {
      ctx.save();
      if (rtl) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      glow(ctx, w * 0.5, h * 0.5, Math.max(w, h) * 0.42, BLUE, 0.12);
      const middle = h * (0.5 + Math.sin(t * 0.21) * 0.04);
      bands.forEach((band, index) => {
        const thickness = (x: number) => unit * (1 + (band.share - 1) * smooth(0.6, 0.9, x / w));
        const centre = (x: number) => {
          const u = x / w;
          const joined = smooth(0.06, 0.36, u) * (1 - smooth(0.62, 0.92, u));
          const apart =
            h * (0.5 + ((u < 0.5 ? band.start : band.end) - 0.5) * spread) +
            Math.sin(t * 0.34 + index * 2.1) * h * 0.035;
          const wave = Math.sin(u * 5 - t * 0.5 + index) * unit * 0.22;
          return apart + (middle + (index - 1) * unit - apart) * joined + wave;
        };
        const outline = (from: number, to: number) => {
          ctx.beginPath();
          for (let x = from; x <= to; x += step) ctx.lineTo(x, centre(x) - thickness(x) / 2);
          for (let x = to; x >= from; x -= step) ctx.lineTo(x, centre(x) + thickness(x) / 2);
          ctx.closePath();
        };
        outline(-step, w + step);
        ctx.fillStyle = fills[index]!;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = edges[index]!;
        ctx.stroke();
        // Value moving through the band: a window of light, clipped to the ribbon's own shape.
        for (let pulse = 0; pulse < 3; pulse++) {
          const length = w * 0.11;
          const head = fract(t * 0.055 + pulse / 3 + index * 0.13) * (w + length * 2) - length;
          const visible = smooth(0, 0.12, head / w) * (1 - smooth(0.88, 1, head / w));
          if (visible <= 0) continue;
          const light = ctx.createLinearGradient(head - length, 0, head, 0);
          light.addColorStop(0, `rgba(${ICE},0)`);
          light.addColorStop(0.6, `rgba(${ICE},${0.42 * visible})`);
          light.addColorStop(1, `rgba(${ICE},0)`);
          outline(Math.max(-step, head - length), Math.min(w + step, head));
          ctx.fillStyle = light;
          ctx.fill();
        }
      });
      ctx.restore();
    },
  };
}

/** A survey map of the shared ground: contour lines that shift and ring the pointer. */
function contours(ctx: CanvasRenderingContext2D, w: number, h: number, pointer: Pointer): Field {
  const cell = w < 720 ? 14 : 18;
  const cols = Math.ceil(w / cell),
    rows = Math.ceil(h / cell);
  const stride = cols + 1;
  const values = new Float32Array(stride * (rows + 1));
  const levels = [-0.6, -0.36, -0.12, 0.12, 0.36, 0.6, 0.84];
  return {
    draw(t) {
      const time = t * 0.16;
      for (let r = 0; r <= rows; r++)
        for (let c = 0; c <= cols; c++) {
          const x = c * cell,
            y = r * cell;
          let value =
            (Math.sin(x * 0.0056 + time) +
              Math.sin(y * 0.0078 - time * 0.8) +
              Math.sin(x * 0.0037 + y * 0.0049 + time * 0.5) +
              0.5 * Math.sin(x * 0.0105 - y * 0.0087 - time * 0.3)) /
            3.1;
          if (pointer.on) {
            const distance = Math.hypot(x - pointer.x, y - pointer.y) / 150;
            value += 0.85 * Math.exp(-distance * distance);
          }
          values[r * stride + c] = value;
        }
      glow(ctx, w * 0.7, h * 0.32, Math.max(w, h) * 0.4, BLUE, 0.06);
      levels.forEach((level, index) => {
        // Every third line is an index contour, as on a printed survey map.
        const major = index % 3 === 0;
        ctx.lineWidth = major ? 1.4 : 1;
        ctx.strokeStyle = `rgba(${BLUE},${major ? 0.3 : 0.15})`;
        ctx.beginPath();
        trace(ctx, values, cols, rows, cell, level);
        ctx.stroke();
      });
    },
  };
}

/** The hero hub seen from above: a core, satellites on fixed orbits and outward rings. */
function rings(ctx: CanvasRenderingContext2D, w: number, h: number, rtl: boolean): Field {
  const narrow = w < 720;
  // On phones the hub sits in the trailing top corner, clear of the headline.
  const cx = w * (narrow ? (rtl ? 0.1 : 0.9) : rtl ? 0.2 : 0.8);
  const cy = h * (narrow ? 0.1 : 0.44);
  const scale = clamp(h / 470, 0.75, 1.35);
  const reach = Math.max(w * 0.55, h * 1.1);
  const orbits = [
    { radius: 118 * scale, speed: 0.34, satellites: 1, dashed: false },
    { radius: 205 * scale, speed: -0.2, satellites: 2, dashed: true },
    { radius: 310 * scale, speed: 0.12, satellites: 3, dashed: false },
  ];
  function square(x: number, y: number, size: number, rotation: number, fill: boolean) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    if (fill) ctx.fillRect(-size / 2, -size / 2, size, size);
    else ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
  return {
    draw(t) {
      glow(ctx, cx, cy, 330 * scale, BLUE, 0.2 + Math.sin(t * 0.8) * 0.03);
      ctx.lineWidth = 1;
      for (let index = 0; index < 6; index++) {
        const phase = fract(t * 0.05 + index / 6);
        const enter = Math.min(1, phase / 0.06);
        ctx.strokeStyle = `rgba(${PERIWINKLE},${Math.pow(1 - phase, 1.7) * 0.4 * enter})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 40 * scale + phase * reach, 0, TAU);
        ctx.stroke();
      }
      orbits.forEach((orbit, index) => {
        ctx.strokeStyle = `rgba(${PERIWINKLE},0.16)`;
        if (orbit.dashed) {
          ctx.setLineDash([2, 9]);
          ctx.lineDashOffset = -t * 7;
          ctx.strokeStyle = `rgba(${PERIWINKLE},0.34)`;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, orbit.radius, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let s = 0; s < orbit.satellites; s++) {
          const angle = t * orbit.speed + (s * TAU) / orbit.satellites + index * 1.3;
          const sign = Math.sign(orbit.speed);
          for (let step = 0; step < 8; step++) {
            ctx.strokeStyle = `rgba(${ICE},${Math.pow(1 - step / 8, 2) * 0.7})`;
            ctx.beginPath();
            const start = angle - sign * step * 0.05,
              end = angle - sign * (step + 1) * 0.05;
            ctx.arc(cx, cy, orbit.radius, Math.min(start, end), Math.max(start, end));
            ctx.stroke();
          }
          const x = cx + Math.cos(angle) * orbit.radius,
            y = cy + Math.sin(angle) * orbit.radius;
          glow(ctx, x, y, 12, PERIWINKLE, 0.45);
          ctx.fillStyle = `rgba(${ICE},1)`;
          square(x, y, 6, angle, true);
        }
      });
      ctx.strokeStyle = `rgba(${PERIWINKLE},0.7)`;
      square(cx, cy, 46 * scale, t * 0.16, false);
      ctx.strokeStyle = `rgba(${PERIWINKLE},0.3)`;
      square(cx, cy, 66 * scale, -t * 0.1, false);
      ctx.fillStyle = `rgba(${BLUE},1)`;
      square(cx, cy, 18 * scale * (1 + Math.sin(t * 1.4) * 0.08), Math.PI / 4 + t * 0.3, true);
    },
  };
}

/**
 * Canvas 2D ambient layer for sections that have no WebGL scene. The picture is a pure
 * function of elapsed time, so a paused or reduced-motion visitor keeps a composed still.
 */
export function createAmbientField(canvas: HTMLCanvasElement, variant: AmbientVariant) {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const ctx = context;
  const rtl = document.documentElement.dir === 'rtl';
  const pointer: Pointer = { x: 0, y: 0, on: false };
  let field: Field | null = null,
    width = 0,
    height = 0,
    ratio = 1,
    elapsed = 0,
    previous = 0,
    frame = 0,
    active = false,
    disposed = false;

  function paint() {
    if (!field) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    field.draw(elapsed);
  }
  function tick(now: number) {
    if (disposed || !active) return;
    frame = requestAnimationFrame(tick);
    // Same 30 fps budget as the WebGL scenes.
    if (previous && now - previous < 1000 / 30) return;
    elapsed += previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    paint();
  }
  return {
    resize(nextWidth: number, nextHeight: number) {
      if (disposed || !nextWidth || !nextHeight) return;
      width = nextWidth;
      height = nextHeight;
      ratio = Math.min(window.devicePixelRatio || 1, width < 800 ? 1.25 : 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      field =
        variant === 'merge'
          ? merge(ctx, width, height, pointer)
          : variant === 'ribbons'
            ? ribbons(ctx, width, height, rtl)
            : variant === 'rings'
              ? rings(ctx, width, height, rtl)
              : contours(ctx, width, height, pointer);
      paint();
    },
    setActive(value: boolean) {
      if (disposed || active === value) return;
      active = value;
      canvas.dataset.animationActive = String(value);
      cancelAnimationFrame(frame);
      if (active) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      }
    },
    setPointer(x: number, y: number, on: boolean) {
      pointer.x = x;
      pointer.y = y;
      pointer.on = on;
    },
    dispose() {
      disposed = true;
      active = false;
      cancelAnimationFrame(frame);
    },
  };
}
