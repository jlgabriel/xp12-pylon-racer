<p align="center"><img src="resources/icon.png" width="96" alt=""></p>

# XP Pylon Racer

Pylon racing for **X-Plane 12**. Pick a course, fly through its gates in order and race the clock:
XP Pylon Racer follows your flight live, times every gate, applies the rules and keeps your runs.
Design your own courses on a satellite map, install their pylons in X-Plane with one click, and
share them with other pilots as a file.

It is the X-Plane sibling of [Pylon Racer](https://github.com/jlgabriel/afs4-pylon-racer) for
Aerofly FS 4: same races, same rules, same `.pylonrace` course files.

![A finished run on Daggett Air Show, with the splits against the pilot's best](media/race-result.png)

## Install

Grab the latest build from [**Releases**](https://github.com/jlgabriel/xp12-pylon-racer/releases):

| System | File |
|--------|------|
| Windows | `xp12-pylon-racer-<version>-setup.exe` (installer) or `-portable.exe` |
| macOS (Apple silicon / Intel) | `xp12-pylon-racer-<version>-arm64.dmg` / `-x64.dmg` |
| Linux | `xp12-pylon-racer-<version>.AppImage` |

Needs **X-Plane 12** (12.1.1 or later to read the aircraft type). The builds are not signed with a
paid certificate:

- **Windows**: if SmartScreen appears, click *More info* → *Run anyway*.
- **macOS**: the first time, macOS says it could not verify the app. Open *System Settings* →
  *Privacy & Security* and click *Open Anyway*.
- **Linux**: make the AppImage executable (`chmod +x`) and run it.

## Get started

1. **[Install](#install) XP Pylon Racer** and start it. It finds X-Plane 12 by itself (from Laminar's own list of
   installations); if you have several, or it finds none, it lets you choose the folder.
2. **Pick a course** on the left and click **Install pylons**. X-Plane reads scenery when it starts,
   so start it (or restart it) after installing.
3. **Fly.** The course's description says where to take off. Nothing needs switching on in X-Plane:
   the app asks it for your position (see [Connecting to X-Plane 12](#connecting-to-x-plane-12)). The
   race arms itself and starts when you fly through the start gate in the right direction. A checklist
   under the timer says what is still missing and where the start is.
4. **Fly the gates in order.** Your run is saved at the finish. **Race again** arms a new attempt.

Want to see it first? **Watch demo** flies any course for you, no simulator needed.

## Courses included

| Course | Where | What it asks |
|--------|-------|--------------|
| **Grand Canyon West River Run** | Grand Canyon West, **1G4** | 21 km along the Colorado River, 1,000 m below the rim, by Jugac64 |
| **Queenstown Lake Race** | Queenstown, **NZQN** | 11 km over Lake Wakatipu with tall pylons, designed by ChatGPT |
| **Stead Pylon Oval** | Reno Stead, **KRTS** | Three laps of a Reno-style oval, every pylon on your left |
| **Daggett Air Show** | Daggett, **KDAG** | Wings level, knife edge, inverted, a height window and turn pylons |
| **Daggett Sprint** | Daggett, **KDAG** | Five gates in a straight line: the quickest way to learn |
| **KDAG Rules Test** | Daggett, **KDAG** | One gate of each classic kind |
| **KDAG Air Race Pylons** | Daggett, **KDAG** | The 15, 18 and 25 m air-race pylons |
| **Munich Sprint** / **Munich Diamond** | Munich, **EDDM** | A straight sprint, and two laps of a diamond |

## Racing

![Racing the Stead Pylon Oval: the next gate, which way to turn, the minimap](media/racing.png)

- **Live race screen**: race time, the delta to your best at each gate, the gate strip, the next gate
  with what it asks for and which way to turn ("35° left"), a course map over satellite imagery with
  your trail, and speed, height, altitude and bank.
- **Splits**: the result shows the time between every two gates against the same stretch of your best.
- **Multi-lap courses**: the start line closes each lap; lap times are shown at the finish.
- **Gate detection that does not depend on the update rate**: a pass is found by crossing the gate line
  between two samples, and its instant is interpolated.
- **Height rules use X-Plane's own height above the ground**, so a ceiling or a floor is judged
  against the terrain you actually see.
- **Demo flights** never count for the ranking.

### Flying with one monitor

**Pin on top** keeps the app above the simulator (run X-Plane windowed). Make the window narrow and it
shows only what you need while flying: the timer, the next gate with its turn arrow, the map and the
values.

### The rules

| Gate | How to pass it |
|------|----------------|
| **Start** / **Finish** | Between the pylons, in the course's direction. The start starts the clock |
| **Gate** | Between the pylons, in the course's direction |
| **Level gate** | With the wings level (±10° of bank) |
| **Knife-edge gate** | On a wing (90° of bank, ±15°) |
| **Inverted gate** | Upside down (180° of bank, ±20°) |
| **Turn pylon** | A single pylon: fly around it on the side the course says |

Any gate can also have a **ceiling**, a **floor**, or both (a height window), measured above the ground.

| Penalty | Default |
|---------|---------|
| Missed gate | +10 s (or the run ends, if the course says so) |
| Wrong direction | +10 s |
| Wrong attitude (level, knife edge, inverted) | +2 s |
| Too high / too low | +2 s |
| Pylon hit (closer than 5 m, below its top) | +3 s |
| Turn pylon cut | +10 s |

Every course can change its penalties and tolerances.

## The pylons

XP Pylon Racer draws its own pylons: tapered, striped tubes generated when you install a course, in
ten colours and heights from 15 to 25 m. Each gate can use any of them. Because the app makes them,
it knows exactly how tall and how wide every pylon is, which is what the pylon-hit rule needs.

Pylons are hard to spot from a distance in a simulator, so every course also picks a **pylon size**:
**Standard**, or **Tall ×2**, every pylon twice as tall and twice as wide (30 to 50 m). The pylon-hit
distance grows with the pylon, and a Tall course has its own ranking, since times around bigger
pylons do not compare.

Installing a course writes one scenery pack, `Custom Scenery/XPR_<course>/`, and one line in
`scenery_packs.ini`, just below `*GLOBAL_AIRPORTS*` (the file is backed up first, and nothing else in
it is touched). **Remove** takes both out again. The app never touches a folder it did not create.

## Pilots and rankings

![The ranking of Daggett Air Show in the Aerobatic class](media/ranking.png)

- **Ranking per course and aircraft class** (aerobatic, vintage and warbird, general aviation, jet,
  helicopter, glider, heavy), one row per pilot with their best run.
- The app reads your aircraft's ICAO type code from X-Plane (C172, Extra, P51…) and knows the class of
  the X-Plane 12 fleet and many popular add-ons. For any other aircraft, pick the class in the top
  bar once; it is remembered.
- **Several pilots on one computer**: click the callsign in the top bar to switch, add or remove.
- **Changing a course's gates or rules starts a new ranking** for it.

## Design your own courses

![The designer on the Grand Canyon West River Run](media/designer.png)

- **Course designer on a satellite map**: search for an airport or a place, click to place gates, drag
  a gate to move it, drag its arrow to turn it, drag a pylon to make it wider or narrower.
- **Gate kinds**, **laps**, **height limits**, the **pylon** of each gate, the **pylon size** and the
  course's **penalties and tolerances**.

## Sharing

There is no server: courses travel as files. Your runs stay on your computer.

- **Share…** on a course saves a `.pylonrace` file. To open one, use **Import…**, drop it on the
  window, or double-click it.
- **Courses made in Pylon Racer for Aerofly FS 4 open here, and the other way round.** A course keeps
  its gates and its look; its rankings are separate in each app, since times from two simulators do
  not compare. Pylon Racer has no Tall pylons: a Tall course opens there with Standard ones.
- With both apps installed, double-clicking a `.pylonrace` opens the one installed last. **Import…**
  works in either.

## Connecting to X-Plane 12

There is nothing to install in X-Plane and nothing to switch on:

- **Position (RPOS, UDP port 49000).** The app asks X-Plane for its position (it arrives about 30
  times a second), the way moving maps do (documented in X-Plane's `Instructions/Exchanging Data with X-Plane`). It asks
  again whenever the stream stops, so X-Plane can be started before or after the app.
- **Aircraft and replay (Web API, port 8086, X-Plane 12.1.1 or later).** To read which aircraft you
  fly, and whether X-Plane is playing a replay: positions from a replay are not raced.

Both are local to your computer. If **Settings › Network › Disable Incoming Traffic** is ticked in
X-Plane, untick it. The top bar shows whether X-Plane is sending and at what rate.

**X-Plane sends RPOS to one program only**, the last one that asked. If another program on this
computer also asks for it (some moving maps do), the two keep taking it from each other: the top bar
then says *RPOS taken*. Close the other program, or switch it to another X-Plane output; the app
takes RPOS back on its own within about 10 seconds.

## Building from source

Requires Node 24.

```bash
npm install
npm run dev            # run the app
npm run typecheck      # both tsconfigs
npm test               # unit tests
npm run test:e2e       # builds, then drives the Electron app
npm run build:win      # or build:mac / build:linux
```

`npm run preview:renderer` serves the interface alone in a browser (port 5298); open it with
`?mockracer` to race demo flights without Electron. The `probe:*` scripts are the simulator checks
described in [`probes/README.md`](probes/README.md).

## License and credits

GPL-3.0-or-later. See [LICENSE](LICENSE).

XP Pylon Racer ships no X-Plane content and no third-party models: the pylons are generated by the
app. The fonts are Inter and Barlow Semi Condensed (SIL Open Font License). See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
