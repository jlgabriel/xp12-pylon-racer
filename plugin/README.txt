XP Pylon Racer: in-sim display plugin
=====================================

Shows your race from XP Pylon Racer inside X-Plane 12, in a window of its own: the race status,
a big clock, the next gate with what it asks and an arrow pointing the way to it, and a map of the
course. Handy with one monitor: no need to keep the app on top of the sim.

The plugin only shows. XP Pylon Racer still times and judges the race, so keep the app running on
the same computer, with the course open. Without the app the plugin does nothing.

Install
-------

1. Close X-Plane.
2. Copy the folder XPPylonRacer (the one that contains win_x64, mac_x64 and lin_x64) into

       X-Plane 12/Resources/plugins/

   so that you end up with X-Plane 12/Resources/plugins/XPPylonRacer/win_x64/XPPylonRacer.xpl.
3. macOS only: macOS blocks plugins downloaded from the internet. Open Terminal and run, with
   your own X-Plane folder:

       xattr -dr com.apple.quarantine "/path/to/X-Plane 12/Resources/plugins/XPPylonRacer"

4. Start X-Plane and XP Pylon Racer, and open a course in the app. The window appears by itself
   the first time the app speaks to it, and the app's list before the start says "In the sim".

Using it
--------

- Plugins > XP Pylon Racer: show or hide the window, pop it out into a window of its own (to put
  it on another monitor), move it into VR, or bring it back into the sim.
- Assign a key or a joystick button to "xpr/toggle_display" (Settings > Keyboard, search for
  "XP Pylon Racer") to show and hide it while flying.
- Drag and resize it like any X-Plane window. It comes back where you left it next time.
- If you hide it, the app does not bring it back until X-Plane starts again.

Uninstall: close X-Plane and delete Resources/plugins/XPPylonRacer.

Works with X-Plane 12 on Windows (x64), macOS (Apple silicon and Intel) and Linux (x64). It talks
to the app over UDP on 127.0.0.1, port 49710, and nothing leaves your computer.

XP Pylon Racer is free software under the GNU GPL v3 or later:
https://github.com/jlgabriel/xp12-pylon-racer
