// Course map over satellite tiles: the gate pass lines exactly as the engine judges them, the next
// gate highlighted, the flown trail and the aircraft. Two orientations:
//   - north up: fits the course (and the aircraft, when it is near) into the box
//   - track up: the aircraft sits in the middle pointing up and the map turns under it; the scale
//     keeps the next two gates in view at any rotation
// Everything is placed in Web Mercator so it lines up with the tiles. Without network the tiles
// simply do not load and the plain background shows.
import { useMemo, useState } from "react";
import type { Course, GateType } from "../../core/course/course";
import { centroid, haversine, type Xy } from "../../core/geo/geo";
import { metersPerWorldPx, tileZoomFor, tilesCovering, worldPx } from "../../core/geo/tiles";
import { gatePassLine } from "../../core/race/engine";
import type { Fix } from "../../core/race/fix";
import { ESRI_ATTRIBUTION, ESRI_MAX_NATIVE_ZOOM, ESRI_SATELLITE, tileUrl } from "../app/mapTiles";
import type { TrailPoint } from "./trail";

const W = 400;
const H = 300;
const PAD = 28;
/** The aircraft only joins the framing while it is this close to the course. */
const FRAME_AIRCRAFT_WITHIN_M = 3000;
/** Never zoom in past the deepest satellite tiles, however small the course. */
const MAX_SCALE = 2 ** ESRI_MAX_NATIVE_ZOOM;
/** Track up never zooms in closer than this radius around the aircraft. */
const TRACK_UP_MIN_REACH_M = 400;
const ORIENTATION_KEY = "pylon-racer.minimap.orientation";

type Orientation = "north" | "track";

const GATE_COLOR: Record<GateType, string> = {
  start: "var(--gate-start)",
  finish: "var(--gate-finish)",
  gate: "var(--gate-gate)",
  level: "var(--gate-level)",
  knife: "var(--gate-knife)",
  inverted: "var(--gate-inverted)",
  turn: "var(--gate-turn)",
};

interface Props {
  course: Course;
  nextGate: number | null;
  passed: ReadonlySet<number>;
  fix: Fix | null;
  trail: readonly TrailPoint[];
}

function loadOrientation(): Orientation {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === "track" ? "track" : "north";
  } catch {
    return "north";
  }
}

export function MiniMap({ course, nextGate, passed, fix, trail }: Props) {
  const [orientation, setOrientation] = useState<Orientation>(loadOrientation);
  const toggle = (): void => {
    const next = orientation === "north" ? "track" : "north";
    setOrientation(next);
    try {
      localStorage.setItem(ORIENTATION_KEY, next);
    } catch {
      // a remembered preference is a convenience only
    }
  };

  const ref = useMemo(() => centroid(course.gates.map((g) => g.center)), [course]);
  const lines = useMemo(
    () =>
      course.gates.map((g) => {
        const { a, b } = gatePassLine(g);
        return { a: worldPx(a), b: worldPx(b), center: worldPx(g.center), type: g.type };
      }),
    [course],
  );

  const near = fix !== null && haversine(fix, ref) < FRAME_AIRCRAFT_WITHIN_M;
  const plane = fix ? worldPx(fix) : null;
  const trackUp = orientation === "track" && near && plane !== null;
  const coursePts: Xy[] = lines.flatMap((l) => [l.a, l.b]);

  // --- view: world-pixel center, screen px per world px, map rotation ---------------------------
  let cx: number;
  let cy: number;
  let scale: number;
  if (trackUp) {
    cx = plane!.x;
    cy = plane!.y;
    // A navigation view: frame the next gate and the one after it, at any rotation.
    const ahead =
      nextGate !== null ? [lines[nextGate]!, lines[(nextGate + 1) % lines.length]!].flatMap((l) => [l.a, l.b]) : coursePts;
    const reach = Math.max(...ahead.map((p) => Math.hypot(p.x - cx, p.y - cy)), TRACK_UP_MIN_REACH_M / metersPerWorldPx(fix!.lat));
    scale = (Math.min(W, H) / 2 - PAD / 2) / reach;
  } else {
    const framed = near && plane ? [...coursePts, plane] : coursePts;
    const xs = framed.map((p) => p.x);
    const ys = framed.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    cx = (minX + maxX) / 2;
    cy = (minY + maxY) / 2;
    scale = Math.min((W - 2 * PAD) / Math.max(maxX - minX, 1e-9), (H - 2 * PAD) / Math.max(maxY - minY, 1e-9));
  }
  scale = Math.min(scale, MAX_SCALE);
  const rotation = trackUp ? -fix!.headingDeg : 0;

  const sx = (p: Xy): number => W / 2 + (p.x - cx) * scale;
  const sy = (p: Xy): number => H / 2 + (p.y - cy) * scale;

  // A rotated view needs tiles out to the corners at every angle: cover the circumscribed circle.
  const halfW = (trackUp ? Math.hypot(W, H) / 2 : W / 2) / scale;
  const halfH = (trackUp ? Math.hypot(W, H) / 2 : H / 2) / scale;
  const tiles = tilesCovering(cx - halfW, cy - halfH, cx + halfW, cy + halfH, tileZoomFor(scale, ESRI_MAX_NATIVE_ZOOM));

  const route = [...lines.map((l) => l.center), ...(course.laps > 1 ? [lines[0]!.center] : [])];
  const trailPath = trail
    .map((p, i) => {
      const q = worldPx(p);
      return `${i === 0 || p.jump ? "M" : "L"}${sx(q).toFixed(1)},${sy(q).toFixed(1)}`;
    })
    .join("");
  const target = nextGate !== null ? lines[nextGate] : undefined;
  /** Labels stay upright while the map turns. */
  const upright = (x: number, y: number): string | undefined => (rotation ? `rotate(${-rotation} ${x} ${y})` : undefined);

  return (
    <div className="minimap-box">
      <svg viewBox={`0 0 ${W} ${H}`} className="minimap" role="img" aria-label="Course map">
        <g transform={rotation ? `rotate(${rotation} ${W / 2} ${H / 2})` : undefined}>
          {tiles.map((t) => (
            <image
              key={`${t.z}/${t.x}/${t.y}/${t.left}`}
              href={tileUrl(ESRI_SATELLITE, t.z, t.x, t.y)}
              x={sx({ x: t.left, y: t.top })}
              y={sy({ x: t.left, y: t.top })}
              // half a pixel of overlap hides the seams between neighbouring tiles
              width={t.size * scale + 0.5}
              height={t.size * scale + 0.5}
              preserveAspectRatio="none"
            />
          ))}
          <rect x={-W} y={-H} width={3 * W} height={3 * H} fill="var(--map-dim)" />
          <polyline
            points={route.map((p) => `${sx(p)},${sy(p)}`).join(" ")}
            fill="none"
            stroke="var(--map-route)"
            strokeWidth={8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {trailPath && <path d={trailPath} fill="none" stroke="var(--info)" strokeWidth={2} />}
          {plane && near && target && (
            <line
              x1={sx(plane)}
              y1={sy(plane)}
              x2={sx(target.center)}
              y2={sy(target.center)}
              stroke="var(--text-1)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.7}
            />
          )}
          {lines.map((l, i) => {
            const isNext = i === nextGate;
            const done = passed.has(i) && !isNext;
            const lx = sx(l.center);
            const ly = sy(l.center);
            return (
              <g key={i} opacity={done ? 0.45 : 1}>
                {isNext && (
                  <line x1={sx(l.a)} y1={sy(l.a)} x2={sx(l.b)} y2={sy(l.b)} stroke="var(--text-1)" strokeWidth={9} strokeLinecap="round" opacity={0.35} />
                )}
                <line x1={sx(l.a)} y1={sy(l.a)} x2={sx(l.b)} y2={sy(l.b)} stroke={GATE_COLOR[l.type]} strokeWidth={3} strokeLinecap="round" />
                <circle cx={sx(l.a)} cy={sy(l.a)} r={4} fill={GATE_COLOR[l.type]} />
                {l.type !== "turn" && <circle cx={sx(l.b)} cy={sy(l.b)} r={4} fill={GATE_COLOR[l.type]} />}
                <g transform={upright(lx, ly)}>
                  <text x={lx + 8} y={ly - 8} className="minimap-label">
                    {i + 1}
                  </text>
                </g>
              </g>
            );
          })}
          {plane && near && fix && (
            <g transform={`translate(${sx(plane)},${sy(plane)}) rotate(${fix.headingDeg})`}>
              <path d="M0,-9 L6,7 L0,3 L-6,7 Z" fill="var(--text-1)" stroke="var(--surface-0)" strokeWidth={1} />
            </g>
          )}
        </g>
        {fix && !near && (
          <text x={W / 2} y={H - 22} textAnchor="middle" className="minimap-label">
            {farLabel(fix, course, nextGate)}
          </text>
        )}
        {trackUp && <NorthArrow rotation={rotation} />}
        <text x={W - 4} y={H - 4} textAnchor="end" className="minimap-credit">
          {ESRI_ATTRIBUTION}
        </text>
      </svg>
      <button
        className="minimap-toggle"
        onClick={toggle}
        title={orientation === "north" ? "Turn the map with the aircraft" : "Keep north up"}
      >
        {orientation === "north" ? "North up" : "Track up"}
      </button>
    </div>
  );
}

/** Where north is while the map turns: an arrow in a disc, the N upright at its tail. */
function NorthArrow({ rotation }: { rotation: number }) {
  const r = (rotation * Math.PI) / 180;
  return (
    <g transform={`translate(${W - 22},22)`}>
      <circle r={14} fill="var(--surface-0)" opacity={0.7} />
      <path d="M0,-11 L4,3 L0,1 L-4,3 Z" fill="var(--bad)" transform={`rotate(${rotation})`} />
      <text x={-7 * Math.sin(r)} y={7 * Math.cos(r) + 4} textAnchor="middle" className="minimap-label">
        N
      </text>
    </g>
  );
}

/** Where the aircraft is while it is off the map: measured to the next gate, like "Next" says (the
 *  course's middle gave a different number), or to the nearest gate when there is no next one. */
function farLabel(fix: Fix, course: Course, nextGate: number | null): string {
  const target =
    nextGate !== null
      ? nextGate
      : course.gates.reduce((best, g, i) => (haversine(fix, g.center) < haversine(fix, course.gates[best]!.center) ? i : best), 0);
  const km = (haversine(fix, course.gates[target]!.center) / 1000).toFixed(1);
  return `Aircraft ${km} km from gate ${target + 1}`;
}
