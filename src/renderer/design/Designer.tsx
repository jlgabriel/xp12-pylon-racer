// The course designer: the map on the left, the course and its gates on the right. Edits go to the
// store's draft through the pure functions in core/course/edit; nothing is written until Save.
import { useEffect } from "react";
import type { Gate, GateType, Rules } from "../../core/course/course";
import {
  MIDDLE_KINDS,
  addGate,
  draftProblem,
  insertGateAfter,
  moveGate,
  moveGateInOrder,
  removeGate,
  setKind,
  setLaps,
  suggestedHeading,
  updateGate,
  type Draft,
} from "../../core/course/edit";
import { DEFAULT_PYLON, PYLONS, PYLON_SCALE, PYLON_SIZES, pylonLabel, type PylonSize } from "../../core/export/pylons";
import { lapLength } from "../../core/run/summaries";
import { fmtDistance } from "../app/format";
import { useStore } from "../state/store";
import { DesignMap } from "./DesignMap";

const KIND_LABEL: Record<GateType, string> = {
  start: "Start",
  finish: "Finish",
  gate: "Gate",
  level: "Level gate",
  knife: "Knife-edge gate",
  inverted: "Inverted gate",
  turn: "Turn pylon",
};

const SIZE_NAME: Record<PylonSize, string> = { standard: "Standard", tall: "Tall, ×2" };

/** "Tall, ×2 (30–50 m)": the size and the heights it gives the models. */
function sizeLabel(size: PylonSize): string {
  const heights = PYLONS.map((p) => p.heightM * PYLON_SCALE[size]);
  return `${SIZE_NAME[size]} (${Math.round(Math.min(...heights))}–${Math.round(Math.max(...heights))} m)`;
}

export function Designer() {
  const draft = useStore((s) => s.draft);
  const dirty = useStore((s) => s.draftDirty);
  const saving = useStore((s) => s.saving);
  const selectedGateId = useStore((s) => s.selectedGateId);
  const runs = useStore((s) => s.runs);
  const editDraft = useStore((s) => s.editDraft);
  const selectGate = useStore((s) => s.selectGate);
  const focusGate = useStore((s) => s.focusGate);
  const focusRequest = useStore((s) => s.focusRequest);
  const save = useStore((s) => s.saveDraft);
  const close = useStore((s) => s.closeDesigner);

  // Delete removes the selected gate, unless the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const id = useStore.getState().selectedGateId;
      if ((e.key === "Delete" || e.key === "Backspace") && id) {
        useStore.getState().editDraft((d) => removeGate(d, id));
        useStore.getState().selectGate(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!draft) return null;
  const problem = draftProblem(draft);
  const isNew = draft.id === "";

  return (
    <main className="designer">
      <header className="designer-head">
        <input
          className="designer-name"
          value={draft.name}
          maxLength={80}
          onChange={(e) => editDraft((d) => ({ ...d, name: e.target.value }))}
          aria-label="Course name"
        />
        <div className="designer-actions">
          <span className={`designer-status ${problem ? "bad" : "muted"}`}>
            {problem ?? (dirty ? "Unsaved changes" : "Saved")}
          </span>
          <button onClick={close}>{dirty ? "Cancel" : "Close"}</button>
          <button className="primary" disabled={!!problem || saving || (!dirty && !isNew)} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="designer-body">
        <DesignMap
          draft={draft}
          selectedGateId={selectedGateId}
          focusRequest={focusRequest}
          onAdd={(at) => {
            editDraft((d) => addGate(d, at));
            const gates = useStore.getState().draft?.gates;
            selectGate(gates?.[gates.length - 1]?.id ?? null);
          }}
          onSelect={selectGate}
          onMove={(id, to) => editDraft((d) => moveGate(d, id, to))}
          onHeading={(id, headingDeg) => editDraft((d) => updateGate(d, id, { headingDeg }))}
          onWidth={(id, widthM) => editDraft((d) => updateGate(d, id, { widthM }))}
        />

        <aside className="designer-side">
          <section className="panel">
            <div className="label">Course</div>
            <label className="field">
              <span>Laps</span>
              <input
                type="number"
                min={1}
                max={50}
                value={draft.laps}
                onChange={(e) => editDraft((d) => setLaps(d, Number(e.target.value) || 1))}
              />
            </label>
            <label className="field">
              <span>Pylons</span>
              <select
                value={draft.rules.pylonSize}
                onChange={(e) => editDraft((d) => ({ ...d, rules: { ...d.rules, pylonSize: e.target.value as PylonSize } }))}
              >
                {PYLON_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {sizeLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            {draft.rules.pylonSize !== "standard" && (
              <div className="muted designer-note">
                Every pylon twice as tall and as wide, easier to spot from afar. A hit is judged as far from its side as before.
              </div>
            )}
            <label className="field">
              <span>Missed gate</span>
              <span className="field-inline">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.rules.missedGatePenaltyS}
                  disabled={draft.rules.missedGateIsDnf}
                  onChange={(e) =>
                    editDraft((d) => ({ ...d, rules: { ...d.rules, missedGatePenaltyS: Math.max(0, Number(e.target.value) || 0) } }))
                  }
                />
                <span className="muted">s</span>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.rules.missedGateIsDnf}
                    onChange={(e) => editDraft((d) => ({ ...d, rules: { ...d.rules, missedGateIsDnf: e.target.checked } }))}
                  />
                  ends the run
                </label>
              </span>
            </label>
            <label className="field field-stacked">
              <span>Description</span>
              <textarea
                className="designer-desc"
                rows={7}
                maxLength={2000}
                placeholder="Where to take off, how to reach the start, what each gate asks for…"
                value={draft.description}
                onChange={(e) => editDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </label>
            {draft.gates.length >= 2 && (
              <div className="muted num designer-length">
                {draft.gates.length} gates · {fmtDistance(lapLength(draft) * draft.laps)}
                {draft.laps > 1 ? ` (${draft.laps} laps)` : ""}
              </div>
            )}
            {!isNew && runs.length > 0 && (
              <div className="muted designer-note">Changing gates or rules starts a new leaderboard for this course.</div>
            )}
          </section>

          <RulesPanel rules={draft.rules} edit={(patch) => editDraft((d) => ({ ...d, rules: { ...d.rules, ...patch } }))} />

          <section className="panel designer-gates">
            <div className="label">Gates · click the map to add one at the end, + to insert</div>
            {draft.gates.length === 0 && <div className="muted">No gates yet.</div>}
            <ol>
              {draft.gates.map((g, i) => (
                <GateRow
                  key={g.id}
                  gate={g}
                  index={i}
                  count={draft.gates.length}
                  suggested={suggestedHeading(draft, g.id)}
                  selected={g.id === selectedGateId}
                  canInsert={i < draft.gates.length - 1 || draft.laps > 1}
                  size={draft.rules.pylonSize}
                  onInsert={() => {
                    editDraft((d) => insertGateAfter(d, g.id) ?? d);
                    const added = useStore.getState().draft?.gates[i + 1];
                    if (added) focusGate(added.id);
                  }}
                  onSelect={() => focusGate(g.id)}
                  edit={(fn) => editDraft(fn)}
                />
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}

interface RowProps {
  gate: Gate;
  index: number;
  count: number;
  /** The heading halfway between the legs in and out (suggestedHeading). */
  suggested: number | null;
  selected: boolean;
  /** Whether a gate can go between this one and the next (not after the finish). */
  canInsert: boolean;
  /** The course's pylon size, for the heights the picker shows. */
  size: PylonSize;
  onInsert(): void;
  onSelect(): void;
  edit(fn: (d: Draft) => Draft): void;
}

function GateRow({ gate: g, index, count, suggested, selected, canInsert, size, onInsert, onSelect, edit }: RowProps) {
  const positional = g.type === "start" || g.type === "finish";
  const fallback = PYLONS.find((p) => p.id === DEFAULT_PYLON[g.type]);
  return (
    <li className={`gate-row ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="gate-row-head">
        <span className={`gate-dot type-${g.type}`} />
        <span className="gate-row-title">
          {index + 1} · {KIND_LABEL[g.type]}
        </span>
        <span className="gate-row-tools">
          <button
            disabled={!canInsert}
            onClick={(e) => {
              e.stopPropagation();
              onInsert();
            }}
            aria-label="Insert a gate after this one"
            title="Insert a gate halfway to the next one"
          >
            +
          </button>
          <button disabled={index === 0} onClick={() => edit((d) => moveGateInOrder(d, g.id, -1))} aria-label="Move earlier">
            ▲
          </button>
          <button disabled={index === count - 1} onClick={() => edit((d) => moveGateInOrder(d, g.id, 1))} aria-label="Move later">
            ▼
          </button>
          <button onClick={() => edit((d) => removeGate(d, g.id))} aria-label="Delete gate">
            ✕
          </button>
        </span>
      </div>
      {selected && (
        <div className="gate-row-body" onClick={(e) => e.stopPropagation()}>
          {!positional && (
            <label className="field">
              <span>Kind</span>
              <select value={g.type} onChange={(e) => edit((d) => setKind(d, g.id, e.target.value as GateType))}>
                {MIDDLE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {g.type === "turn" ? (
            <label className="field">
              <span>Keep pylon on</span>
              <select value={g.turnSide ?? "left"} onChange={(e) => edit((d) => updateGate(d, g.id, { turnSide: e.target.value as "left" | "right" }))}>
                <option value="left">your left</option>
                <option value="right">your right</option>
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Width</span>
              <span className="field-inline">
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={g.widthM}
                  onChange={(e) => edit((d) => updateGate(d, g.id, { widthM: Math.max(10, Number(e.target.value) || 10) }))}
                />
                <span className="muted">m</span>
              </span>
            </label>
          )}
          <label className="field">
            <span>Heading</span>
            <span className="field-inline">
              <input
                type="number"
                min={0}
                max={359}
                value={g.headingDeg}
                onChange={(e) => edit((d) => updateGate(d, g.id, { headingDeg: ((Math.round(Number(e.target.value) || 0) % 360) + 360) % 360 }))}
              />
              <span className="muted">°</span>
              {suggested !== null && (
                <button
                  disabled={suggested === g.headingDeg}
                  title={`Face halfway between the leg in and the leg out (${suggested}°), so neither turn is too tight`}
                  onClick={() => edit((d) => updateGate(d, g.id, { headingDeg: suggested }))}
                >
                  Align
                </button>
              )}
            </span>
          </label>
          <label className="field">
            <span>Min height</span>
            <span className="field-inline">
              <input
                type="number"
                min={1}
                step={5}
                placeholder="none"
                value={g.bottomM ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  edit((d) => updateGate(d, g.id, { bottomM: e.target.value === "" || !(v > 0) ? null : v }));
                }}
              />
              <span className="muted">m above ground</span>
            </span>
          </label>
          <label className="field">
            <span>Max height</span>
            <span className="field-inline">
              <input
                type="number"
                min={1}
                step={5}
                placeholder="none"
                value={g.topM ?? ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  edit((d) => updateGate(d, g.id, { topM: e.target.value === "" || !(v > 0) ? null : v }));
                }}
              />
              <span className="muted">m above ground</span>
            </span>
          </label>
          <label className="field">
            <span>Pylon</span>
            <select value={g.pylon ?? ""} onChange={(e) => edit((d) => updateGate(d, g.id, { pylon: e.target.value || null }))}>
              <option value="">Default ({fallback && pylonLabel(fallback, size)})</option>
              {PYLONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {pylonLabel(p, size)}
                </option>
              ))}
            </select>
          </label>
          <div className="muted num gate-row-elev">
            {g.groundElevM !== null ? `Terrain ${Math.round(g.groundElevM)} m (X-Plane's own may differ a little)` : "Terrain looked up on save"}
          </div>
        </div>
      )}
    </li>
  );
}

type NumericRule = { [K in keyof Rules]: Rules[K] extends number ? K : never }[keyof Rules];

const RULE_FIELDS: { key: NumericRule; label: string; unit: string; min?: number; max?: number }[] = [
  { key: "wrongDirectionPenaltyS", label: "Wrong direction", unit: "s" },
  { key: "attitudePenaltyS", label: "Wrong attitude", unit: "s" },
  { key: "levelToleranceDeg", label: "Level within", unit: "° of bank", max: 90 },
  { key: "knifeToleranceDeg", label: "Knife edge within", unit: "° of 90°", max: 90 },
  { key: "invertedToleranceDeg", label: "Inverted within", unit: "° of 180°", max: 90 },
  { key: "tooHighPenaltyS", label: "Too high", unit: "s" },
  { key: "tooLowPenaltyS", label: "Too low", unit: "s" },
  { key: "pylonHitPenaltyS", label: "Pylon hit", unit: "s" },
  { key: "pylonHitRadiusM", label: "Hit within", unit: "m of a pylon", min: 0.5 },
  // No "Pylon height": every generated model has its own (export/pylons.ts), shown in its name, and
  // the course's pylon size scales them all. The hit distance is for the standard size.
  { key: "turnCutPenaltyS", label: "Turn pylon cut", unit: "s" },
];

/** The course's penalties and tolerances (the missed gate lives with the course basics). */
function RulesPanel({ rules, edit }: { rules: Rules; edit(patch: Partial<Rules>): void }) {
  return (
    <details className="panel designer-rules">
      <summary className="label">Penalties and tolerances</summary>
      {RULE_FIELDS.map((f) => (
        <label key={f.key} className="field">
          <span>{f.label}</span>
          <span className="field-inline">
            <input
              type="number"
              min={f.min ?? 0}
              max={f.max}
              step={f.unit === "s" ? 1 : 0.5}
              value={rules[f.key]}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                edit({ [f.key]: Math.min(f.max ?? Infinity, Math.max(f.min ?? 0, v)) });
              }}
            />
            <span className="muted">{f.unit}</span>
          </span>
        </label>
      ))}
    </details>
  );
}
