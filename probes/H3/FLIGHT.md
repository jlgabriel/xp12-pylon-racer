# Probe H3: the race inside X-Plane

> **Since 1.4.0 the plugin lives in `plugin/`** and is built with `npm run plugin`
> (`plugin/out/XPPylonRacer/`), with another name and another command (`xpr/toggle_display`). What
> follows is the probe as it was flown; the paths `XPR_H3_Display` and `npm run probe:plugin` no
> longer exist.

**The question:** can a plugin of our own, built with SDK 4.3.0 and only XPLM301 APIs, show the race
inside the sim (state, clock, the next gate with its arrow, and the course on a black background)
without costing frames and without the app ceasing to be the judge?

## The design

- **The plugin only displays.** The judge is the app's `RaceSession`. Until we connect the app,
  `display.ts` stands in for it: it reads RPOS like the app, judges and sends the plugin what to
  show, with the app's own texts (`rulesText.ts`, `RaceView`'s `GATE_NAME`).
- **The only thing the plugin computes** is where the next gate is, from the nose: it uses the sim's
  position on every frame, not RPOS's ~30 Hz. So the arrow and the distance should look smoother
  than in the app.
- **The wire format** is in `plugin/src/protocol.h`. It is UDP to `127.0.0.1:49710`, in
  tab-separated text, with a version number. The course is sent every 2 s and the state ~20 times
  per second; on Windows 16 go out because of the timer's 15.6 ms. The plugin answers `hello` once
  per second with its fps and its draw time.
- **The window** is a modern X-Plane window: it moves, resizes, can be popped out into a separate
  system window and taken to VR. The clock is drawn with segments, because `XPLMDrawString` only
  has one small font. The colors were copied from `tokens.css`.
- **What it measures** goes to `Log.txt`, every 10 s, in lines that start with `XPR_H3:`: fps, draw
  ms (average and maximum), messages received, where the window is and **how many meters there are
  between the app's last fix and the sim's position** when each message arrives. That says how much
  the arrow would lag if the app computed it.
- It is built with **SDK 4.3.0** and only `XPLM200`–`XPLM301`, so it uses nothing specific to
  12.4.4. Repeat when 12.4.4 is officially out.

## Tested without the sim (2026-10-26)

- `npm run probe:plugin` builds with Build Tools 2026 (MSVC 19.50) without warnings. The `.xpl`
  exports the five `XPlugin*` functions and depends only on `XPLM_64.dll`, OpenGL, Winsock and
  Kernel32: the C++ runtime is inside, so no redistributable needs to be installed.
- `build/Release/xpr_h3_listen.exe` uses the plugin's same socket and same parser, without XPLM.
  Against `npm run probe:display -- --demo --course kdag-rules-test` it understands the course (6
  gates, 11 pylons) and the whole race: Start → Level ("wings level, ±10°") → Knife-edge → Turn
  pylon ("pass to the right of the pylon") → Gate ("below 40 m") → Finish, with the gates marked
  `d`/`n`/`t` on time. `display.ts` receives the `hello` back.
- **Not tested:** everything that draws. That can only be seen in X-Plane.

## First start (2026-10-26, 12.4.3)

- **It loads:** `XPR_H3: start 0.1.0-h3, X-Plane 12431, XPLM 430`, and it listens on 49710.
- **It was filling `Log.txt` from the main menu:** 34,490 lines of `Sim is not yet started -
  Position is unset`, two per frame. Windows **are drawn in the menu too**, and the drawing read
  latitude and longitude. The flight loop does **not** run in the menu (there was no measurement
  line). Fixed: the position is read only in the flight loop and the drawing uses the last one. The
  same will hold for the real plugin.
- **Already in flight (KDAG 26):** the plugin answers the `hello`. **59.5–59.8 fps** with the window
  visible, **draw 0.065 ms** average and 0.19 ms maximum, 17 messages per second. A single draw of
  307 ms, in the period when the flight was loading (12 fps): to watch.
- **It draws with Vulkan:** the window, the state, "1 · Start", "3.9 km", the "ahead" arrow and the
  map with the 5 gates in order and the aircraft at the edge, facing west. The `—` looks fine.
- **Neither the black background, nor the clock, nor the little squares of the pylons showed up;**
  the lines and the arrow did. At first we thought it was `GL_QUADS`, but with triangles the same
  happened. The cause is **back-face culling, which X-Plane leaves on** in window drawing: the
  arrow goes clockwise and shows, the rectangles went counterclockwise and disappeared.
  `XPLMSetGraphicsState` does not touch it, so `glState()` does `glDisable(GL_CULL_FACE)`.
- The course was written to `Log.txt` every time it arrived (every 2 s). Now only when it changes.

## First race (2026-10-26, 12.4.3): Daggett Sprint in 27.34 s, clean

- **56–60 fps** the whole race with the window visible, **draw 0.05–0.07 ms** average and under
  0.5 ms maximum. The 307 ms spike did not repeat: it was at flight load.
- **The app lags ~2 m** behind the sim (maximum 7 m) at race speed. It is little, but the arrow is
  still computed by the plugin.
- At the end, the window says "Finished" and all the gates turn gray.
- **The arrow "went crazy" when passing each gate** (Juan): it pointed at the center, and passing to
  the side the center turns to 90° and then stays behind until the app reports the pass. Now, at
  less than 150 m (or the gate's width), it points along the gate's heading. **Flown again the same
  day: "the arrow no longer goes crazy"** ✅. The `Log.txt` of that flight: 58–60 fps, 0.06 ms per
  draw, and the course written only once.
  The app has the same `TurnCue` and the same thing happens to it, at fewer frames.
- This race was still flown without the black background or the clock (the `GL_QUADS` version).
- **With culling off everything shows** (Juan's screenshot, "better!"): black background, the big
  clock, "1 · Start" with its `·`, the course name and the pylons on the map. The clock came out
  white while waiting for the start, when it should have been gray: the color was set before the
  clock's `glState()` and got lost. Now the clock receives it and sets it afterwards.
- **Third race, with the clock in view: 27.51 s** ("now we're talking!"). At the end, "Finished",
  the big time and all the gates in gray. 49–60 fps and 0.05–0.07 ms per draw. The clock's `1` sits
  at the right of its cell, as on any seven-segment display.
- **Fourth race, 27.38 s**, with the version that measures the GPU: the clock gray while waiting,
  white while running and gray again at the end. An idea of Juan's to think about: the final time
  perhaps should stand out, not be dimmed.
- **Resizing:** the map grows with the window. The clock does not, because it has a 64 px cap.
- **Pop out ✅:** it becomes a real Windows window and keeps drawing everything. At the top right a
  small square shows, which looks like a leftover of X-Plane's decoration.
- **GPU** (`gpu_time_per_frame_sec_approx`): with the window in the sim, **5.5–6 ms** at a capped
  60 fps. **With the separate window it dropped to 30–42 fps and 6.5–8.4 ms** in three periods. It
  may be the cost of one more system window or Juan may have been moving it: repeat it standing
  still.
- The menu *Plugins › XP Pylon Racer (H3)* works.
- **A crash at startup** (23:27, first time with the app connected through `npm run dev`): in the
  main menu, at 6 s, after `IDENT: Getting keystore from disk...`. The minidump gives exception
  `0x80000003` (a breakpoint, that is, an assert in X-Plane itself) at `X-Plane.exe+0x15e8daa`. The
  stack only has `X-Plane.exe` code, nothing from `XPLM_64.dll` or from our plugin, and the log says
  "Location undetermined". In the menu the plugin only draws "Waiting…", the same as in earlier
  sessions, which did not crash. Reading: X-Plane's, not ours. If it repeats, try without
  `XPR_H3_Display`.
- **With the real app (`npm run dev`, without `probe:display`) ✅:** the list before the start
  says "In the sim — the race shows in X-Plane 12.4.3 too (plugin 0.1.0-h3)", and the plugin and
  the window show the same thing at once. **Daggett Sprint in 27.26 s, clean: New best**, saved by
  the app, with sectors of 6.72 / 6.85 / 6.85 / 6.84 s. The plugin ended with "Finished 00:27.26".
  What the plugin still did not say: that it was the best mark (the app shows it in violet). Now
  the app sends it a `result` line and the final clock turns **violet with "New best!"**, white with
  "+0.26 vs your best", red if it did not finish or gray in a demo. **Installed, not flown.**
- **Missing:** hidden versus visible (no period was left with the window hidden), VR, a key for
  `xpr/h3/toggle_display`, Pop out standing still, and repeating on 12.4.4.

## Before (with X-Plane closed)

1. If `probes/H3/XPR_H3_Display/` does not exist, rebuild it with `npm run probe:plugin`.
2. Copy the **`XPR_H3_Display`** folder to
   `D:\Laminar\XP12-Last-Release\X-Plane 12\Resources\plugins\`.
3. **Close XP Pylon Racer.** RPOS has a single subscriber, and `display.ts` asks for it the same
   way the app does.

## In X-Plane

4. **Flight at KDAG, runway 26**, with any aircraft. The Daggett Sprint pylons are already
   installed (`XPR_daggett-sprint`).
5. **Without the sender yet:** at the top right a black window *XP Pylon Racer* must appear saying
   "Waiting for XP Pylon Racer...", and in the *Plugins* menu an item **XP Pylon Racer (H3)**.
   **One screenshot.**
6. In a terminal, in the `xp12-pylon-racer` folder:
   ```
   npm run probe:display
   ```
   Every 5 s it prints a line from the plugin (fps, draw ms). The window must change to
   "Armed — fly through the start gate", with the clock at 00:00.00, "1 · Start" and the course
   below.
7. **At the threshold:** the arrow points forward ("ahead"), because the start is 2 km past the end
   of the runway. On the map you see 5 gates in a line and your aircraft. Check that `°`, `·` and
   `—` look right. **One screenshot.**
8. **The window:** move it and resize it. Try *Plugins › XP Pylon Racer (H3) › Pop out into its own
   window* and then *Back into the sim*. If you have VR, try *Move into VR*. Assign a key or a
   button to **`xpr/h3/toggle_display`** (*Settings › Keyboard*, search "XP Pylon Racer") and try
   showing and hiding.
9. **Fly the Daggett Sprint** watching the window. Note whether the clock reads at a glance,
   whether the arrow moves smoothly and whether the next gate changes when you pass it. At the end
   it must say "Finished", and the terminal prints the time.
10. **The cost:** with the aircraft stable, leave the window **hidden for 20 s** and then **visible
    for 20 s**. Juan has fps capped at 60 from the NVIDIA driver, so fps do not show the cost. Compare
    the **`gpu … ms`** column (`sim/time/gpu_time_per_frame_sec_approx`, which Laminar calls
    approximate) and the plugin's own draw time, which is CPU.
11. Go out to the menu and stop the terminal with **Ctrl+C**.

## After

12. Send me the screenshots and your notes from steps 7 to 9. I read `Log.txt` directly from disk.
13. **Uninstall:** with X-Plane closed, delete `Resources\plugins\XPR_H3_Display`.

## How to read it

| You see | Reading |
|---|---|
| Window and menu; `XPR_H3: start …` in `Log.txt` | ✅ the plugin loads with SDK 4.3.0 |
| No window and `Log.txt` says it could not load `XPR_H3_Display.xpl` | a DLL is missing or the architecture does not match: send me `Log.txt` |
| "UDP port 49710 is taken by another program" | another program uses the port: pick another |
| The window flickers or stays black with Vulkan | 2D drawing with OpenGL is not enough: try Zink, or think of another way to draw |
| `°` or `·` come out as squares or garbage | `XPLMDrawString` does not understand UTF-8: the app sends ASCII |
| Same fps with the window hidden and visible, draw < 0.5 ms | ✅ it costs nothing |
| "app fix vs sim" of several meters at race speed | the arrow is better computed in the plugin, as it already is |
| Pop out and VR work | ✅ it works with one monitor and with a headset |
