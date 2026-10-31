# Probe H2: are RPOS's position and the DSF's pylons the same world?

**The question:** when Juan says "I passed near the right pylon", does the log say the same, to the
meter?

If not, no race rule is worth anything: a "skipped" gate could be a coordinate error and not a
piloting one. In Aerofly this was never measured directly.

## The design

`gates.ts` takes the `rpos.csv` of the H0 run and, for each pair of samples that crosses the line of
one of H1's gates (`probes/course.ts`, the same numbers the DSF used), gives:

- **how many meters from the left pylon** it crossed (0 = left, 40 = right, flying 17L);
- the AGL height and the bank at the crossing (interpolated);
- the **minimum distance to each pylon** within ±3 s, the basis for the "pylon touched" radius.

The math is deliberately simple: a local plane per gate and a segment crossing. The real engine
arrives from Pylon Racer in v0.1; here it only has to be obviously correct. Tested with the fake
X-Plane, which passes 12 m to the right of the axis: it returns **32.0 m** at all three gates.

## How to read it

Compare each row with Juan's note:

| Juan noted | Expected in "from left" |
|---|---|
| near the left | 0 – 13 m |
| center | 13 – 27 m |
| near the right | 27 – 40 m |

All three match ⇒ ✅ RPOS's world and the DSF's world coincide at the scale that matters (XOP's DSFs
quantize to ~21 cm). A gate that is off by a lot ⇒ check against the screenshot before drawing
conclusions.

## Result: flown 2026-10-24, X-Plane 12.4.3 ✅

| Gate | From the left | AGL | What Juan's replay shows |
|---|---|---|---|
| 1 green | 20.0 m (exact center) | 12.7 m | the aircraft centered between the two pylons |
| 2 red | 15.1 m (5 m to the left) | 9.7 m | the aircraft clearly left of center |
| 3 orange | 18.9 m (almost center) | 9.0 m | just slightly left |

Instead of notes, Juan sent three screenshots of the X-Plane replay with the camera behind the
aircraft at each gate. That is a better reference than a note from memory, and all three match the
log in side and in order of magnitude. **RPOS's position and the DSF's pylons are the same world.**

The real race at KDAG confirmed it later: the Daggett Sprint, in the same Extra, finished clean in
29.13 s, with all five passes within 6 m of the center of each gate.
