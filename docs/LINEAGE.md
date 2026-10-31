# Lineage: what comes from Pylon Racer, what comes from XOP, and what is rejected

XP Pylon Racer has two parents. From **Pylon Racer** (Aerofly FS4) it inherits the game: the rules,
the race engine, the course format and the interface. From **XOP** (XP Object Placer) it inherits
everything it knows about X-Plane: the DSF, the installer and the probe discipline.

This file exists so that six months from now nobody, person or agent, "fixes" something here by
bringing back an Aerofly concept that was left out on purpose. **If you are about to add something
from the last table, you are making a mistake.**

## Copied from XOP, line by line

Each file has a header that says so. Their tests were copied too: XOP's numbers passing here is what
proves the copy did not drift. These files keep XOP's style (single quotes, imports with `.js`); the
rest of the repo follows Pylon Racer's.

| File | Why it travels |
|---|---|
| `src/core/dsf/writeDsfBinary.ts`, `tile.ts`, `validate.ts` | The binary DSF that X-Plane 12.4.3 loads (XOP H0b, H8). No DSFTool. |
| `src/core/install/sceneryPacksIni.ts` | One line in `scenery_packs.ini`, without reordering or normalizing anything else, keeping the file's line endings. |
| `src/core/install/parseInstallList.ts`, `src/main/findInstallations.ts` | Find X-Plane 12 from Laminar's installer list. |
| `src/main/containedPath.ts` | No path leaves `Custom Scenery`. |
| `src/core/model.ts` | **Trimmed** to `LonLat` and `PlacedObject`, what the DSF needs. `libraryPath` keeps its name even though here it is a path relative to the pack: renaming it would force changes to the copied code. |
| `tests/writeDsfBinary.test.ts`, `tile.test.ts`, `sceneryPacksIni.test.ts`, `parseInstallList.test.ts`, `containedPath.test.ts` | With `XOP_DSFTOOL` pointing to DSFTool, also the read-back (on this computer: `D:\Simuladores\Ortho4XP1.3\Utils\DSFTool.exe`). |

**Adapted, not copied:** `src/main/installer.ts` follows XOP's `installPack` rules (build alongside
and swap with a rename, back up the ini, a locked file is not X-Plane's fault) with its own marker
`pylon-racer.json` and the `XPR_` prefix. The marker ownership test never gets stricter (XOP's
`packContract` rule).

**To copy if needed:** `airports/` (search in the user's `apt.dat`). Today the designer searches with
Nominatim, like Pylon Racer.

## Ported from Pylon Racer (v0.1)

All of `src/` except the Aerofly parts: `course/` (zod model, FNV revision, `raceSequence`,
`edit.ts`), `race/`, `run/`, `session/`, `ranking/`, `demo/`, `files/` (`.pylonrace`), `geo/` (Pylon
Racer's `geo.ts`, which is PCT's with what the engine needs), `main/` and the whole renderer with its
tokens, fonts and icons. Their tests came with the code.

What changed in the port:

| Piece | In Pylon Racer | Here |
|---|---|---|
| Telemetry | ForeFlight UDP 49002 + AeroflyReader.dll | RPOS (UDP 49000) + Web API for the aircraft (`core/telemetry/rpos.ts`, `webapi.ts`) |
| `SourceKind` | `udp`, `reader`, `demo` | `rpos`, `demo` |
| Pylons | `.tmb` sold in `assets/` | generated (`core/pylon/`, `core/export/pylons.ts`), **same ids** |
| Scenery | `.tsl` POI (`export/poi.ts`) | pack with DSF (`export/pack.ts`) |
| Classes | AFS4 folder ids | ICAO codes read from the `.acf` files |
| Course revision | — | different: each pylon has a known height (DESIGN D11), and the course picks its size (D15) |
| Golden test of the `.tsl` | the whole `.tsl` | only the pylon positions, which stay identical to the old exporter |

## The discipline (from PCT, via XOP)

Probe before designing · positive control · angles that are not multiples of 90° · the sim's log as
the cheapest instrument (`Log.txt`) · pure core with no I/O · docs written against the code · verify
the UI in the real renderer · the installer only touches its own things · small named milestones.

## Rejected on purpose

| Aerofly concept | Why it does not travel | What replaces it |
|---|---|---|
| POI folder `<coord>_pr_<slug>` and `.tsl` | Aerofly's scenery format | `XPR_<slug>` pack with DSF (DESIGN §3) |
| `autoheight` | In X-Plane an `OBJECT` always rests on the mesh | Nothing: the DSF carries no height |
| `.tmb` pylons from krzysk1 and Rodeo | Compiled Aerofly format; Rodeo's permission was for AFS4 | Generated pylons (`src/core/pylon/`) |
| AeroflyReader.dll and `compassFromReader` (`90 − angle`) | The DLL is Aerofly's; the conversion fixed a mathematical angle that X-Plane, according to its documentation, does not deliver (H0 confirms it) | RPOS, true heading in degrees |
| `isNullIsland` as "I'm in the menu" | Aerofly signal; X-Plane may behave differently | The filter stays (it costs nothing); what H0 says decides |
| Classes by folder id (`c172`, `extra330`) | X-Plane has no fixed ids | `acf_ICAO` + pilot's choice |
| Open-Meteo elevation as the source for the height rule | Aerofly over UDP gave no AGL | AGL from RPOS; Open-Meteo stays as fallback and for the demo |
