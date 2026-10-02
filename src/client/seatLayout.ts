export interface Point {
  x: number;
  y: number;
}

/**
 * Places `count` seats evenly (by arc length) on an ellipse, starting at the
 * bottom centre and going clockwise on screen (bottom → left → top → right),
 * which matches the real seating order around a table.
 */
export function ellipseSeats(count: number, cx: number, cy: number, rx: number, ry: number): Point[] {
  const steps = 720;
  const pts: Point[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= steps; i++) {
    const t = Math.PI / 2 + (i / steps) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
    if (i > 0) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[steps];
  const out: Point[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const target = (k / count) * total;
    while (j < steps && cum[j + 1] < target) j++;
    out.push(pts[j]);
  }
  return out;
}

/** Rotates the seat list so the viewer sits at index 0 (bottom centre). */
export function rotateToViewer<T extends { id: string }>(players: T[], viewerId: string | undefined): T[] {
  const i = players.findIndex((p) => p.id === viewerId);
  return i <= 0 ? players : [...players.slice(i), ...players.slice(0, i)];
}
