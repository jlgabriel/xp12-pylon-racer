// The designer's map (Leaflet). Click the map to append a gate. Each gate has three handles, all
// Leaflet draggable markers (a marker drag never pans the map):
//   - the center: move the gate
//   - the arrow ahead of it: rotate (the heading points at the arrow)
//   - either pylon: set the width, mirrored about the center, measured along the gate line
// While dragging, the gate and the route redraw live from a temporary copy; the edit is committed
// to the store on dragend, so the store never sees half-finished drags.
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import type { Gate } from "../../core/course/course";
import { handleOf, headingFromHandle, widthFromPylon, type Draft } from "../../core/course/edit";
import type { LonLat } from "../../core/geo/geo";
import { gatePassLine } from "../../core/race/engine";
import type { PlaceHit } from "../../shared/racerApi";
import { getRacer } from "../app/racer";
import { ESRI_ATTRIBUTION, ESRI_MAX_NATIVE_ZOOM, ESRI_SATELLITE, OSM_STREETS } from "../app/mapTiles";

/** Where a brand-new course opens: KDAG, the open-desert test site. */
const DEFAULT_VIEW: LonLat = { lon: -116.8, lat: 34.852 };

interface Props {
  draft: Draft;
  selectedGateId: string | null;
  focusRequest: { id: string; n: number } | null;
  onAdd(at: LonLat): void;
  onSelect(id: string | null): void;
  onMove(id: string, to: LonLat): void;
  onHeading(id: string, headingDeg: number): void;
  onWidth(id: string, widthM: number): void;
}

interface GateLayers {
  line: L.Polyline;
  center: L.Marker;
  handle: L.Marker;
  left: L.Marker;
  right: L.Marker;
}

const ll = (p: LonLat): L.LatLng => L.latLng(p.lat, p.lon);
const lonLat = (p: L.LatLng): LonLat => ({ lon: p.lng, lat: p.lat });

function icon(className: string, html = ""): L.DivIcon {
  return L.divIcon({ className, html, iconSize: undefined });
}

export function DesignMap(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef(new Map<string, GateLayers>());
  const route = useRef<L.Polyline | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const gates = useRef<Gate[]>(props.draft.gates);
  gates.current = props.draft.gates;

  // --- map lifetime -----------------------------------------------------------------------------
  useEffect(() => {
    const el = box.current!;
    const map = L.map(el, { zoomControl: true, attributionControl: true });
    const sat = L.tileLayer(ESRI_SATELLITE, { maxZoom: 20, maxNativeZoom: ESRI_MAX_NATIVE_ZOOM, attribution: `Tiles &copy; Esri — ${ESRI_ATTRIBUTION}` });
    const osm = L.tileLayer(OSM_STREETS, { maxZoom: 20, maxNativeZoom: 19, attribution: "&copy; OpenStreetMap contributors" });
    sat.addTo(map);
    L.control.layers({ Satellite: sat, Streets: osm }, undefined, { position: "topright" }).addTo(map);
    route.current = L.polyline([], { className: "design-route", interactive: false }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => latest.current.onAdd(lonLat(e.latlng)));

    // Leaflet measures its box when it is created, and on mount the box can still be 0×0: framing
    // then lands at maximum zoom. Start from a plain view and frame the course on the first real size.
    const g = gates.current;
    map.setView(ll(g[0]?.center ?? DEFAULT_VIEW), 14);
    let framed = false;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (!framed && el.clientWidth > 0 && el.clientHeight > 0) {
        framed = true;
        fitTo(map, gates.current);
      }
    });
    ro.observe(el);
    mapRef.current = map;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layers.current.clear();
    };
  }, [props.draft.id]);

  // --- drawing ----------------------------------------------------------------------------------
  const draw = (g: Gate, l: GateLayers, skip?: L.Marker): void => {
    const { a, b } = gatePassLine(g);
    l.line.setLatLngs([ll(a), ll(b)]);
    if (skip !== l.center) l.center.setLatLng(ll(g.center));
    if (skip !== l.handle) l.handle.setLatLng(ll(handleOf(g)));
    // A turn pylon is a single pylon at the center: it has no width handles.
    const turn = g.type === "turn";
    if (skip !== l.left) l.left.setLatLng(ll(a));
    if (skip !== l.right) l.right.setLatLng(ll(b));
    for (const m of [l.left, l.right]) {
      m.setOpacity(turn ? 0 : 1);
      if (turn) m.dragging?.disable();
      else m.dragging?.enable();
    }
    const handleEl = l.handle.getElement()?.firstElementChild as HTMLElement | null;
    if (handleEl) handleEl.style.transform = `rotate(${g.headingDeg}deg)`;
  };

  const drawRoute = (gs: Gate[]): void => {
    const pts = gs.map((g) => ll(g.center));
    if (latest.current.draft.laps > 1 && pts.length > 2) pts.push(pts[0]!);
    route.current?.setLatLngs(pts);
  };

  /** Live redraw while dragging: a temporary gate replaces the stored one. */
  const preview = (id: string, patch: Partial<Gate>, skip: L.Marker): void => {
    const l = layers.current.get(id);
    const g = gates.current.find((x) => x.id === id);
    if (!l || !g) return;
    const temp = { ...g, ...patch };
    draw(temp, l, skip);
    drawRoute(gates.current.map((x) => (x.id === id ? temp : x)));
  };

  const create = (map: L.Map, id: string): GateLayers => {
    const l: GateLayers = {
      line: L.polyline([], { weight: 4, interactive: false }).addTo(map),
      center: L.marker([0, 0], { draggable: true, icon: icon("design-center"), zIndexOffset: 500 }).addTo(map),
      handle: L.marker([0, 0], { draggable: true, icon: icon("design-handle", "<span>▲</span>"), zIndexOffset: 400 }).addTo(map),
      left: L.marker([0, 0], { draggable: true, icon: icon("design-pylon") }).addTo(map),
      right: L.marker([0, 0], { draggable: true, icon: icon("design-pylon") }).addTo(map),
    };
    const gate = (): Gate | undefined => gates.current.find((x) => x.id === id);
    const select = (): void => latest.current.onSelect(id);

    l.center.on("click", select).on("dragstart", select);
    l.center.on("drag", () => preview(id, { center: lonLat(l.center.getLatLng()) }, l.center));
    l.center.on("dragend", () => latest.current.onMove(id, lonLat(l.center.getLatLng())));

    l.handle.on("dragstart", select);
    l.handle.on("drag", () => {
      const g = gate();
      if (g) preview(id, { headingDeg: headingFromHandle(g.center, lonLat(l.handle.getLatLng())) }, l.handle);
    });
    l.handle.on("dragend", () => {
      const g = gate();
      if (g) latest.current.onHeading(id, headingFromHandle(g.center, lonLat(l.handle.getLatLng())));
    });

    for (const m of [l.left, l.right]) {
      m.on("dragstart", select);
      m.on("drag", () => {
        const g = gate();
        if (g && g.type !== "turn") preview(id, { widthM: widthFromPylon(g.center, g.headingDeg, lonLat(m.getLatLng())) }, m);
      });
      m.on("dragend", () => {
        const g = gate();
        if (g) latest.current.onWidth(id, widthFromPylon(g.center, g.headingDeg, lonLat(m.getLatLng())));
      });
    }
    return l;
  };

  // A gate picked in the list is brought into view, close enough to grab its handles.
  useEffect(() => {
    const map = mapRef.current;
    const g = gates.current.find((x) => x.id === props.focusRequest?.id);
    if (map && g) map.setView(ll(g.center), Math.max(map.getZoom(), 17));
  }, [props.focusRequest]);

  // --- sync with the draft ------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    props.draft.gates.forEach((g, i) => {
      seen.add(g.id);
      let l = layers.current.get(g.id);
      if (!l) {
        l = create(map, g.id);
        layers.current.set(g.id, l);
      }
      const selected = g.id === props.selectedGateId;
      l.line.getElement()?.setAttribute("class", `leaflet-interactive design-line type-${g.type}${selected ? " selected" : ""}`);
      l.center.setIcon(icon(`design-center type-${g.type}${selected ? " selected" : ""}`, `<span>${i + 1}</span>`));
      draw(g, l);
    });
    for (const [id, l] of layers.current) {
      if (seen.has(id)) continue;
      for (const layer of [l.line, l.center, l.handle, l.left, l.right]) layer.remove();
      layers.current.delete(id);
    }
    drawRoute(props.draft.gates);
  });

  return (
    <div className="design-map-wrap">
      <div ref={box} className="design-map" />
      <PlaceSearch onPick={(p) => mapRef.current?.setView(ll(p), 14)} />
      {props.draft.gates.length === 0 && <div className="design-hint">Click the map to place the start gate</div>}
      {props.draft.gates.length > 0 && (
        <button className="design-fit" onClick={() => fitTo(mapRef.current, props.draft.gates)} title="Show the whole course">
          Fit course
        </button>
      )}
    </div>
  );
}

function fitTo(map: L.Map | null, gates: Gate[]): void {
  if (!map || gates.length === 0) return;
  if (gates.length === 1) map.setView(ll(gates[0]!.center), 15);
  else map.fitBounds(L.latLngBounds(gates.map((g) => ll(g.center))), { padding: [60, 60] });
}

function PlaceSearch({ onPick }: { onPick(p: LonLat): void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (): Promise<void> => {
    const racer = getRacer();
    if (!racer || !q.trim()) return;
    setError(null);
    const r = await racer.searchPlaces(q);
    if (r.ok) setHits(r.value);
    else setError(r.error.message);
  };

  return (
    <div className="design-search">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="KDAG, Reno Stead, Lake Tahoe…" aria-label="Search for a place" />
      </form>
      {error && <div className="design-search-list bad">{error}</div>}
      {hits && (
        <ul className="design-search-list">
          {hits.length === 0 && <li className="muted">No places found</li>}
          {hits.map((h, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  onPick(h);
                  setHits(null);
                }}
              >
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
