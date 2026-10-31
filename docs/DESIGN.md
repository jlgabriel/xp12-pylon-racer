# XP Pylon Racer — Design document

> Version 1.6.0 · 2026-10-30 · Shirley calls every gate as you reach it.
> Sister of [Pylon Racer](https://github.com/jlgabriel/afs4-pylon-racer) (Aerofly FS4, 1.0.1) and
> heir to the discipline of [XOP](https://github.com/jlgabriel/xp12-object-placer).
> What comes from each, and what is rejected on purpose: [LINEAGE.md](LINEAGE.md).

---

## 0. Status (2026-10-30, v1.6.0: Shirley calls every gate)

**Unreleased (2026-10-31).** Turn pylons get invisible gates for Shirley along their pass line (below
in *After 1.5*), **flown the same day** at Daggett Air Show: every gate and both pylons called once,
on time. Multi-lap phases still not flown. The docs were translated to English: everything on
GitHub is in English (Juan, 2026-10-31). The minimap's blue trail showed only the last minute of a
3-minute run: kept by count (2,400 fixes, inherited from Pylon Racer), RPOS's ~30 Hz filled it in
80 s. It now keeps a point every 10 m (`TRAIL_STEP_M`), up to 30 km.

**1.6.0, 2026-10-30.** 1.5 plus Export to Shirley with one trigger per gate, which calls the gate
as you reach it, and one race phase per lap: below in *After 1.5*. Not flown; the trigger format was
read on Airplane-Team's test server the day it went to production. Tag `v1.6.0`, same workflow; the
plugin does not change except for the version number.

**1.5.0, 2026-10-27.** 1.4 plus ten courses from Juan (44 in total), below in *After 1.4*. They
were not flown; the notes say so. Tag `v1.5.0`, same workflow, published 2026-10-27 with the six
files; the plugin does not change except for the version number.

**1.4.0, 2026-10-27.** 1.3.1 plus the H3 probe's plugin turned into the release plugin:
`xp12-pylon-racer-plugin-<version>.zip`, a separate file with Windows, macOS and Linux. Below in
*After H3*. Flown the same day on 12.4.3 with the app (Daggett Sprint, 27.54 s); one fix from that
flight (the window that was not born hidden) was left unflown. Tag `v1.4.0`, published 2026-10-27
with the six files.

**1.3.1, 2026-10-26.** 1.3 plus the X-Plane folder in plain view, with **Change…** to pick another
one: below in *After 1.3*. It comes from the first user report.

**1.3.0, 2026-10-26.** 1.2 plus Juan's sixteen courses (34 in total), below in *After 1.2*. They
were not flown either; the notes say so. Tag `v1.3.0`, same workflow.

**1.2.0, 2026-10-26.** 1.1 plus nine included courses (18 in total), below in *After 1.1*, and the
engine fix that Uyuni brought. Juan asked for it without being able to fly them first: it is the
first release with courses nobody flew, and the notes say so. Tag `v1.2.0`, same workflow.

**1.1.0, 2026-10-25.** 1.0 plus the *Queenstown Lake Race* as the ninth included course and
**Export to Shirley…** (below, both flown the same day). Tag `v1.1.0`, same workflow.

**1.0.0, published 2026-10-25.** Tag `v1.0.0`; the `release.yml` workflow built the five installers
(Windows setup and portable, macOS x64 and arm64, AppImage) and the release
[XP Pylon Racer 1.0.0](https://github.com/jlgabriel/xp12-pylon-racer/releases/tag/v1.0.0) was
published at Juan's request.

1.0 is 0.2 plus the tall pylons (D15), with no behavior changes since the last flight. Juan
confirmed the name (D2) and that this app also registers `.pylonrace` (D14), and the README became
the 1.0 guide: installing an unsigned build on each system, pylon size, RPOS at ~30 Hz and how to
share a Tall course with Pylon Racer. Typecheck, 287 unit tests (284 without DSFTool: 3 are the
read-back), 3 e2e and the Windows builds green; the packaged app opens as "XP Pylon Racer 1.0.0".

What follows is how we got here.

### Up to 0.2

The whole app is ported: designer, live race, ranking by class, `.pylonrace` sharing, demo and pack
installation. Typecheck, 271 unit tests (with the DSFTool read-back) and 3 e2e on Electron green.

**The same day Juan flew the probes and a real race.** Everything that was an assumption was
confirmed without changing a line of the app (detail in each `probes/H*/FLIGHT.md`):

| Assumption | Where it lives | Result |
|---|---|---|
| RPOS with the fields and signs from Laminar's document | `src/core/telemetry/rpos.ts` | ✅ compass heading, vz south, roll + = right, pitch + = up. **~29.5 Hz**, not 40 (H0) |
| The Web API gives `acf_ICAO` | `src/core/telemetry/webapi.ts`, `src/main/telemetry.ts` | ✅ REST on `/api/v3`; the Vertigo says `Extra` → Aerobatic (H0) |
| X-Plane loads pack-relative `OBJECT_DEF`, with a PNG texture | `src/core/export/pack.ts` | ✅ no errors in `Log.txt` (H1) |
| The pylons sit on the ground, with their paint | `src/core/pylon/` | ✅ screenshots and replay (H1) |
| RPOS's position and the pylons' position coincide to the meter | — | ✅ three gates, side and measure match the replay (H2) |
| What X-Plane sends in the menu and when paused | `isNullIsland`, the engine (`STILL_S`) | menu: nothing; paused: position frozen at 30 Hz (H0) |

**First race:** Daggett Sprint, installed by the app, at KDAG with the Extra. **29.13 s, clean**:
all five passes within 6 m of the center, at 10 to 20 m height, and a saved race with
`source: rpos 30 Hz` and the Aerobatic class.

**What the flight left, resolved in 0.2** (typecheck, 280 tests and 3 e2e green; flown the same day, below):

1. **Shared RPOS.** RPOS has a single subscriber: X-Plane sends it only to the last one that asked.
   `src/core/telemetry/rposShare.ts` (pure, `tests/rposShare.test.ts`) recognizes the fight by its
   signature: the flow cuts out and comes back **right after our request** (X-Plane was serving, but
   to someone else). Two of those "takes" in 40 s = another program asks for RPOS. A hiccup or a
   scenery load comes back on its own, the menu does not answer and a restarted sim answers once:
   none of them count. While it lasts, the app **spaces out its requests** (2 → 4 → 8 → 10 s), so
   the other program works almost always (simulated: it gets 80 % of the flow instead of half) and
   the app asks again now and then to recover RPOS when the other one closes (~15 s in the
   simulation). 10 s of flow without cuts clear it. The UI says so in the pill (*X-Plane RPOS
   taken*), in "Flight data" and in the status line.
2. **Replay.** The hub reads `sim/time/is_in_replay` through the REST Web API every 250 ms (the
   aircraft, every 5 s) and passes no fixes to the engine while it is 1. The UI says *Replay: not
   racing*. Without the Web API, everything passes as in 0.1. If a replay fix slips in before it is
   seen, the engine already treats the jump as a DNF "reset".
3. The Web API WebSocket only opens on `/api/v1` in 12.4.3. The app does not use it; the recorder
   already knows.

**Measured on 2026-10-24 with X-Plane 12.4.3 open, for 0.2** (not flown: the sim was in replay):

| Question | Answer |
|---|---|
| Which dataref says "replay"? | `sim/time/is_in_replay`: int, **read-only**, it was 1 in replay. `sim/operation/prefs/replay_mode` also exists, but it is writable and an enum (it was 7): it does not work as a boolean. Web API ids ~1.6e12 (they fit in a double). |
| RPOS with two sockets | The second one to ask keeps it all (75 packets in 2 s against 0). |
| A `RPOS 0` from someone who is not the owner? | **It cuts the owner's flow.** That is why the app (and the H0 recorder) only ask for 0 on closing if the flow is reaching them. |
| Does RREF allow several subscribers? | **Yes**: two sockets asking for `sim/flightmodel/position/latitude` at 20 Hz get ~19 Hz each, and one's 0 does not cut the other. |

**Flown on 2026-10-24** (X-Plane 12.4.3, KDAG, Vertigo's Extra, 0.2 running with `npm run dev`;
app log and H0 run `runs/2026-10-25T02-32-07`, local):

| Test | Result |
|---|---|
| Normal race | Daggett Sprint, **29.02 s** clean (0.1: 29.13 s). |
| Another program asking for RPOS (`npm run probe:listen`) | *RPOS taken* **7 s** after the recorder started. |
| Backoff | It works, but yields less than in the simulation: the recorder had RPOS **6.4 s out of every ~10 (63 %)**, not 80 %, because it takes ~4 s to ask for it again (it checks every 2 s whether it has been silent for 2 s). The maximum stays at 10 s (Juan): raising it to 20 s would give ~80 % but up to ~30 s to recover RPOS. |
| On closing the recorder | The app recovers RPOS in ~2 s and clears the warning at ~12 s. |
| Replay | Detected on entry; the replay went through the gates and **no race was saved**; the screen shows *Replay: not racing* and the flight values as "—". |
| On leaving replay | "X-Plane is flying again": the app goes back to following the flight and gets armed again. |
| Web API ids | They change on every X-Plane session (1626080912064 → 3170083268528 for `is_in_replay`): good that the hub looks them up by name. |

### After 0.2: tall pylons, flown 2026-10-25

Juan: the current size is fine, but
they are hard to see in a sim. Each course now picks its pylon size in the designer (*Pylons*:
Standard or Tall ×2), all at once; decision D15. Typecheck, 287 tests and 3 e2e green (the
designer's e2e switches to Tall, reinstalls and checks that the pack carries the 30 m
`pylon_*_tall.obj`).

| Test (KDAG, Vertigo's Extra, `npm run dev`) | Result |
|---|---|
| Reinstall the Daggett Sprint as Tall | The pack carries only `pylon_{blue,green,home,red}_tall`: 30 m × 2.4 m radius and 50 m × 4 m for the finish; the DSF points only to them. No errors in `Log.txt`. |
| See them in the sim | "Very good size" (Juan). |
| Ranking | New revision (`3959655537af3ac1`): the race opened its own ranking, apart from the 29.02 s at Standard. |
| Pylon touched | 41.93 s: 35.93 of flight and two touches. Gate 3 at 4.3 m from the center and gate 4 at **5.73 m**, which is only a touch with Tall's radius (6.2 m; at Standard it would be 5 m). Both were at 12–15 m height, also under a Standard pylon, so the new height (30 m) was not separated from the old one in this flight. |

### After 1.0: the first course over water, flown 2026-10-25

The *Queenstown Lake Race* (9 gates, Tall, over Lake Wakatipu near NZQN) was designed by ChatGPT
and Juan imported it from Downloads with the 1.0.0 portable. Before flying it Juan moved turn g5
~335 m to the southwest: in the original position it was ~400 m from the east shore, with the slope
at +30–60 m above the lake (Open-Meteo elevations), and passing by the east with a radius of ~400 m
could take the aircraft over it.

| Test (Vertigo's Extra, the 1.0.0 portable) | Result |
|---|---|
| Pack over water | The `-46+168` DSF loads without errors in `Log.txt` (0 tris: objects only). |
| See them over the lake | Resting on the surface, neither sunk nor floating, with their reflection in the water: replay screenshot at the finish, the two 50 m Tall `home` pylons. |

It became the ninth included course (`sampleCourses.ts`, only in this app), just as Juan flew it:
same revision (`4e1a66db22f68f91`), so the race above stays in its ranking. It keeps the id
`queenstown-lake-race-01` from the shared file, and the copy Juan imported takes the new text when
the app opens (its stamp goes in `SAMPLE_EARLIER_STAMPS`).
| Height above ground at the lake | RPOS's AGL is measured **from the water surface**: `altMslM − aglM` = 311.0 m on all nine passes (the lake, 310 m). Height windows work over water. |
| Race | **2:44.71**: 2:42.71 of flight and +2 s at g3 for passing at 52 m (the floor is 55 m). g5 rounded at 45 m from the pylon, with 56° of bank at 239 km/h; g6 at 156 m (window 70–160). |

### After 1.0: Export to Shirley (not flown yet)

Juan is subscribed to [FlyShirley](https://airplane.team), the AI copilot, which accepts
*challenges* in JSON with phases, instructions and state. **Export to Shirley…** (next to
*Share…*) turns the course into one so that Shirley narrates the race; Alex, the author, was told
about it on FlyShirley's Discord. `src/core/export/shirley.ts` (pure, `tests/shirley.test.ts`)
follows the published `ChallengeSchema` (repo `Airplane-Team/sample-challenges` and the *Challenge
Specification* tab of airplane.team/capabilities/specifications, read 2026-10-25); the test carries
a strict mirror of the schema, trimmed to the fields that are written.

- Three phases: `Brief` (course introduction on the way to the start, max silence 60 s) → `Race`
  (live narration: max silence `RACE_QUIET_S` = 6 s, `challengeTimer`, `recordFlightData`) →
  `Debrief` (verdict, `analyzeFlightData`, another run goes back to `Brief`). After 1.5 they carry
  per-gate triggers and one race phase per lap: *After 1.5*.
- The gates of a lap go as `navigateToStateWaypoints`, with what each one asks in its `context`;
  true headings (`magneticHeadingDeg` is not filled), heights in m and ft.
- **The app judges, Shirley narrates.** Shirley does not see the app's clock or penalties: the
  prompt forbids announcing them as facts and asks the pilot for the official result in the debrief.
- The tools that move the aircraft or the sim are turned off (`setPosition`, `resetFlight`,
  `setSimulatorSetpoints`, `setDestinationRunway`): a repositioning mid-race is a DNF.
- The records of the current revision (leader per class and the pilot's best) go into the prompt.
- A `.json` is saved and copied to the clipboard: the Challenge Creator (airplane.team/fly/create)
  accepts the challenge pasted in.

The challenge passes Shirley's current schema on all nine courses (today 34: the test walks through
all of them) (transcribed from the web, no dropped keys) and the Challenge Creator accepted it
without warnings.

**Flown on 2026-10-25** (Daggett Sprint Tall, Cessna 172SP, the 1.0.0 portable measuring; flight
shared at airplane.team/share/2mMcEFrN):

| Test | Result |
|---|---|
| Brief | It presented the course well, with the 41.93 s record and that the Skyhawk races in another class. It even saw the parking brake on. |
| Transitions | `Brief` → `Race` and `Race` → `Debrief` on their own, without the *Transition Phase* button. |
| Live narration | It is enough: it called every gate. On its own it set *wake-up triggers* at each gate's longitude (the course runs east to west). |
| Connection | Shirley uses the Web API WebSocket, not RPOS: the app did not show *RPOS taken*. |
| Debrief | It asked for the official time. |
| App | **1:00.79**, clean, zero penalties; the five passes between 15 and 20 m AGL. |

Two Shirley mistakes, fixed in the prompt:
1. It said "way over the tops" and that those gates would not count: the passes were at 15–20 m,
   under the 30 m of the Tall pylons, and without a height limit the gate counts at any height. It
   came from the "below its top" of the touch rule and from giving heights in meters when she reads
   feet (60 ft against "30 m"). Now heights go in feet first, and a line says that without a height
   limit every gate counts, also above the pylons.
2. It wrote 1:00.079 when Juan read "01:00.79". Now the prompt explains the app's
   minutes:seconds.hundredths format.

It was flown again with the corrected prompt on 2026-10-27: below in *After 1.5*.

### After 1.1: four courses from the catalog (not flown yet)

Juan brought a catalog of 23 proposed courses (`Catalogo_Circuitos_XP_Pylon_Racer.md`, ideas only:
place, airfield, length, gates and difficulty, no coordinates). The first four on his priority list
after Queenstown were made, all Tall:

| Course | Airfield | Length | What it asks |
|---|---|---|---|
| Pucón Volcano Race | SCPC | 14.9 km | Lake Villarrica; 3 level, 6 left turn pylon, 9 knife-edge |
| Uyuni Salt Flats Speed Challenge | SLUY | 3 × 6.4 km | oval on the salt flat at 3,654 m, pylons on the right, start below 60 m |
| Monument Valley Challenge | UT25 (`XKUT25` in X-Plane's apt.dat) | 16.4 km | the valley floor east of the Mittens; 4 level, two left turns |
| Rapa Nui Coastal Race | SCIP | 15.5 km | sea south of the island, turn off Rano Kau; 3 and 6 level |

**How they were traced.** On AWS's Terrarium DEM (z13 tiles, ~25 m; Open-Meteo limits to ~600 points
per minute, which is not enough to map): an ASCII map of each area, the gates by hand and a check
that computes the headings by bisector, verifies that the center and the two pylons fall on water
(±2 m of lake or sea level) or on flat ground, and walks the path every 100 m and at 250–400 m on
each side: nothing rises more than 30 m above the route. The `groundElevM` values come from
Open-Meteo, as with the others. All four airfields are in the 12.4.3 apt.dat.

**Discarded: Milford Sound.** In the fjord the DEM does not make clear where the water ends (cuts
50 m wide where the map shows 1 km), so it cannot be guaranteed that the pylons land on the water
and not on the cliff. The catalog itself leaves it for after testing complex meshes.

**Engine fix that Uyuni brought.** At 5 Hz the demo puts a fix exactly on the start line: the
segment that ends there and the one that starts there both crossed it, and the second one closed lap
1 in 0 s with the four gates missed. Now a crossing at the start of a segment does not count if the
previous segment already crossed that same line at that same point (`crossedAtEnd` in
`src/core/race/engine.ts`). Discarding every crossing at the start of a segment broke other
courses: with rounding, sometimes the previous one does not see it. In real flight it is almost
impossible, but it costs nothing.

Still to fly: that the pylons show up over the water and the salt flat, Pucón's turn (90°, at 1.8 km
from the nearest west shore), the climb out of SLUY and whether Monument Valley's 16 km feel long.

**Five more the same day**, at Juan's request, with the same method. Four from the catalog and one
of our own:

| Course | Airfield | Length | What it asks |
|---|---|---|---|
| Puerto Varas Lake Oval | SCTE (21 km) | 2 × 7 km | Lake Llanquihue, counterclockwise, pylons on the left: the easiest |
| General Carrera Lake Race | SCCC | 15.3 km | 3 and 8 level, 6 left turn |
| Heimaey Volcano Island Race | BIVM | 17.2 km | sea east and south of the island, between it and Bjarnarey, lap on the outside; 3 and 7 level |
| Kauai Coast Challenge | PHLI | 15.7 km | east coast of Kauaʻi to Hoary Head, two left turns; 2 and 7 level |
| Lake Tahoe Emerald Run (our own) | KTVL | 15.3 km | at 1,897 m, toward Emerald Bay without entering; 2 level, 7 knife-edge |

At sea the Terrarium DEM carries the depth (Heimaey: −20 to −110 m; Kauaʻi: down to −700 m), so
"over water" there is below 2 m; Open-Meteo gives 0. At Heimaey the first lap around the whole
island came to 24.5 km and passed within 400 m of the western islets: it stayed on the east side.

**Discarded: Lake Bled and Venice.** Bled is small (2 × 1.2 km) and between the island and the
south shore there are ~250 m: not enough for Tall pylons at this app's speed. In the Venice lagoon
the DEM gives the same elevation (0–3 m) to the water, the sandbars and the islands: there is no
telling where a pylon lands.

### After 1.2: sixteen courses from Juan (not flown yet)

Juan prepared them with ChatGPT and brought them as `.pylonrace` to review and include (34 in
total). Twelve over land, Tall, and four training versions of real air race courses, Standard:

| Course | Airfield | Length | What it asks |
|---|---|---|---|
| Osorno Spiral Ascent | SCTE (57 km) | 24.2 km | two-lap spiral around the volcano, 950 → 2,660 m; 33 pylons on the left, at 500 m, ≥ 80 m AGL |
| Quebrada de las Conchas Run | SA02 (26 km) | 13.9 km | the canyon upriver; eight turn pylons at the bends |
| San Rafael Desert Run | KHVE (18 km) | 16.0 km | clockwise; 4, 7, 8 on the right; 3 and 10 level |
| Swaledale Valley Sprint | EGXE (29 km) | 12.9 km | valley upstream to the west; 3 and 10 level, 7 between 40 and 90 m |
| Auvergne Volcano Circuit | LFLC (22 km) | 12.4 km | clockwise among the puys; 4 and 9 on the right; 3 and 8 level |
| Bardenas Badlands Race | XLE001L Ablitas (22 km) | 11.9 km | counterclockwise; 2 knife-edge, 5 and 9 on the left, 8 level |
| Gorafe Ravine Run | LEGR (73 km: nothing closer) | 15.1 km | drops 350 m through the ramblas; seven turn pylons, 6 level |
| Cappadocia Ridge Challenge | LTAZ (27 km) | 13.7 km | 3 and 10 level; from 5 to 6 the ground rises 228 m in 1.4 km |
| Flinders Valley Run | YRYK (2 km) | 14.8 km | out and back through the valley, 136° turn at 7; 3 and 10 level |
| Lindis Pass Traverse | NZWF (30 km) | 13.1 km | climbs 375 m to the pass and descends; five turn pylons, 13 level |
| Namib Dune Run | FYSS (1.5 km) | 15.2 km | beside the Elim dune; 7 on the right, 5 and 9 level |
| Orkhon Steppe Circuit | ZMHH (2 km) | 2 × 8.1 km | flat steppe at 1,440 m, counterclockwise; 4 and 8 level |
| Abu Dhabi 2014 — Training | OMAD (14 km) | 2.3 km | over the sea, 15–25 m at each gate; slalom, three level |
| Chiba 2019 — Training | RJTT (25 km) | 1.6 km | same, off Makuhari; approximate positions |
| Porto 2017 — Training | LPPR (12 km) | 1.75 km | over the Douro, upriver; the Luís I bridge 250 m after the finish |
| Reno Sport 2023 — Training | KRTS | 2 × 12 km | Reno's Sport circuit, pylons on the left, 15–76 m |

**What was reviewed.** That they pass the schema and the clean demo (at 5, 10 and 30 Hz, from 60 to
110 m/s; at 1 Hz with 110 m/s these and several earlier ones fail: the demo cannot level out between
one sample and the next); headings by bisector and the side of each turn pylon against the turn
(only the slaloms alternate, on purpose); `groundElevM` against the Terrarium DEM (they match:
ChatGPT used the same one); the airfields in the 12.4.3 apt.dat. And the terrain between gates: at
Quebrada, Gorafe, Auvergne, Lindis and the base of Osorno the straight line between two gates
crosses ridges of 60 to 150 m. A lowest-path search (within 1.4 times the straight line) found in
all of them a pass through the valley less than 35 m above the highest gate, and the description
warns about it.

### After 1.3: the X-Plane folder, in plain view

A user (2026-10-26) installed pylons, the app said "installed" and nothing showed up in their
X-Plane, on E:. The app uses the first installation that still exists in Laminar's list
(`x-plane_install_12.txt`); with another X-Plane 12 on C: the pack was written there. There was no
way to see or change it: the folder was not shown and "Choose folder…" only appeared if there was
none (the README promised the opposite).

Now the *before the start* list has an **X-Plane** row with the folder (and the `Log.txt` version)
and **Change…**; the install notice says where it was installed; and a folder that is not X-Plane
is no longer silently ignored: it says so, with the button to pick another. The choice stays in
`settings.json` (`xplaneDir`), as before.

In the same report they asked about turn pylons: passing farther out than the center line
(`widthM`, 300 m at Stead) does not count. That is on purpose and does not change.

**What was changed.** Author `XP Pylon Racer` (it said ChatGPT); ids without `local-` or `-01`;
gates `g1…gN` (the training ones came with `chicane-2a` and the like, and the app numbers by
position); default rules out of the file. The descriptions, rewritten for pilots: no coordinates or
validation notes, with the airfield, where the start is and what each gate asks. The turn pylons of
the Tall courses go from 120–160 m of line to **250 m**, like Queenstown and the catalog ones. At
Porto the description said "climb and turn as needed" after the finish: now it warns that the Luís I
bridge is 250 m ahead.

Still to fly. Most doubtful: Osorno's summit (the finish is 170 m above the last pylon and at 360
m), whether the Quebrada and Gorafe canyons show in X-Plane's mesh, and whether the training ones,
with 40 m gates between 15 and 25 m, can be flown at an Extra's speed.

### After 1.3.1: the race inside X-Plane (probe H3, flown 2026-10-26)

Juan flies on one monitor and today needs *Pin on top*. The H3 probe (`probes/H3/FLIGHT.md`) is a
plugin of our own in C++ (SDK 4.3.0, only XPLM301 APIs, so it works the same on 12.4.3 and on
12.4.4). It opens a window on a black background with the state, the clock, the next gate with its
arrow and the course. **It only displays: the judge is still the app.** The only thing it computes
is the arrow, with the sim's position on every frame. Four Daggett Sprint races (27.3–27.5 s) at a
capped 60 fps, with 0.06 ms per draw and 5.5–6 ms of GPU. Three lessons for the real plugin: read
the position only in the flight loop (in the menu it filled `Log.txt`), turn culling off before
drawing and, near a gate, have the arrow show its heading and not its center.

**The app now talks to the plugin**: `src/main/display.ts` sends the race to `127.0.0.1:49710` with
every update (`src/core/display/wire.ts`, the `protocol.h` format). When the plugin answers, the
*before the start* list shows it ("In the sim"). Without the plugin nothing changes. So that the
window and the plugin say the same thing, the race texts moved from the renderer to `src/core`
(`race/rulesText.ts`, with `GATE_NAME` and `statusLine`, `format.ts` and `telemetry/feedText.ts`).

Flown with the app the same day: Daggett Sprint in 27.26 s, New best, the same in the window and in
the plugin. Still to do: hidden versus visible, VR, the key and 12.4.4; and then, build in CI for
the three systems and install it from the app.

### After H3: the plugin in the release (1.4.0, flown 2026-10-27)

Juan asked to ship it as a separate file, and so it goes: the release brings, next to the
installers, `xp12-pylon-racer-plugin-<version>.zip` with the `XPPylonRacer/` folder (`win_x64`,
`mac_x64`, `lin_x64`), a `README.txt` and the license. The app does not install it: it is copied to
`Resources/plugins/` with X-Plane closed, like any plugin. Installing it from the app is left for
later, if users ask for it.

**What changed since the probe.** The code moved from `probes/H3/plugin/` to `plugin/`.
- Name *XP Pylon Racer*, signature `jlgabriel.xppylonracer.display`, command `xpr/toggle_display`,
  menu *Plugins › XP Pylon Racer*. The version is the app's (`package.json`).
- **The window is born hidden** and appears the first time the app talks to it: whoever installs the
  plugin and flies without the app sees nothing. If the pilot hides it, the app does not open it
  again until the next X-Plane start. **It comes back where you left it**
  (`Output/preferences/XPPylonRacer.prf`, only inside the sim; if it no longer fits on the screen,
  top right).
- It no longer writes measurements to `Log.txt` every 10 s: only the startup, the course when it
  changes and when the app appears. The `hello` still carries fps and draw time.
- **The protocol is tested from both sides.** `tests/display.test.ts` writes the app's real messages
  to `plugin/test/fixtures/` (`toMatchFileSnapshot`; `npx vitest run -u` rebuilds them) and
  `xpr_wire_test` parses them; the `hello` is built by `protocol.cpp` and the app's test reads the
  same file. The protocol version stays at 1.
- `npm run plugin` downloads Laminar's SDK 4.3.0 (verified by its sha256), builds, runs the test and
  assembles `plugin/out/XPPylonRacer/<system>/`. On macOS, universal (arm64 + x86_64), minimum 12.0
  and ad-hoc signature; on Linux, built on ubuntu-22.04 with the C++ runtime inside. CI builds it on
  the three systems on every push, and the release workflow assembles the zip.

**Flown on 2026-10-27** (12.4.3, KDAG, Extra, the app with `npm run dev`, the draft plugin):
- **With the app closed the window appeared anyway**, saying "Waiting for XP Pylon Racer…".
  `Log.txt` had no received message: the window is created hidden, but
  `XPLMSetWindowPositioningMode` shows it. Fixed (it is hidden after being placed) and installed,
  **not flown**.
- On opening the app the window picked up the race at once: "Armed", the clock in gray, "1 · Start"
  at 3.9 km and "ahead", the five gates on the map.
- **Daggett Sprint in 27.54 s, clean** ("all good!"): the plugin ended with "Finished", the clock in
  white and "+0.28 vs your best", the same as the app. It is the first time the `result` line is
  seen.
- On closing X-Plane the window was saved in `XPPylonRacer.prf`. There was no time to test that it
  comes back there, or hiding it with the app open.

**Still to do:** fly the startup fix, that the window comes back where it was left and that a window
hidden by the pilot stays hidden; test it on macOS and Linux (it is only built), VR, and 12.4.4. On
macOS the downloaded zip ends up in quarantine: the zip's README and the app's give the `xattr`.

### After 1.4: ten more courses from Juan (not flown yet)

Juan prepared them with ChatGPT on 2026-10-27 and brought them as `.pylonrace`, like the sixteen
from 1.3 (44 in total). All Tall and with the `rodeo-25` pylon (50 m at that size), like Osorno:

| Course | Airfield | Length | What it asks |
|---|---|---|---|
| Aysén Fjord Speed Run | SCAS (34 km in a line; ~31 km over water) | 19.0 km | 2 km legs over the channel; all gates 30–130 m |
| Badwater Basin Precision Oval | L06 (25 km) | 2 × 4.6 km | counterclockwise oval at −82 m; 2 between 30 and 60 m, 5 level |
| Cochamó Granite Valley Run | SCKM (4 km) | 15.0 km | valley upstream from 7 to 335 m, walls of 150–270 m; ≥ 50 m AGL |
| Daggett Precision Cup | KDAG (9 km) | 2 × 5.6 km | clockwise; two level and two knife-edge per lap, 600 m apart |
| Futaleufú River Chase | SCFT (4.4 km) | 14.7 km | 26 gates downriver, eleven alternating turn pylons; 30–120 m |
| Geiranger Fjord Challenge | XEN000I Stryn (24 km, over 1,400 m of mountain) | 15.0 km | the fjord's S; 11 between 25 and 55 m |
| Glen Coe Highland Descent | EGEO (38 km; via Loch Linnhe) | 13.4 km | drops from 278 to 3 m; ≥ 50 m AGL |
| Kornati Island Slalom | LDZD (34 km) | 17.0 km | sea among islands; six alternating turn pylons; 30–120 m |
| Milford Sound Fjord Run | NZMF (2 km) | 15.5 km | down the fjord, slalom 12–14 at the end; 25–90 m |
| Stead Right-Hand Sprint | KRTS (4 km) | 3 × 4.1 km | clockwise oval, five pylons on the right; 20–100 m |

**What was reviewed**, with the same tools as in 1.3: headings by bisector and the side of each
turn pylon (they match the turn in all of them; the alternating ones are on purpose); `groundElevM`
against the Terrarium DEM (differences under 15 m, except Milford); the nearest airfield in the
12.4.3 apt.dat, and the terrain between gates and from the airfield to the start. At Futaleufú
(1→2), Glen Coe (8→9) and Milford (4→5, 7→8) the straight line crosses a ridge or a point; the
lowest path passes less than 25 m above the highest gate (at Milford, over the water), and the
description warns about it. At Milford the DEM puts the fjord floor, around 1 and 2, at 236 m: it
is a bad DEM fill (the rest of the water is at 0) and the gates are left at 0.

**What was changed.** The same as in 1.3: descriptions rewritten for pilots, no coordinates or
validation notes, with the airfield and how to get to the start. Six came with "no airport is
assumed" or a distant airfield: now they name the nearest one (Aysén, Badwater, Cochamó, Geiranger,
Glen Coe, Kornati). The turn pylons go from 60–160 m of line to **250 m**. The Stead
Right-Hand Sprint warns that leg 5→6 of Reno Sport 2023 passes 125 m from its start: with both
installed you see the other one's pylons.

Still to fly. Most doubtful: whether the water at the bottom of Milford Sound is at sea level in
X-Plane's mesh, whether Futaleufú (70 m gates, 200 m legs) can be flown in an Extra, and the
mountain crossing from Stryn to Geiranger.

### After 1.5: Shirley calls every gate (not flown yet)

**The flight that brought it, 2026-10-27** (Daggett Sprint, Cessna 172SP, Shirley on the Quick
model; airplane.team/share/fEqLACwQ). With the corrected prompt from 2026-10-25, Shirley only woke
up after 6 s of silence and said "gate in seconds" without knowing when Juan would pass. When he
asked her to detect it, she herself called `SetWakeUpTriggers` with one point per gate (0.04 NM and
a fixed text) and called all five right on time: 21:40:10, :25, :40, :57 and 21:41:13, every ~15 s
as 600 m at ~75 kt asks for. The app: **1:02.75**, clean. The corrected prompt worked (it counted
the gates at any height and read the record's 1:00.79 correctly).

The report was sent to Alex. He answered that it is his new *wakeups* system, that a challenge
phase can arm them by itself (`wakeupTriggers`), that each one fires once, that a phase's triggers
are deleted when it ends, and that for several laps for now you have to use one phase per lap. The
format of the distance triggers was read in `types/tracked_wakeup_property.ts` of
frontend-stage.airplane.team on 2026-10-30 (to production "tomorrow", according to Alex):
`distanceTargets` keyed by `"lat,lon"` with six decimals and a list of `{ value (NM), label,
cannedText }`; it fires when dropping below `value` and is deleted; two identical ones merge into
one.

**What `src/core/export/shirley.ts` does now:**

- Each gate of the race phase carries its trigger: radius of half the width + 20 m (0.038 NM on
  Daggett's 100 m gates, almost what Shirley chose) and a text that is said at once: "Start gate!
  Clock's running.", "Gate 3!", "Lap 2!", "Finish!", with what the next one asks ("Knife edge
  next.", "Pylon next, keep it on your right.").
- **Turn pylons, after 1.6.0 (unreleased):** Juan's idea, an invisible pylon. The engine already
  judges a turn pylon by its pass line, from the pylon out to the side the pilot must fly, as long as
  the gate's width (`gatePassLine`): it is a gate with one visible pylon. So the export lines that
  line with small invisible gates, each a trigger saying "Pylon 4!": circles of at most 40 m,
  overlapping by 2 m, and no more than four per pylon (`MAX_TURN_TRIGGERS`), so a 500 m line gets
  four of 62.5 m. A pass outside the line gets no call, just as the app does not count it. Neither
  the app, the course, its revision nor X-Plane changes. Without the cap, Osorno (32 pylons on
  500 m lines) made a 73,000-character challenge; with it, 53,000, and nobody knows Shirley's limit
  yet. An oblique pass between two circles may get the call twice. 1.6.0 shipped without this:
  there, turn pylons had no trigger and Shirley called them from her 6 s wake-ups.
- **Several laps** (9 of the 44 courses): since each trigger fires once and a phase arms each point
  only once, the race is split into phases `Race1`…`RaceN` (`raceSegments`). Each one hands over at
  the gate before the longest leg, to give her the most time to change phase. With one lap there is
  still a single `Race`.
- The `Brief` wakes Shirley at 1 NM from the start, so that she enters the race on time without the
  pilot saying "let's go" (before, she only woke up every 60 s).
- `challengeTimer` and `recordFlightData` stay on each race phase; the schema says the data is only
  deleted when going from false to true, so going from `Race1` to `Race2` loses nothing.

**Flown on 2026-10-31** (Daggett Air Show, Cessna 172SP, Shirley on Quick, the invisible-gates
challenge pasted from the export; the app was 1.5.0, whose judging is the same; shared flight
airplane.team/share/8Wby4PTp):

| Test | Result |
|---|---|
| A first try | Shirley got no telemetry although she said "X-Plane Websocket Connected": she stayed in `Brief` the whole race. A new call, with Shirley connected before the app, worked. The app does not use the WebSocket (RPOS and plain REST calls), so it is probably not the cause. |
| Production accepts the triggers | The call page lists the phase's triggers under "Wake-up Triggers". |
| Every gate called | All twelve canned calls, each once, in order: start 14:25:18, then every 13–15 s, pylon 6 after 28 s, pylon 7 after 31 s, finish 14:28:31. 193 s from start to finish on Shirley's clock against 195.03 s of flight in the app (3:23.03 with +8 s), so the calls come about a second early, as designed. |
| Turn pylons | "Pylon 6!" and "Pylon 7!" came once each as Juan crossed their pass lines: the invisible gates work, and no double call. |
| What comes next | "Gate 5! Pylon next, keep it on your right." Shirley followed the calls with her own short comments, as the prompt asks. |
| Rough edges | `Brief` → `Race` happened on "Let's go" before takeoff, so the 1 NM wake-up was not needed. Twice Shirley's own sentence was cut by a canned call ("Pylon…", "Pylon six passed"). |
| App | **3:23.03**, the first Skyhawk record on the course: +8 s for the knife-edge and inverted gates (3, 4, 10) flown wings level and gate 8 too low. |

Still to fly: a multi-lap course (Daggett Precision Cup), where the risk is that the phase change,
which Shirley decides and takes a few seconds, arrives late for the next gate; Daggett without
speaking to Shirley at all (the 1 NM wake-up); the Extra, with gates every 3 to 5 s, in case the
texts step on each other; and Precise, which Alex thinks may work better.

### RREF as an alternative to RPOS (not adopted)

It shares without fighting, but each value arrives
as a **32-bit float**: lat/lon would lose precision (~0.7 m step at 117° longitude, against RPOS's
double), and a sample is ~10 loose datarefs with no guarantee of arriving in the same packet.
It works for reading flags (replay, without HTTP) or as a fallback source with `local_x/y/z`
position; noted for when a pilot needs to fly with a mobile map that will not let go of RPOS.

---

## 1. What it is

Pylon Racer for **X-Plane 12**: a desktop app that is at once

- **a pylon course creator**: you design the circuit on a map and the app installs it in
  X-Plane as a scenery pack with one click;
- **a racing game**: it follows your flight live, applies the rules, times you, saves every
  race and gives you a ranking by aircraft class among the pilots on this computer.

The cycle is the same as Pylon Racer's: **design or open a course → install it → fly → see the
result → retry.** What changes is everything that touches the simulator.

---

## 2. Decisions

| # | Decision | Why |
|---|----------|---------|
| D1 | **Separate app, not an "X-Plane mode" inside Pylon Racer** (Juan, 2026-10-24). | Same as XOP with respect to PCT (XOP D1): each app speaks its simulator's language from the first commit, and the already published Aerofly 1.0 does not get dirtied with `if (xplane)` branches. |
| D2 | **Name: XP Pylon Racer** (Juan confirmed it on 2026-10-25), repo `jlgabriel/xp12-pylon-racer`, public since 1.0. | Follows XOP's pattern (`xp12-object-placer`, "XP Object Placer"). |
| D3 | **X-Plane vocabulary from the first commit**: pack, DSF, OBJ8, dataref, RPOS. | No POI, `.tsl`, `autoheight` or `<coord>_pr_` folders: they are Aerofly concepts (LINEAGE). |
| D4 | **GPL-3.0-or-later.** | Allows copying code from Pylon Racer and XOP (same author, same license). |
| D5 | **Zero third-party assets. The app generates the pylons** (its own OBJ8 + PNG, `src/core/pylon/`). | krzysk1's Reno ones and Rodeo's are Aerofly `.tmb`: they do not work in X-Plane, and Rodeo's permission was for Pylon Racer. A generated pylon has **exact** height and radius, which is just what the "pylon touched" rule asks for. If an artist offers an OBJ8 pylon later, it gets added without changing the model. |
| D6 | **Probe before designing** (XOP D6). | Every hard fact about the sim is measured with a probe that cannot come out right by chance (positive control). The v0.0 probes are in `probes/`. |
| D7 | **Same `.pylonrace` course format.** A course made in one app opens in the other. | It is the only thing that crosses between the two simulators. Aerofly's pylon ids (`red`, `rodeo-reno`…) are translated to a generated pylon of the same color and role; none is lost. |
| D8 | **Rankings separate per simulator.** Aerofly times are neither imported nor compared. | Different physics, terrain and data rate: an AFS4 time and an X-Plane one do not measure the same thing. |
| D9 | **Inherited from Pylon Racer, not reopened:** no server; individual app (only courses are shared); no medals, ghost or sound; UI in English; design on tokens. (The docs were in Spanish until 2026-10-31; now everything on GitHub is in English.) | Juan's decisions of 2026-10-24 for Pylon Racer. |
| D10 | **Inherited from XOP, not reopened:** the app writes the binary DSF, without DSFTool (XOP D10); the installer writes the `scenery_packs.ini` line, with backup (XOP D8); install and uninstall with X-Plane closed (XOP D16); the installer only touches its own folders with a marker. | Measured and published in XOP 1.0–1.4. |
| D11 | **Each pylon model knows its height, at the size the course asks for (D15); the course's `pylonHeightM` is not used** (it stays in the format, for compatibility). The designer no longer shows it. | Generated pylons. Consequence: the **revision** of the same course is different in each app (height enters how it is scored), which fits D8. |
| D12 | **Aircraft class by ICAO code** (`acf_ICAO`), case-insensitive. The table was read from the `.acf` files of Juan's 12.4.3 installation, never from memory. | X-Plane has no fixed folder ids. An unknown aircraft: the pilot picks the class, remembered by its code. |
| D13 | **X-Plane finds itself** (first usable installation in `x-plane_install_12.txt`); the pilot can pick another. The e2e tests use `XPR_XPLANE_DIR` so they never touch a real X-Plane. | XOP's code (`findInstallations`). |
| D14 | **This app also registers `.pylonrace`** (Juan, 2026-10-25): with both installed, double-click opens the one installed last, and the README says so. Both import the file the same. | Whoever flies only X-Plane gets the double-click; whoever has both still has Import. |
| D15 | **Pylon size belongs to the course** (Juan, 2026-10-24): `rules.pylonSize`, `standard` (the usual models, 15–25 m) or `tall` (all at double the height **and** width, same paint: 30–50 m). It travels in the `.pylonrace`; Pylon Racer drops it on opening, like any key it does not know. The "pylon touched" radius grows the same as each model's base grew (`pylonHitRadiusFor`: the red one goes from 5 to 6.2 m), so the distance asked at the pylon's side does not change and a touch never falls inside the pylon. **Separate ranking:** `pylonSize` enters the revision when it is not `standard`, like each model's height, so changing it opens another ranking and going back to Standard recovers the previous one; earlier courses and races keep their revision. The tall models go in the pack as `pylon_<id>_tall.obj/.png`; Standard's `sceneryId` did not change. | In a sim a 15 m pylon is hard to see from far away. Two sizes are enough to choose without thinking; a pylon that is only taller would be a pole. Times with pylons of different height do not measure the same thing (D11). |

---

## 3. X-Plane 12 integration

### Flight data: three doors, to measure in H0

| | **RPOS** (UDP 49000) | **Web API** (WebSocket 8086) | **Port 49002** |
|---|---|---|---|
| Source | `Instructions/Exchanging Data with X-Plane.rtfd` (in the installation) | developer.x-plane.com, "X-Plane Web API" | undocumented for X-Plane 12 |
| Version | all | **12.1.1+** | — |
| Rate | **whatever you ask** (`RPOS\0` + `"40\0"`); cap: the sim's FPS | **10 Hz** according to Laminar, and only the values that change | ? |
| Position | lon/lat/elevation as **double** | double (JSON) | ? |
| Height | **real AGL** (`y_agl_mtr`) | `y_agl` | ? |
| Attitude | pitch, **true heading**, roll (float, degrees) | `true_theta/psi/phi` | ? |
| Velocity | vx east, vy up, vz **south** (m/s) + angular rates | `groundspeed`, `hpath` | ? |
| Aircraft | **no** | `acf_ICAO`, `acf_relative_path`, `acf_ui_name` | ? |
| Replay | keeps sending (replay positions) | `sim/time/is_in_replay` (0.2) | ? |
| Subscribers | **one**: the last that asked (0.2, §0) | REST: no limit | ? |
| Requires | nothing; do not disable incoming traffic | do not tick "Disable Incoming Traffic" in Settings › Network | an option in Settings › Network, if it exists |

**Hypothesis (to confirm in H0):** RPOS at 40 Hz feeds the race, like the DLL in Aerofly, and the
Web API is queried once per flight to learn which aircraft it is. If RPOS delivers close to 40 Hz,
X-Plane is better served than Aerofly over UDP (4.9 Hz) and with nothing to install.

Lessons from Aerofly that the probe verifies on its own (`probes/H0/analyze.ts`), without depending
on someone looking at an arrow:

- **Heading is a compass heading, not a mathematical angle.** In Aerofly the DLL delivered
  `90 − heading` and Juan caught it at KDAG (2026-10-18). Here it is compared against the track
  drawn by the positions themselves, and against the alternative reading.
- **Roll positive = right wing down**, checked against the direction the track turns.
- **vz points south**, as the document says (OBJ8 axes too: XOP verified it).
- **What happens in the menu and when paused** (in Aerofly, position 0,0 in the menu:
  `isNullIsland`).
- **Arrival jitter:** RPOS does not carry the sim's time. The hub timestamps each sample with the
  main process's monotonic clock, as in Pylon Racer. H0 measures how much the intervals wander.

### Scenery: one pack per course

```
Custom Scenery/XPR_<slug>/
  objects/pylon_<color>.obj + .png     generated, only the colors the course uses
                                       (pylon_<color>_tall with tall pylons, D15)
  Earth nav data/<block>/<tile>.dsf    one per touched tile (XOP's groupByTile)
  pylon-racer.json                     marker: the installer only touches folders with it
```

- **No elevation:** a DSF `OBJECT` rests on whatever mesh is under it (XOP,
  `reference/dsf-overlay.md`). Open-Meteo is not needed to plant pylons.
- `OBJECT_DEF` with a path **relative to the pack** (`objects/pylon_red.obj`). XOP only wrote
  library paths; the H1 probe's DSF already went through DSFTool without errors, it remains for
  X-Plane to fly it.
- The `XPR_` prefix is provisional (the probe uses it).

### Height and terrain

With RPOS the AGL comes **from the sim**: the height window is judged against X-Plane's real
terrain, without the DEM-versus-sim margin that Aerofly forced us to keep. Open-Meteo stays, at
most, to show the relief in the designer.

### Aircraft classes

X-Plane has no fixed folder ids like Aerofly: anyone installs any `.acf`. The class table is built
from **`acf_ICAO`** (C172, PTS2, E330…), with the **real** values that H0 delivers and never
written from memory (PCT rule). An unknown aircraft: the pilot picks the class and it is remembered
by `acf_relative_path`. That flow already exists in Pylon Racer.

---

## 4. Architecture

Same as Pylon Racer (Electron + TS + React 19 + Zustand 5 + zod, electron-vite, Node 24):

- `src/core/` pure and testable. **Ported from Pylon Racer:** `course/` (model, FNV revision,
  `raceSequence`, edits), `race/` (segment crossing, interpolation, rules), `run/`, `session/`,
  `ranking/` (except `classes.ts`), `demo/`. **Copied from XOP:** `dsf/`, `geo/` (already there),
  `airports/` (search in the user's `apt.dat`). **New:** `pylon/` (OBJ8 + PNG, already there),
  `telemetry/rpos.ts` and `telemetry/webapi.ts`, `export/pack.ts` (pure plan of the pack).
- `src/main/`: `ipc.ts` as the only boundary, telemetry hub with monotonic clock, race controller;
  **from XOP:** `installPack`, `sceneryPacksIni`, `findInstallations` (reads
  `x-plane_install_12.txt`, which on this computer lists three installations).
- `src/renderer/`: Pylon Racer's, tokens and all; the texts that name Aerofly change.

---

## 5. Version plan

| Version | What | Status (2026-10-25) |
|---|---|---|
| v0.0 | This document + probes H0–H2 | ✅ flown on 2026-10-24 |
| v0.1 | Core ported from Pylon Racer + RPOS source | ✅ ~29.5 Hz in the sim |
| v0.2 | Designer + pack installation | ✅ the Daggett Sprint installed by the app shows in X-Plane |
| v0.3 | Live race + ranking by class | ✅ first race: 29.13 s, Aerobatic |
| v0.4 | Open Pylon Racer's `.pylonrace` | ✅ same format, same pylon ids, same sample courses |
| 0.2 | The flight's findings (§0): shared RPOS, replay | ✅ flown: warning in 7 s, replay ignored, 29.02 s |
| Tall pylons | `rules.pylonSize`: Standard or Tall ×2 (D15) | ✅ flown at KDAG: "very good size" |
| 1.0 | 1.0 README, name and `.pylonrace` decided, release | Same cycle as XOP and PCT |
| 1.4 | The race inside X-Plane: the H3 probe's plugin, in a separate zip | Built on the three systems; the probe, flown; this form, not flown |

---

## 6. What to measure before designing in detail

| Question | Probe |
|---|---|
| At what rate does RPOS really arrive, in flight and in the menu? How much do the intervals wander? | H0 |
| Compass heading? Roll sign? vz south? | H0 (automatic) |
| What does the Web API say about the aircraft? At what rate? What arrives on 49002? | H0 |
| What happens with RPOS when paused and in the menu? | H0 |
| Does a DSF with a pack-relative `OBJECT_DEF` load? Do the pylons show, with their paint and resting on the ground? From what distance? | H1 |
| Are the RPOS positions and the DSF pylons the same world, to the meter? | H2 |

It all fits in **a flight of about 15 minutes**: [probes/README.md](../probes/README.md).
