import { useEffect, useRef, useState } from "react";
import { AIRCRAFT_CLASSES, classLabel, classOfAircraft, resolveClass } from "../core/ranking/classes";
import type { SketchPoint, TelemetryStatus } from "../shared/racerApi";
import { fmtDistance, fmtTime } from "./app/format";
import { LogoMark } from "./app/Logo";
import { Designer } from "./design/Designer";
import { RaceView } from "./race/RaceView";
import { useStore } from "./state/store";

export function App() {
  const init = useStore((s) => s.init);
  const bridge = useStore((s) => s.bridge);
  const message = useStore((s) => s.message);
  const dismiss = useStore((s) => s.dismissMessage);
  const chooseXplaneDir = useStore((s) => s.chooseXplaneDir);
  const view = useStore((s) => s.view);
  const pinned = useStore((s) => s.app?.prefs.onTop ?? false);
  const dropping = useFileDrop();

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className={`app ${pinned ? "pinned" : ""} ${dropping ? "dropping" : ""}`}>
      <TopBar />
      {message && (
        <div className={`message message-${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          <span>{message.text}</span>
          <span className="message-actions">
            {message.chooseXplane && <button onClick={() => void chooseXplaneDir()}>Choose folder…</button>}
            <button onClick={dismiss}>Dismiss</button>
          </span>
        </div>
      )}
      {bridge ? (
        <div className="body">
          <CourseList />
          {view === "design" ? <Designer /> : <RaceView />}
        </div>
      ) : (
        <div className="body empty muted">
          This page needs the XP Pylon Racer app. In the browser preview, open it with ?mockracer.
        </div>
      )}
    </div>
  );
}

/** Files dragged onto the window import as if picked with Import…; true while a drag is over it. */
function useFileDrop(): boolean {
  const importDropped = useStore((s) => s.importDropped);
  const [over, setOver] = useState(false);
  useEffect(() => {
    // Every drag event must be cancelled, or the browser opens the dropped file in the window.
    let depth = 0;
    const hasFiles = (e: DragEvent): boolean => e.dataTransfer?.types.includes("Files") ?? false;
    const enter = (e: DragEvent): void => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent): void => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const overHandler = (e: DragEvent): void => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const drop = (e: DragEvent): void => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      void importDropped([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overHandler);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overHandler);
      window.removeEventListener("drop", drop);
    };
  }, [importDropped]);
  return over;
}

function TopBar() {
  const app = useStore((s) => s.app);
  const telemetry = useStore((s) => s.update?.telemetry ?? null);
  const setPrefs = useStore((s) => s.setPrefs);
  const onTop = app?.prefs.onTop ?? false;

  return (
    <header className="topbar">
      <div className="brand">
        <LogoMark size={26} />
        <span className="brand-name">
          <span className="brand-sim">XP</span> Pylon Racer
        </span>
        <span className="brand-version num">{app?.version ?? __APP_VERSION__}</span>
      </div>
      <div className="topbar-right">
        <TelemetryPills t={telemetry} />
        {app && (
          <button
            className={`toggle ${onTop ? "on" : ""}`}
            aria-pressed={onTop}
            title="Keep this window above the simulator (run X-Plane windowed)"
            onClick={() => void setPrefs({ onTop: !onTop })}
          >
            {onTop ? "Pinned on top" : "Pin on top"}
          </button>
        )}
        <PilotMenu />
      </div>
    </header>
  );
}

/** The pilots of this computer (brothers who compete): switch, add, remove. Runs from the next start
 *  belong to the active pilot. */
function PilotMenu() {
  const app = useStore((s) => s.app);
  const setPilot = useStore((s) => s.setPilot);
  const removePilot = useStore((s) => s.removePilot);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const close = (): void => {
    setOpen(false);
    setAdding(false);
    setDraft("");
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = (name: string): void => {
    close();
    if (name !== app?.pilot) void setPilot(name);
  };

  if (!app) return null;
  return (
    <div className="pilot" ref={box}>
      <button
        className="pilot-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Who is flying: switch pilots or add one"
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="pilot-avatar" aria-hidden>
          {app.pilot.slice(0, 1).toUpperCase()}
        </span>
        {app.pilot}
        <span className="pilot-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="pilot-menu" role="menu">
          {app.pilots.map((p) => (
            <div key={p} className={`pilot-item ${p === app.pilot ? "active" : ""}`}>
              <button role="menuitemradio" aria-checked={p === app.pilot} onClick={() => choose(p)}>
                {p}
              </button>
              {p !== app.pilot && (
                <button
                  className="pilot-remove"
                  title={`Remove ${p} from the pilots (their runs are kept)`}
                  onClick={() => {
                    if (window.confirm(`Remove ${p} from the pilots? Their runs are kept.`)) void removePilot(p);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {adding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) choose(draft.trim());
              }}
            >
              <input autoFocus value={draft} maxLength={32} placeholder="Callsign" onChange={(e) => setDraft(e.target.value)} />
            </form>
          ) : (
            <button className="pilot-new" role="menuitem" onClick={() => setAdding(true)}>
              New pilot…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TelemetryPills({ t }: { t: TelemetryStatus | null }) {
  if (!t) return null;
  const rposOn = t.rpos.ageS !== null && t.rpos.ageS < 2;
  return (
    <div className="pills">
      {t.demo.running && (
        <span className="pill on">
          <span className="dot" /> Demo flight
        </span>
      )}
      <span
        className={`pill ${rposOn ? "on" : t.rpos.error ? "warn" : ""}`}
        title={t.rpos.error ?? "X-Plane's position output (RPOS), asked for on UDP port 49000"}
      >
        <span className="dot" /> X-Plane {rposOn ? `${Math.round(t.rpos.hz)} Hz` : t.rpos.error ? "error" : "waiting"}
      </span>
      <AircraftClass t={t} />
    </div>
  );
}

/** The aircraft and the class it is ranked in. An aircraft the app does not know, or none at all
 *  (X-Plane's Web API off), gets a class picker; the choice is remembered. Not during a demo flight:
 *  it never ranks. */
function AircraftClass({ t }: { t: TelemetryStatus }) {
  const choices = useStore((s) => s.app?.classChoices);
  const setAircraftClass = useStore((s) => s.setAircraftClass);
  if (!choices || (!t.aircraft && !t.active) || t.active === "demo") return null;
  const known = classOfAircraft(t.aircraft);
  if (known) {
    return (
      <span className="pill" title="Runs are ranked against others in this aircraft class">
        {t.aircraft} · {classLabel(known)}
      </span>
    );
  }
  const cls = resolveClass(t.aircraft, choices);
  return (
    <label
      className="pill class-pick"
      title={
        t.aircraft
          ? "XP Pylon Racer doesn't know this aircraft: choose the class its runs are ranked in"
          : t.webApi.error
            ? `X-Plane isn't saying which aircraft you fly (${t.webApi.error}): choose the class your runs are ranked in`
            : "X-Plane isn't saying which aircraft you fly: choose the class your runs are ranked in"
      }
    >
      {t.aircraft ?? "Aircraft"} ·{" "}
      <select value={cls ?? ""} onChange={(e) => void setAircraftClass(t.aircraft, e.target.value || null)}>
        <option value="">Unclassified</option>
        {AIRCRAFT_CLASSES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CourseList() {
  const courses = useStore((s) => s.courses);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const importFiles = useStore((s) => s.importFiles);
  const newCourse = useStore((s) => s.newCourse);

  return (
    <nav className="courses">
      <div className="courses-head">
        <span className="label">Courses</span>
        <span className="courses-tools">
          <button onClick={newCourse} title="Design a new course">
            + New
          </button>
          <button
            onClick={() => void importFiles()}
            title="Import courses (.pylonrace) from other pilots, or the old pylon-race course.json. You can also drop the files on the window."
          >
            Import…
          </button>
        </span>
      </div>
      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            <button className={`course ${selected?.id === c.id ? "active" : ""}`} onClick={() => void select(c.id)}>
              <CourseSketch points={c.sketch} closed={c.laps > 1} />
              <span className="course-text">
                <span className="course-name">{c.name}</span>
                <span className="course-meta num">
                  {c.gates} gates · {fmtDistance(c.lapLengthM * c.laps)}
                  {c.laps > 1 ? ` · ${c.laps} laps` : ""}
                </span>
                <span className="course-foot">
                  {c.bestTotal !== null ? (
                    <span className="course-best display">{fmtTime(c.bestTotal)}</span>
                  ) : (
                    <span className="course-nobest">No runs yet</span>
                  )}
                  {c.install.state !== "none" && (
                    <span
                      className={`chip ${c.install.state === "current" ? "good" : "warn"}`}
                      title={c.install.state === "current" ? "Its pylons are installed in X-Plane" : "The pylons in X-Plane are from an older version of this course"}
                    >
                      {c.install.state === "current" ? "In X-Plane" : "Reinstall"}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A thumbnail of the route: the gates in order, colored by kind. */
function CourseSketch({ points, closed }: { points: SketchPoint[]; closed: boolean }) {
  const S = 44;
  const P = 5;
  const xy = points.map((p) => [P + p.x * (S - 2 * P), P + p.y * (S - 2 * P)] as const);
  const path = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + (closed ? " Z" : "");
  return (
    <svg className="course-sketch" width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
      <path d={path} />
      {xy.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 ? 3 : 2.2} className={`type-${points[i]!.type}`} />
      ))}
    </svg>
  );
}
