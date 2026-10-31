# Probe H0: what X-Plane 12 says about the flight, and through which channel

**The question:** which channel feeds the race, at what rate, in what units and with what signs?
And through which one do we learn which aircraft it is?

## The design

`listen.ts` opens all the doors at once and records what arrives on each, without interpreting
anything:

- **RPOS** (UDP 49000): asks X-Plane for the position 40 times per second and asks again if the
  flow is cut (X-Plane forgets the subscriber when it restarts). On exit, it asks for 0 Hz so
  X-Plane is not left sending to a closed port.
- **Web API** (WebSocket 8086, `/api/v3`): looks up 16 datarefs by name (REST v3, v2 and v1, just
  in case) and subscribes. Names that do not exist are noted: that is also a result.
- **Port 49002**: everything that arrives, with its first 200 characters.
- **BECN** (multicast 239.255.1.1:49707): X-Plane's version and port, to find it later without
  configuration.

`analyze.ts` summarizes at the end. Signs are read **against the track drawn by the positions
themselves**, so they cannot come out right by chance:

| Check | Against what | Alternative that must lose |
|---|---|---|
| Compass heading | track of the positions at the middle of each second | `90 − heading` (the Aerofly DLL's error) |
| vx east, vz south | the same track | — |
| Roll + = right wing down | the direction the track turns | — |
| Pitch + = nose up | whether it climbs or descends | (weak: a glide descends with the nose up) |

Tested against `fake-xplane.ts`: heading 0.2° from the track (the mathematical angle, at 91°), vz
south at 0.2° and roll 327 of 357.

## How to read it

| If `summary.md` says | Then |
|---|---|
| RPOS in flight ≥ 30 Hz, p95 interval < 50 ms | RPOS is the race's source |
| RPOS < 10 Hz | check: sim FPS low? Repeat with `--rate 20` |
| ✅ on all four signs | Pylon Racer's core ports without conversion |
| ❌ on heading with the alternative at ~0° | X-Plane sends a mathematical angle: convert it in `telemetry/rpos.ts` |
| The Web API reports `acf_ICAO` | the class table is built from those real values |
| Anything on 49002 | note format and rate; it is not the main source unless RPOS fails |

## Result: flown 2026-10-24, X-Plane 12.4.3, Vertigo's Extra 330SC

Juan flew at SCEL: taxi and takeoff on 17L, low passes through the three gates, aerobatic
maneuvers (rolls, inverted) and replay. Run `runs/2026-10-25T01-38-31` (local, not versioned).

| Question | Measured answer |
|---|---|
| RPOS rate | **~29.5 Hz** (median interval 33.9 ms, p95 41 ms) asking for 40, with X-Plane at ~60 fps. Seven times Aerofly's UDP. |
| Heading | ✅ **compass**: 3.0° from the track at the median (p90 5.9°) over 3472 pairs; read as a mathematical angle it would be 91°. It arrives in **[-180, 180]** (-179 was seen): `rpos.ts` already maps it to [0, 360). |
| vx / vz | ✅ east / **south**: the velocity track and the position track, at 0.2°. |
| Roll sign | ✅ **positive = right wing down**: 346 of 346 samples in steady turns of 15–60°. At bank angles over 60°, inverted or mid-roll, the relation to the turn breaks by physics (214 of 361); it is no longer judged there. |
| Pitch | ✅ positive = nose up (1651 of 1678). |
| Menu | No RPOS until a flight loads; **never** lat/lon 0,0. |
| Pause / replay | **RPOS keeps going at ~30 Hz with the position frozen.** The engine already treats a frozen flow as the end of the race. ⚠️ In replay playing, X-Plane would send replay positions: they must be ignored (dataref `replay_mode`). |
| Web API | REST answers on **`/api/v3`**; the Vertigo's `acf_ICAO` = `Extra`. The **WebSocket only opens on `/api/v1`** (v2 and v3 close with 1006); the app does not use it. |
| Port 49002 | Nothing. X-Plane 12 does not send ForeFlight by default, and it is not needed. |
| Beacon | It arrives: version 124311, port 49000, PC name. It can be used to find X-Plane on the network without configuration. |

### ⚠️ Finding: RPOS has ONE subscriber

With the app and the recorder both asking for RPOS, each saw ~29 Hz, then ~18, then 0, and so on:
X-Plane sends RPOS **only to the last one that asked**, and each program asked again when it ran out
of data. With one closed, the other got a steady ~29 Hz. Consequence for the app: if the pilot uses
another program that also asks for RPOS (a mobile map), they fight. Pending for the design: detect
it (flow that cuts out every ~2 s) and warn, or switch to another source (RREF, or the Web API).
