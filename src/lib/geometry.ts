export interface P {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Angle at vertex b, formed by segments a-b and c-b, in degrees (0..180). */
export function angleDeg(a: P, b: P, c: P): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return NaN;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Euclidean distance in 2D. */
export function dist(a: P, b: P): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Rolling median for denoising scalar time-series. Keeps last N samples. */
export class RollingMedian {
  private buf: number[] = [];
  constructor(private size = 5) {}
  push(v: number): number {
    if (Number.isNaN(v)) return this.current();
    this.buf.push(v);
    if (this.buf.length > this.size) this.buf.shift();
    return this.current();
  }
  current(): number {
    if (this.buf.length === 0) return NaN;
    const sorted = [...this.buf].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  reset() {
    this.buf = [];
  }
}

/**
 * Exponential Moving Average — low-lag smoother for angle time-series.
 * alpha=0.25 balances responsiveness vs. noise suppression for ~30 FPS.
 * Use after RollingMedian for best results: median kills spikes, EMA smooths trajectory.
 */
export class EMA {
  private _value = NaN;
  constructor(private alpha = 0.25) {}
  push(v: number): number {
    if (Number.isNaN(v)) return this._value;
    this._value = Number.isNaN(this._value)
      ? v
      : this.alpha * v + (1 - this.alpha) * this._value;
    return this._value;
  }
  get current(): number { return this._value; }
  reset() { this._value = NaN; }
}

/** Check if a set of landmarks all have adequate visibility. */
export function visible(points: P[], threshold = 0.5): boolean {
  return points.every((p) => (p.visibility ?? 1) >= threshold);
}

/**
 * Knee valgus ratio: knee width divided by ankle width.
 * Values below ~0.75 indicate knees caving inward.
 * Returns 1 (safe) when ankle width is negligible (landmarks too close).
 */
export function kneeValgusRatio(lKnee: P, rKnee: P, lAnkle: P, rAnkle: P): number {
  const kneeW = Math.abs(lKnee.x - rKnee.x);
  const ankleW = Math.abs(lAnkle.x - rAnkle.x);
  return ankleW < 0.01 ? 1 : kneeW / ankleW;
}

/**
 * Returns true when two landmarks are likely occluding each other — i.e. they
 * overlap in screen-space (x,y close) but are separated in depth (z far apart).
 * Uses MediaPipe's normalised z (negative = closer to camera).
 * Typical threshold: xyTol=0.05 (5 % of frame width), zTol=0.12.
 */
export function limbsOccluded(
  a: P,
  b: P,
  xyTol = 0.05,
  zTol = 0.12,
): boolean {
  if (a.z === undefined || b.z === undefined) return false;
  const xyClose = Math.hypot(a.x - b.x, a.y - b.y) < xyTol;
  const zFar    = Math.abs(a.z - b.z) > zTol;
  return xyClose && zFar;
}
