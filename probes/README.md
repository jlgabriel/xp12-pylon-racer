# v0.0 probes: a flight of about 15 minutes

The three probes are flown together. H1 places the pylons, H0 records everything X-Plane says and H2
cross-checks the recording against the pylons. Each `FLIGHT.md` explains the question and how to read
the answer; this page is only the list of what to do.

Tested without the sim against `npm run probe:fake`, a fake X-Plane with a scripted flight: the
analysis returns exactly the script (32.0 m from the left pylon and correct signs).

## Before (with X-Plane closed)

1. **Install the pylon pack.** It is already generated in `probes/H1/XPR_H1_Pylons/`. If it was
   deleted, rebuild it with `npm run probe:pack`.
   - Copy the `XPR_H1_Pylons` folder to `D:\Laminar\XP12-Last-Release\X-Plane 12\Custom Scenery\`.
   - Back up `Custom Scenery\scenery_packs.ini` and add this line **right below**
     `SCENERY_PACK *GLOBAL_AIRPORTS*`, where XOP's is already:
     ```
     SCENERY_PACK Custom Scenery/XPR_H1_Pylons/
     ```
2. **Close Pylon Racer (Aerofly)** if it is open: it also listens on port 49002, and with two
   programs on the same port you cannot tell which one the packets reach.
3. In a terminal, in the `xp12-pylon-racer` folder:
   ```
   npm run probe:listen
   ```
   Leave it running **before** opening X-Plane: that way it also records the menu and the beacon.
   Every 2 s it prints a line with the rates.

## In X-Plane

4. **Main menu, 20 s without touching anything.**
5. **Settings › Network:** check that "Disable Incoming Traffic" is **not** ticked. Look for any
   option for ForeFlight, "mapping apps" or EFB; if there is one, turn it on and **write down the
   exact name**.
6. **New flight:** stock Cessna 172, **SCEL, runway 17L**, daytime, **no wind** (wind does not break
   the analysis, but it makes it noisy).
7. **At the threshold, before takeoff:** look down the runway. You should see **three pairs of
   pylons** at 1500, 2000 and 2500 m: green, red and orange, each with white stripes, on the
   pavement and 40 m apart. To the left of the green pair, at 150 m, a small control tower.
   **One screenshot.**
8. **Take off and fly low, between 5 and 15 m, through the three pairs.** The pylons are 20 m tall.
   After each pair note where you passed: *near the left / center / near the right*.
9. **Climb to about 300 m** and make **one full right turn** with about 30° of bank, then **one full
   left turn**.
10. **Pause (P) for about 10 s** and continue.
11. **Go back to the menu** and wait 10 s. Then **Ctrl+C** in the terminal: it writes the summary.

## After

12. In the terminal:
    ```
    npm run probe:gates -- probes/H0/runs/<the folder it created>
    ```
13. Send me the run folder (with `summary.md` and `gates.md`), the screenshot and your three notes
    for the gates. I read X-Plane's `Log.txt` directly from disk.
14. **Uninstall:** delete the `XPR_H1_Pylons` folder and its line in `scenery_packs.ini`, with
    X-Plane closed.

## If something looks odd

- **The terminal line shows RPOS at 0 Hz with the aircraft already on the runway:** something is
  blocking port 49000 (the firewall or incoming traffic disabled). Note what you see and carry on:
  the Web API and 49002 record anyway.
- **The pylons are not visible but the tower is:** the pack loaded and the objects did not. That is
  a result, not a failure. Continue with the rest of the flight.
- **Not even the tower is visible:** the pack did not load. Check the `scenery_packs.ini` line.

## H3, separate: the race inside X-Plane

A plugin of our own that shows the race in a sim window, with the app as judge. It is flown
separately; the steps are in `probes/H3/FLIGHT.md`.
