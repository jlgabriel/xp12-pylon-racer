// The race screen: timer, deltas, gate strip, next gate, map, flight values, result and the runs of
// this course. Everything shown comes from main's live updates; nothing here judges the race.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { Course, Gate, GateType } from "../../core/course/course";
import { relativeBearing } from "../../core/geo/geo";
import type { Fix } from "../../core/race/fix";
import type { Penalty, PenaltyKind, RaceSnapshot } from "../../core/race/engine";
import { passDelta } from "../../core/run/delta";
import { splits } from "../../core/run/splits";
import { lapLength } from "../../core/run/summaries";
import type { Run } from "../../core/run/run";
import { classLabel, resolveClass } from "../../core/ranking/classes";
import { classesOf, currentClass, isDemo, leaderboard, pilotRuns } from "../../core/ranking/ranking";
import type { LiveState } from "../../core/session/raceSession";
import type { RunSummary, TelemetryStatus } from "../../shared/racerApi";
import { REPLAY, REPLAY_HINT, RPOS_SHARED } from "../app/feedText";
import { KMH_PER_MS, fmtDelta, fmtDistance, fmtTime } from "../app/format";
import { useStore } from "../state/store";
import { MiniMap } from "./MiniMap";
import { dnfShort, dnfText, gateRequirements, penaltyReason } from "./rulesText";

const GATE_NAME: Record<GateType, string> = {
  start: "Start",
  finish: "Finish",
  gate: "Gate",
  level: "Level gate",
  knife: "Knife-edge gate",
  inverted: "Inverted gate",
  turn: "Turn pylon",
};

/** The README's section on connecting X-Plane (opens in the browser). */
const HELP_CONNECT = "https://github.com/jlgabriel/xp12-pylon-racer#connecting-to-x-plane-12";

/** The callsign of a new install (main/storage.ts), before the user adds their own. */
const DEFAULT_PILOT = "Pilot";

/** Penalties that mean the gate itself was not flown; the others are about HOW it was flown. */
const GATE_LOST: ReadonlySet<PenaltyKind> = new Set(["missed-gate"]);

export function RaceView() {
  const course = useStore((s) => s.selected);
  const update = useStore((s) => s.update);
  const trail = useStore((s) => s.trail);
  const bestRun = useStore((s) => s.bestRun);
  const targetRun = useStore((s) => s.targetRun);
  const resetRace = useStore((s) => s.resetRace);
  const startDemo = useStore((s) => s.startDemo);
  const stopDemo = useStore((s) => s.stopDemo);

  const live = update?.live && course && update.live.courseId === course.id ? update.live : null;
  const race = live?.race ?? null;
  const passed = useMemo(() => new Set(race?.passes.map((p) => p.gateIndex) ?? []), [race]);
  // Another course opens at its top, not where the last one was scrolled to (its ranking).
  const screen = useRef<HTMLElement>(null);
  useEffect(() => {
    if (screen.current) screen.current.scrollTop = 0;
  }, [course?.id]);

  if (!course) {
    return <main className="race empty muted">Select a course on the left.</main>;
  }

  const demoRunning = update?.telemetry.demo.running ?? false;
  const nextGateIndex = live?.nextGate?.index ?? null;
  const nextGate = nextGateIndex !== null ? course.gates[nextGateIndex]! : null;
  const lastPass = race && race.passes.length > 0 ? race.passes[race.passes.length - 1]! : null;
  const lastDelta = race && lastPass && targetRun ? passDelta(lastPass, race.penalties, targetRun) : null;
  const over = race?.status === "finished" || race?.status === "dnf";

  return (
    <main className="race" ref={screen}>
      <header className="race-head">
        <div className="race-title">
          <h1 className="display">{course.name}</h1>
          <div className="race-meta">
            {course.gates.length} gates · {fmtDistance(lapLength(course) * course.laps)}
            {course.laps > 1 ? ` · ${course.laps} laps` : ""}
            {course.author ? ` · by ${course.author}` : ""}
          </div>
          {course.description && <p className="race-desc">{course.description}</p>}
        </div>
        <div className="race-actions">
          {demoRunning ? (
            <button onClick={() => void stopDemo()}>Stop demo</button>
          ) : (
            <button onClick={() => void startDemo()} title="Fly this course with a synthetic aircraft, no simulator needed">
              Watch demo
            </button>
          )}
          <button className="primary" onClick={() => void resetRace()} title="Arm a new attempt: it starts when you fly through the start gate">
            Race again
          </button>
        </div>
      </header>
      <CourseTools />

      <div className="race-grid">
        <section className={`panel race-main status-${race?.status ?? "none"}`}>
          <StatusLine race={race} telemetry={update?.telemetry ?? null} />
          <div className="timer display">{fmtTime(race?.total ?? 0)}</div>
          <div className="deltas">
            {race && race.penaltyTotal > 0 && <span className="bad num">incl. +{race.penaltyTotal.toFixed(1)} s penalties</span>}
            {lastDelta !== null && (
              <span className={`num delta ${lastDelta < 0 ? "good" : "bad"}`}>
                {fmtDelta(lastDelta)} vs best at gate {lastPass!.gateIndex + 1}
              </span>
            )}
            {course && bestRun && (
              <span className="muted num">
                best {fmtTime(bestRun.result.total)} · {classLabel(bestRun.aircraft.classId)}
              </span>
            )}
          </div>

          <GateStrip race={race} />
          {race?.status === "running" && race.penalties.length > 0 && <PenaltyList penalties={race.penalties} course={course} />}

          {nextGate && live?.nextGate && !over && (
            <div className={`next-gate type-${nextGate.type}`}>
              <div className="label">Next{race?.status === "waiting" ? " · fly through the start to begin" : ""}</div>
              <div className="next-gate-name">
                {nextGateIndex! + 1} · {GATE_NAME[nextGate.type]}
                {race && race.laps > 1 && race.status === "running" && <span className="muted"> · lap {race.lap} of {race.laps}</span>}
              </div>
              {gateRequirements(nextGate, course).length > 0 && <div className="next-gate-needs">{gateRequirements(nextGate, course).join(" · ")}</div>}
              <div className="next-gate-where">
                <span className="num next-gate-dist">{fmtDistance(live.nextGate.distanceM)}</span>
                {live.fix && <TurnCue fix={live.fix} gate={nextGate} />}
              </div>
            </div>
          )}

          {(!race || race.status === "waiting") && <ReadyList course={course} telemetry={update?.telemetry ?? null} />}

          {race && over && <Result race={race} target={targetRun} course={course} demo={live?.demo ?? false} />}
        </section>

        <section className="panel race-side">
          <MiniMap course={course} nextGate={over ? null : nextGateIndex} passed={passed} fix={live?.fix ?? null} trail={trail} />
          <FlightValues live={live} course={course} />
        </section>
      </div>

      <Rankings />
    </main>
  );
}

/** Edit, copy, share, delete, and the course's pylons in X-Plane. */
function CourseTools() {
  const summary = useStore((s) => s.courses.find((c) => c.id === s.selected?.id));
  const busy = useStore((s) => s.busy);
  const edit = useStore((s) => s.editCourse);
  const duplicate = useStore((s) => s.duplicateCourse);
  const share = useStore((s) => s.exportCourse);
  const shirley = useStore((s) => s.exportShirley);
  const remove = useStore((s) => s.deleteCourse);
  const install = useStore((s) => s.installCourse);
  const uninstall = useStore((s) => s.uninstallCourse);
  const state = summary?.install.state ?? "none";
  return (
    <div className="course-tools">
      <div className="course-tools-group">
        <button className="ghost" onClick={edit}>
          Edit
        </button>
        <button className="ghost" onClick={() => void duplicate()}>
          Duplicate
        </button>
        <button className="ghost" onClick={() => void share()} title="Save this course as a .pylonrace file to send to other pilots">
          Share…
        </button>
        <button
          className="ghost"
          onClick={() => void shirley()}
          title="Save this course as a FlyShirley challenge: Shirley, the AI copilot, calls your race while you fly"
        >
          Export to Shirley…
        </button>
        <button className="ghost danger" onClick={() => void remove()}>
          Delete
        </button>
      </div>
      <div className="course-tools-group">
        <span className={`install-state ${state}`}>
          <span className="dot" aria-hidden />
          {state === "current" ? "Pylons in X-Plane" : state === "outdated" ? "Pylons in X-Plane are out of date" : "Pylons not in X-Plane"}
        </span>
        <button className={state === "current" ? undefined : "primary"} disabled={busy} onClick={() => void install()}>
          {state === "none" ? "Install pylons" : "Reinstall"}
        </button>
        {state !== "none" && (
          <button className="ghost" onClick={() => void uninstall()}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

/** Before the start: what is ready and what is still missing to race this course. */
function ReadyList({ course, telemetry: t }: { course: Course; telemetry: TelemetryStatus | null }) {
  const summary = useStore((s) => s.courses.find((c) => c.id === course.id));
  const choices = useStore((s) => s.app?.classChoices);
  const pilot = useStore((s) => s.app?.pilot);
  const install = summary?.install.state ?? "none";
  const start = course.gates[0];
  const cls = t?.active && choices ? resolveClass(t.aircraft, choices) : null;
  const demo = t?.active === "demo";
  const held = demo ? null : t?.rpos.shared ? RPOS_SHARED : t?.active && t.replay ? `${REPLAY}. ${REPLAY_HINT}` : null;
  const source = !t?.active ? null : demo ? "demo flight" : `X-Plane, ${Math.round(t.rpos.hz)} Hz`;
  return (
    <ul className="ready" aria-label="Before the start">
      <ReadyItem state={source && !held ? "ok" : "missing"} label="Flight data">
        {held ?? source ?? (
          <>
            waiting for X-Plane 12: start a flight on this computer. Nothing to switch on: the app asks X-Plane for its position on
            UDP port 49000.{" "}
            <a href={HELP_CONNECT} target="_blank" rel="noreferrer">
              How?
            </a>
          </>
        )}
      </ReadyItem>
      <ReadyItem state={install === "current" ? "ok" : "missing"} label="Pylons">
        {install === "current"
          ? "installed in X-Plane"
          : install === "outdated"
            ? "out of date in X-Plane: reinstall them, then restart the sim"
            : "not installed yet: the gates count anyway, but you won't see them. Install them, then restart the sim"}
      </ReadyItem>
      <XplaneFolder />
      {t?.active && t.active !== "demo" && (
        <ReadyItem state={cls !== null ? "ok" : "missing"} label="Class">
          {cls !== null ? `${t.aircraft ?? "your aircraft"} · ${classLabel(cls)}` : "choose your aircraft's class in the top bar to rank your runs"}
        </ReadyItem>
      )}
      {pilot === DEFAULT_PILOT && (
        <ReadyItem state="missing" label="Pilot">
          you are racing as "{DEFAULT_PILOT}": add your callsign with the menu at the top right
        </ReadyItem>
      )}
      {start && (
        <ReadyItem state="todo" label="Start">
          fly through gate 1 heading {String(Math.round(start.headingDeg)).padStart(3, "0")}°: the clock starts there
        </ReadyItem>
      )}
    </ul>
  );
}

/** The X-Plane 12 the pylons go into. The app takes the first installation in Laminar's list, which
 *  may not be the one the pilot flies (a forum report: an old copy on C:, the sim on E:). */
function XplaneFolder() {
  const app = useStore((s) => s.app);
  const choose = useStore((s) => s.chooseXplaneDir);
  if (!app) return null;
  const found = app.xplaneDirFound;
  return (
    <ReadyItem state={found ? "ok" : "missing"} label="X-Plane">
      {found ? (
        <span className="ready-path" title="The X-Plane 12 folder pylons are installed into">
          {app.xplaneDir}
          {app.xplaneVersion ? ` · ${app.xplaneVersion}` : ""}
        </span>
      ) : app.xplaneDir ? (
        `not found at ${app.xplaneDir}`
      ) : (
        "no X-Plane 12 installation found"
      )}{" "}
      <button className="ready-link" title="Choose the X-Plane 12 folder you fly (the one that contains Custom Scenery)" onClick={() => void choose()}>
        {found ? "Change…" : "Choose folder…"}
      </button>
    </ReadyItem>
  );
}

function ReadyItem({ state, label, children }: { state: "ok" | "missing" | "todo"; label: string; children: ReactNode }) {
  return (
    <li className={`ready-item ${state}`}>
      <span className="ready-mark" aria-hidden>
        {state === "ok" ? "✓" : state === "todo" ? "›" : "!"}
      </span>
      <span className="ready-label">{label}</span>
      <span className="ready-text">{children}</span>
    </li>
  );
}

/** Which way to turn for the next gate: its center relative to the nose. */
function TurnCue({ fix, gate }: { fix: Fix; gate: Gate }) {
  const rel = relativeBearing(fix, fix.headingDeg, gate.center);
  const abs = Math.abs(Math.round(rel));
  const text = abs <= 10 ? "ahead" : abs >= 170 ? "behind you" : `${abs}° ${rel < 0 ? "left" : "right"}`;
  return (
    <span className={`turn-cue ${abs <= 10 ? "on-course" : ""}`} aria-label={`Next gate ${text}`}>
      <svg viewBox="-12 -12 24 24" className="turn-cue-arrow" aria-hidden>
        <path d="M0,-10 L7,6 L0,2 L-7,6 Z" transform={`rotate(${rel})`} />
      </svg>
      <span className="num">{text}</span>
    </span>
  );
}

function StatusLine({ race, telemetry }: { race: RaceSnapshot | null; telemetry: TelemetryStatus | null }) {
  const ended = race?.status === "finished" || race?.status === "dnf";
  const sim = telemetry && !telemetry.demo.running ? telemetry : null;
  const held = ended ? null : sim?.rpos.shared ? "X-Plane's position is taken by another program" : sim?.active && sim.replay ? REPLAY : null;
  const text =
    race?.status === "finished"
      ? "Finished"
      : race?.status === "dnf"
        ? "Did not finish"
        : held
          ? held
          : !telemetry?.active
            ? "Waiting for X-Plane…"
            : race?.status === "running"
              ? "Racing"
              : "Armed — fly through the start gate";
  return (
    <div className={`status-line status-${held ? "held" : (race?.status ?? "none")} ${telemetry?.active ? "live" : ""}`}>
      <span className="status-dot" aria-hidden />
      {text}
    </div>
  );
}

function GateStrip({ race }: { race: RaceSnapshot | null }) {
  if (!race) return null;
  const missed = new Set(race.penalties.filter((p) => GATE_LOST.has(p.kind)).map((p) => p.step));
  const penalized = new Set(race.penalties.filter((p) => !GATE_LOST.has(p.kind)).map((p) => p.step));
  return (
    <div className="gate-strip" aria-label="Gates">
      {race.sequence.map((gi, step) => {
        const state = missed.has(step)
          ? "missed"
          : penalized.has(step) && step < race.step
            ? "penalized"
            : step < race.step
            ? "done"
            : step === race.step && (race.status === "running" || race.status === "waiting")
              ? "next"
              : "todo";
        return <span key={step} className={`gate-cell ${state}`} title={`Gate ${gi + 1}`} />;
      })}
    </div>
  );
}

function Result({ race, target, course, demo }: { race: RaceSnapshot; target: Run | null; course: Course; demo: boolean }) {
  const newBest = !demo && race.status === "finished" && (!target || race.total < target.result.total);
  const why = race.status === "dnf" ? dnfText(race) : null;
  return (
    <div className={`result ${race.status === "dnf" ? "dnf" : newBest ? "new-best" : ""}`}>
      {race.status === "dnf" ? (
        <div className="result-title bad">Did not finish{why ? ` · ${why}` : ""}</div>
      ) : demo ? (
        <div className="result-title">
          Demo flight <span className="muted">· not ranked</span>
          {target && <span className="num"> {fmtDelta(race.total - target.result.total)}</span>}
        </div>
      ) : newBest ? (
        <div className="result-title best">New best!</div>
      ) : (
        <div className="result-title">
          Finished <span className="bad num">{fmtDelta(race.total - target!.result.total)}</span>
        </div>
      )}
      <div className="result-rows num">
        <span className="muted">Flight time</span>
        <span>{fmtTime(race.raw)}</span>
        {race.penalties.map((p, i) => (
          <PenaltyRow key={i} penalty={p} course={course} />
        ))}
        {race.penalties.length === 0 && race.status === "finished" && (
          <>
            <span className="good">Clean run</span>
            <span className="good">+0.0 s</span>
          </>
        )}
        <span className="result-total-label">Total</span>
        <span className="result-total display">{fmtTime(race.total)}</span>
      </div>
      {race.laps > 1 && (
        <div className="muted num laps">
          {race.lapTimes.map((t, i) => `Lap ${i + 1} ${fmtTime(t)}`).join("   ")}
        </div>
      )}
      {race.passes.length > 2 && <Splits race={race} target={target} />}
    </div>
  );
}

/** The time between gates, against the same stretch of your best: where time was won or lost. */
function Splits({ race, target }: { race: RaceSnapshot; target: Run | null }) {
  const rows = splits(race.passes, race.penalties, target).slice(1);
  const deltas = rows.map((r) => r.sectorDelta).filter((d): d is number => d !== null);
  const worst = deltas.length > 1 ? Math.max(...deltas) : null;
  const bestGain = deltas.length > 1 ? Math.min(...deltas) : null;
  return (
    <details className="splits" open={rows.length <= 12}>
      <summary className="label">Splits{target ? " · against your best" : ""}</summary>
      <table className="num">
        <thead>
          <tr>
            <th>Gate</th>
            <th>At</th>
            <th>Sector</th>
            {target && <th>± best</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.step} className={r.sectorDelta !== null && r.sectorDelta === worst && worst > 0 ? "worst" : undefined}>
              <td>
                {r.gateIndex + 1}
                {race.laps > 1 ? <span className="muted"> · lap {r.lap}</span> : null}
              </td>
              <td>{fmtTime(r.elapsed)}</td>
              <td>
                {r.sector.toFixed(2)}
                {r.penalties > 0 && <span className="bad"> (+{r.penalties.toFixed(0)})</span>}
              </td>
              {target && (
                <td className={r.sectorDelta === null ? "muted" : r.sectorDelta < 0 ? (r.sectorDelta === bestGain ? "best" : "good") : "bad"}>
                  {r.sectorDelta === null ? "—" : fmtDelta(r.sectorDelta)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** The penalties so far, newest first, while racing. */
function PenaltyList({ penalties, course }: { penalties: Penalty[]; course: Course }) {
  return (
    <div className="result-rows num live-penalties">
      {[...penalties].reverse().map((p, i) => (
        <PenaltyRow key={penalties.length - i} penalty={p} course={course} />
      ))}
    </div>
  );
}

function PenaltyRow({ penalty: p, course }: { penalty: Penalty; course: Course }) {
  return (
    <>
      <span className="bad">
        Gate {p.gateIndex + 1} · {penaltyReason(p, course)}
      </span>
      <span className="bad">+{p.seconds.toFixed(1)} s</span>
    </>
  );
}

function FlightValues({ live, course }: { live: LiveState | null; course: Course }) {
  const fix = live?.fix ?? null;
  const groundAt = live?.nextGate ? course.gates[live.nextGate.index]?.groundElevM ?? null : null;
  const agl = fix ? (fix.aglM ?? (groundAt !== null ? fix.altMslM - groundAt : null)) : null;
  return (
    <div className="flight-values">
      <Value label="Speed" value={fix ? Math.round(fix.gsMs * KMH_PER_MS) : null} unit="km/h" />
      <Value label="Height" value={agl !== null ? Math.round(agl) : null} unit="m AGL" />
      <Value label="Altitude" value={fix ? Math.round(fix.altMslM) : null} unit="m MSL" />
      <Value label="Bank" value={fix ? Math.round(fix.rollDeg) : null} unit="°" />
    </div>
  );
}

function Value({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="value">
      <div className="label">{label}</div>
      <div className="display value-n">
        {value ?? "—"}
        <span className="muted value-u"> {unit}</span>
      </div>
    </div>
  );
}

/** The course's ranking in one aircraft class (a row per pilot of this computer), then the active
 *  pilot's own runs in that class. Shows the class flown now unless the pilot picks another. */
function Rankings() {
  const runs = useStore((s) => s.runs);
  const pilot = useStore((s) => s.app?.pilot ?? "");
  const flying = useStore((s) => s.flyingClass);
  const pick = useStore((s) => s.rankPick);
  const pickClass = useStore((s) => s.pickRankClass);
  if (runs.length === 0) return <section className="panel runs muted">No runs on this course yet.</section>;

  const now = currentClass(runs, pilot, flying);
  const shown = pick ? pick.cls : now;
  const classes = classesOf(runs);
  if (!classes.includes(now)) classes.push(now);
  const board = leaderboard(runs, shown);
  const mine = pilotRuns(runs, pilot, shown);
  return (
    <section className="panel runs">
      <div className="runs-head">
        <span className="label">Ranking</span>
        <div className="class-tabs" role="group" aria-label="Aircraft class">
          {classes.map((c) => (
            <button
              key={c ?? "none"}
              className={`class-tab ${c === shown ? "on" : ""}`}
              aria-pressed={c === shown}
              title={c === now ? "The class you are flying" : undefined}
              onClick={() => pickClass(c === now ? undefined : c)}
            >
              {classLabel(c)}
              {c === now && flying !== undefined ? " ✈" : ""}
            </button>
          ))}
        </div>
      </div>
      {board.length === 0 ? (
        <div className="muted runs-empty">No finished runs in {classLabel(shown)} yet.</div>
      ) : (
        <table className="num">
          <thead>
            <tr>
              <th>#</th>
              <th>Pilot</th>
              <th>Total</th>
              <th>Penalties</th>
              <th>Aircraft</th>
              <th>Source</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {board.map((r, i) => (
              <tr key={r.id} className={r.pilot === pilot ? "me" : undefined}>
                <td className={`rank display rank-${i + 1}`}>{i + 1}</td>
                <td className="pilot-cell">{r.pilot}</td>
                <td className="display time-cell">{fmtTime(r.total)}</td>
                <td>{penaltyCell(r)}</td>
                <td>{r.aircraftId ?? "—"}</td>
                <td>{sourceCell(r)}</td>
                <td>{new Date(r.startedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="label runs-sub">Your runs · {pilot}</div>
      {mine.length === 0 ? (
        <div className="muted runs-empty">You have no runs in {classLabel(shown)} yet.</div>
      ) : (
        <table className="num">
          <thead>
            <tr>
              <th>#</th>
              <th>Total</th>
              <th>Penalties</th>
              <th>Aircraft</th>
              <th>Source</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {mine.slice(0, 20).map((r, i) => (
              <tr
                key={r.id}
                className={r.status === "dnf" || isDemo(r) ? "muted" : undefined}
                title={isDemo(r) ? "A demo flight: it never counts for the ranking or your best" : undefined}
              >
                <td>{isDemo(r) ? "Demo" : r.status === "dnf" ? "DNF" : i + 1}</td>
                <td>
                  {fmtTime(r.total)}
                  {r.status === "dnf" && dnfShort(r.dnfReason) ? ` · ${dnfShort(r.dnfReason)}` : ""}
                </td>
                <td>{penaltyCell(r)}</td>
                <td>{r.aircraftId ?? "—"}</td>
                <td>{sourceCell(r)}</td>
                <td>{new Date(r.startedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function penaltyCell(r: RunSummary): string {
  return r.penaltyTotal > 0 ? `+${r.penaltyTotal.toFixed(1)}` : "—";
}

function sourceCell(r: RunSummary): string {
  return `${r.source}${r.sourceHz ? ` ${Math.round(r.sourceHz)} Hz` : ""}`;
}
