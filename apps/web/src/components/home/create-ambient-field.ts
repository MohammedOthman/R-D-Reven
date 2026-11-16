export type AmbientVariant = 'network' | 'flow' | 'rings' | 'grid';

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

/** Companies as drifting nodes; links form within range and carry signals between them. */
function network(ctx: CanvasRenderingContext2D, w: number, h: number, pointer: Pointer): Field {
  const random = seeded(11);
  const cols = clamp(Math.round(w / 150), 4, 11);
  const rows = clamp(Math.round(h / 150), 3, 7);
  const reach = clamp(w / 6, 130, 200);
  const nodes = Array.from({ length: cols * rows }, (_, index) => ({
    // One jittered node per cell keeps coverage even at every viewport size.
    bx: (((index % cols) + 0.15 + random() * 0.7) / cols) * w,
    by: ((Math.floor(index / cols) + 0.15 + random() * 0.7) / rows) * h,
    ax: 16 + random() * 30,
    ay: 16 + random() * 30,
    sx: 0.1 + random() * 0.2,
    sy: 0.1 + random() * 0.2,
    px: random() * TAU,
    py: random() * TAU,
    hub: random() < 0.16,
    x: 0,
    y: 0,
  }));
  return {
    draw(t) {
      glow(
        ctx,
        w * (0.22 + Math.sin(t * 0.07) * 0.08),
        h * (0.35 + Math.cos(t * 0.05) * 0.15),
        Math.max(w, h) * 0.42,
        BLUE,
        0.17,
      );
      glow(
        ctx,
        w * (0.8 + Math.cos(t * 0.06) * 0.07),
        h * (0.7 + Math.sin(t * 0.08) * 0.14),
        Math.max(w, h) * 0.36,
        PERIWINKLE,
        0.08,
      );
      for (const node of nodes) {
        node.x = node.bx + Math.sin(t * node.sx + node.px) * node.ax;
        node.y = node.by + Math.cos(t * node.sy + node.py) * node.ay;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!,
            b = nodes[j]!;
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          if (distance > reach) continue;
          const strength = Math.pow(1 - distance / reach, 1.4);
          ctx.strokeStyle = `rgba(${PERIWINKLE},${strength * 0.46})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          if ((i * 7 + j * 13) % 4) continue;
          // A signal exists only while its link does, so it fades as the companies drift apart.
          const phase = fract(t * 0.2 + ((i * 31 + j * 17) % 100) / 100);
          const from = (i + j) % 2 ? a : b,
            to = from === a ? b : a;
          const x = from.x + (to.x - from.x) * phase,
            y = from.y + (to.y - from.y) * phase;
          const tail = Math.min(18, distance * phase);
          const ux = (to.x - from.x) / distance,
            uy = (to.y - from.y) / distance;
          const alpha = Math.min(1, strength * 3.2);
          ctx.strokeStyle = `rgba(${ICE},${alpha * 0.55})`;
          ctx.beginPath();
          ctx.moveTo(x - ux * tail, y - uy * tail);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.fillStyle = `rgba(${ICE},${alpha})`;
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
      if (pointer.on) {
        glow(ctx, pointer.x, pointer.y, 240, BLUE, 0.13);
        for (const node of nodes) {
          const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
          if (distance > 230) continue;
          ctx.strokeStyle = `rgba(${ICE},${(1 - distance / 230) * 0.4})`;
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(node.x, node.y);
          ctx.stroke();
        }
      }
      nodes.forEach((node, index) => {
        if (node.hub) {
          const pulse = fract(t * 0.3 + index * 0.37);
          ctx.strokeStyle = `rgba(${PERIWINKLE},${(1 - pulse) * 0.5})`;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 5 + pulse * 17, 0, TAU);
          ctx.stroke();
          ctx.fillStyle = `rgba(${BLUE},1)`;
          ctx.fillRect(node.x - 3.5, node.y - 3.5, 7, 7);
          ctx.strokeStyle = `rgba(${ICE},0.85)`;
          ctx.strokeRect(node.x - 3.5, node.y - 3.5, 7, 7);
        } else {
          ctx.fillStyle = `rgba(${PERIWINKLE},0.75)`;
          ctx.fillRect(node.x - 1.5, node.y - 1.5, 3, 3);
        }
      });
    },
  };
}

/** Parallel work streams travelling in reading direction: agreement toward result. */
function flow(ctx: CanvasRenderingContext2D, w: number, h: number, rtl: boolean): Field {
  const random = seeded(23);
  const count = clamp(Math.round(h / 40), 8, 18);
  const lines = Array.from({ length: count }, (_, index) => ({
    y: (h * (index + 0.5)) / count,
    amp: 8 + random() * 24,
    k: 0.0022 + random() * 0.0034,
    speed: 0.14 + random() * 0.26,
    phase: random() * TAU,
    comets: Array.from({ length: random() < 0.45 ? 2 : 1 }, () => ({
      velocity: 0.035 + random() * 0.055,
      offset: random(),
      length: 90 + random() * 120,
    })),
  }));
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, `rgba(${PERIWINKLE},0)`);
  fade.addColorStop(0.18, `rgba(${PERIWINKLE},0.17)`);
  fade.addColorStop(0.82, `rgba(${PERIWINKLE},0.17)`);
  fade.addColorStop(1, `rgba(${PERIWINKLE},0)`);
  const direction = rtl ? -1 : 1;
  return {
    draw(t) {
      glow(ctx, w * (0.5 + Math.sin(t * 0.06) * 0.25), h * 0.25, Math.max(w, h) * 0.4, BLUE, 0.14);
      ctx.lineWidth = 1;
      for (const line of lines) {
        const y = (x: number) =>
          line.y +
          line.amp * Math.sin(x * line.k + t * line.speed + line.phase) +
          line.amp * 0.4 * Math.sin(x * line.k * 2.3 - t * line.speed * 0.7 + line.phase * 2);
        ctx.strokeStyle = fade;
        ctx.beginPath();
        for (let x = 0; x <= w + 16; x += 16) ctx.lineTo(x, y(x));
        ctx.stroke();
        for (const comet of line.comets) {
          const travelled =
            fract(t * comet.velocity + comet.offset) * (w + comet.length * 2) - comet.length;
          const head = rtl ? w - travelled : travelled;
          const edge = clamp(Math.min(head, w - head) / (w * 0.14), 0, 1);
          const steps = 10;
          for (let step = 0; step < steps; step++) {
            const x0 = head - (direction * comet.length * step) / steps;
            const x1 = head - (direction * comet.length * (step + 1)) / steps;
            ctx.strokeStyle = `rgba(${ICE},${Math.pow(1 - step / steps, 2) * 0.8 * edge})`;
            ctx.beginPath();
            ctx.moveTo(x0, y(x0));
            ctx.lineTo(x1, y(x1));
            ctx.stroke();
          }
          const headY = y(head);
          glow(ctx, head, headY, 9, PERIWINKLE, 0.5 * edge);
          ctx.fillStyle = `rgba(255,255,255,${edge})`;
          ctx.fillRect(head - 1.5, headY - 1.5, 3, 3);
        }
      }
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

/** The city's ground plane as a dot matrix; evidence pulses ripple across it. */
function grid(ctx: CanvasRenderingContext2D, w: number, h: number, pointer: Pointer): Field {
  const spacing = w < 720 ? 24 : 30;
  const cols = Math.ceil(w / spacing) + 1;
  const rows = Math.ceil(h / spacing) + 1;
  const offsetX = (w - (cols - 1) * spacing) / 2;
  const offsetY = (h - (rows - 1) * spacing) / 2;
  const reach = Math.hypot(w, h) * 0.75;
  const origins = [
    { x: w * 0.12, y: h * 0.2, delay: 0 },
    { x: w * 0.9, y: h * 0.75, delay: 0.5 },
  ];
  return {
    draw(t) {
      glow(ctx, w * (0.72 + Math.sin(t * 0.06) * 0.1), h * 0.3, Math.max(w, h) * 0.4, BLUE, 0.07);
      const waves = origins.map((origin) => {
        const phase = fract(t * 0.075 + origin.delay);
        return { ...origin, radius: phase * reach, weight: 1 - phase };
      });
      ctx.fillStyle = `rgb(${BLUE})`;
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const x = offsetX + col * spacing,
            y = offsetY + row * spacing;
          let energy = 0;
          for (const wave of waves) {
            const offset = (Math.hypot(x - wave.x, y - wave.y) - wave.radius) / 60;
            energy += Math.exp(-offset * offset) * wave.weight;
          }
          if (pointer.on) {
            const offset = Math.hypot(x - pointer.x, y - pointer.y) / 110;
            energy += Math.exp(-offset * offset) * 1.1;
          }
          energy = Math.min(1, energy);
          const size = 1.2 + energy * 1.5;
          ctx.globalAlpha = 0.11 + energy * 0.4;
          ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
      ctx.globalAlpha = 1;
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
        variant === 'network'
          ? network(ctx, width, height, pointer)
          : variant === 'flow'
            ? flow(ctx, width, height, rtl)
            : variant === 'rings'
              ? rings(ctx, width, height, rtl)
              : grid(ctx, width, height, pointer);
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
