// Courses seeded so there is something to fly (or to watch in demo mode) from the first launch.
// The first eight are the ones Pylon Racer (Aerofly) ships, gate for gate. Their revisions differ
// between the two apps, as they should: here every pylon has a known height, which is part of how a
// course is scored. Two sit just north-east of EDDM (Munich); four are in the open Mojave desert at
// KDAG: a sprint, a flight test of every rule, a flight test of the three air-race pylons and an
// aerobatic showcase. Then a Reno-style pylon oval at Reno Stead (KRTS) and Juan's river run at the
// bottom of the Grand Canyon. The ninth is only here: a lake race at Queenstown (NZQN) with tall
// pylons, the first course flown on water.
import { COURSE_FORMAT, COURSE_VERSION, parseCourse, type Course } from "../course/course";

const STAMP = "2026-10-18T00:00:00Z";

/**
 * The `updatedAt` of earlier copies of a sample that the app itself put on disk (or, for Juan's
 * Grand Canyon run, his own copy before it shipped). A stored sample still carrying one of these was
 * never saved by the user, so it may take the shipped text; anything else is the user's and is left
 * alone. Add the old stamp here whenever a sample's text changes. (Queenstown's is Juan's copy, as
 * he flew it, from before it shipped.)
 */
export const SAMPLE_EARLIER_STAMPS: Readonly<Record<string, readonly string[]>> = {
  "kdag-rules-test": [STAMP],
  "grand-canyon-west-river-run": ["2026-10-24T10:53:37.241Z"],
  "queenstown-lake-race-01": ["2026-10-25T21:43:34.997Z"],
};

export function sampleCourses(): Course[] {
  return [
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "daggett-sprint",
      name: "Daggett Sprint",
      author: "Pylon Racer",
      description:
        "Five gates in a straight line on the extended centerline of KDAG runway 26, 600 m apart. Take off on 26 and hold runway heading: the start is 2 km past the end of the runway.",
      createdAt: STAMP,
      updatedAt: STAMP,
      laps: 1,
      // On the extended centerline of runway 08/26 (true heading 90/270). Open desert, terrain ~588 m.
      gates: [
        { id: "g1", type: "start", center: { lon: -116.8197763, lat: 34.8514715 }, widthM: 100, headingDeg: 270, pylon: "green", groundElevM: 588 },
        { id: "g2", type: "gate", center: { lon: -116.8263516, lat: 34.8514701 }, widthM: 100, headingDeg: 270, pylon: "red", groundElevM: 588 },
        { id: "g3", type: "gate", center: { lon: -116.8329268, lat: 34.8514684 }, widthM: 100, headingDeg: 270, pylon: "blue", groundElevM: 588 },
        { id: "g4", type: "gate", center: { lon: -116.8395021, lat: 34.8514663 }, widthM: 100, headingDeg: 270, pylon: "red", groundElevM: 588 },
        { id: "g5", type: "finish", center: { lon: -116.8460774, lat: 34.8514639 }, widthM: 100, headingDeg: 270, pylon: "home", groundElevM: 588 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "kdag-rules-test",
      name: "KDAG Rules Test",
      author: "Pylon Racer",
      description:
        "One gate of each kind, westbound, 1.5 km north of KDAG and parallel to Daggett Sprint: 2 wings level, 3 knife edge, 4 single turn pylon, pass to its right (north), 5 below 40 m.",
      createdAt: STAMP,
      updatedAt: "2026-10-19T00:00:00Z", // the turn pylon text changed
      laps: 1,
      // Lat 34.8665, 600 m apart, terrain from Open-Meteo (591–597 m).
      gates: [
        { id: "g1", type: "start", center: { lon: -116.8198, lat: 34.8665 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 591 },
        { id: "g2", type: "level", center: { lon: -116.8263691, lat: 34.8665 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 592 },
        { id: "g3", type: "knife", center: { lon: -116.8329382, lat: 34.8665 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 594 },
        { id: "g4", type: "turn", center: { lon: -116.8395073, lat: 34.8665 }, widthM: 150, headingDeg: 270, pylon: null, groundElevM: 596, turnSide: "left" },
        { id: "g5", type: "gate", center: { lon: -116.8460765, lat: 34.8665 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 596, topM: 40 },
        { id: "g6", type: "finish", center: { lon: -116.8526456, lat: 34.8665 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 597 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "kdag-rodeo-test",
      name: "KDAG Air Race Pylons",
      author: "Pylon Racer",
      description:
        "The three air-race pylons, westbound, 1.5 km north of KDAG Rules Test: 1 Reno 15 m, 2 Air Race 18 m, 3 Air Race 25 m, 4 single turn pylon 18 m, pass to its right (north), 5 Reno 15 m.",
      createdAt: "2026-10-20T00:00:00Z",
      updatedAt: "2026-10-20T00:00:00Z",
      laps: 1,
      // Lat 34.8815, same longitudes as KDAG Rules Test (600 m apart), terrain from Open-Meteo (584–590 m).
      gates: [
        { id: "g1", type: "start", center: { lon: -116.8198, lat: 34.8815 }, widthM: 100, headingDeg: 270, pylon: "rodeo-reno", groundElevM: 590 },
        { id: "g2", type: "gate", center: { lon: -116.8263691, lat: 34.8815 }, widthM: 100, headingDeg: 270, pylon: "rodeo-18", groundElevM: 584 },
        { id: "g3", type: "gate", center: { lon: -116.8329382, lat: 34.8815 }, widthM: 100, headingDeg: 270, pylon: "rodeo-25", groundElevM: 587 },
        { id: "g4", type: "turn", center: { lon: -116.8395073, lat: 34.8815 }, widthM: 150, headingDeg: 270, pylon: "rodeo-18", groundElevM: 589, turnSide: "left" },
        { id: "g5", type: "finish", center: { lon: -116.8460765, lat: 34.8815 }, widthM: 100, headingDeg: 270, pylon: "rodeo-reno", groundElevM: 590 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "munich-sprint",
      name: "Munich Sprint",
      author: "Pylon Racer",
      description: "Five gates in a straight line heading east, 600 m apart. Start at 48.376 N, 11.850 E.",
      createdAt: STAMP,
      updatedAt: STAMP,
      laps: 1,
      gates: [
        { id: "g1", type: "start", center: { lon: 11.85, lat: 48.376 }, widthM: 80, headingDeg: 90, pylon: "green" },
        { id: "g2", type: "gate", center: { lon: 11.8581, lat: 48.376 }, widthM: 80, headingDeg: 90, pylon: "red" },
        { id: "g3", type: "gate", center: { lon: 11.8662, lat: 48.376 }, widthM: 80, headingDeg: 90, pylon: "blue" },
        { id: "g4", type: "gate", center: { lon: 11.8743, lat: 48.376 }, widthM: 80, headingDeg: 90, pylon: "red" },
        { id: "g5", type: "finish", center: { lon: 11.8824, lat: 48.376 }, widthM: 80, headingDeg: 90, pylon: "home" },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "munich-diamond",
      name: "Munich Diamond",
      author: "Pylon Racer",
      description: "Two laps around a diamond of 1.4 km legs, clockwise. The start line closes each lap.",
      createdAt: STAMP,
      updatedAt: STAMP,
      laps: 2,
      // Each corner gate faces the bisector of the leg in and the leg out, so the line is crossed
      // squarely while turning.
      gates: [
        { id: "g1", type: "start", center: { lon: 11.85, lat: 48.39 }, widthM: 100, headingDeg: 0, pylon: "green" },
        { id: "g2", type: "gate", center: { lon: 11.8635, lat: 48.399 }, widthM: 100, headingDeg: 90, pylon: "red" },
        { id: "g3", type: "gate", center: { lon: 11.877, lat: 48.39 }, widthM: 100, headingDeg: 180, pylon: "blue" },
        { id: "g4", type: "gate", center: { lon: 11.8635, lat: 48.381 }, widthM: 100, headingDeg: 270, pylon: "red" },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "stead-pylon-oval",
      name: "Stead Pylon Oval",
      author: "Pylon Racer",
      description:
        "Three laps of a Reno-style pylon oval in the open desert just north of Reno Stead (KRTS), home of the Reno air races. Fly it counterclockwise and keep every pylon on your left. The start line, on the south side flown east, closes each lap: cross it below 60 m. Take off from KRTS and line up from the west: the start is on the south side of the oval, 1.5 km north of runway 8/26, flown east.",
      createdAt: "2026-10-24T00:00:00Z",
      updatedAt: "2026-10-24T00:00:00Z",
      laps: 3,
      // North of the field, clear of the hangars, the houses to the west and Swan Lake to the east;
      // terrain 1527–1552 m (Open-Meteo), rising to the north-east. Each pylon faces the bisector of
      // its two legs.
      gates: [
        { id: "g1", type: "start", center: { lon: -119.8865, lat: 39.679 }, widthM: 120, headingDeg: 90, pylon: "rodeo-25", groundElevM: 1527, topM: 60 },
        { id: "g2", type: "turn", center: { lon: -119.874, lat: 39.6795 }, widthM: 300, headingDeg: 44, pylon: "rodeo-reno", groundElevM: 1539, turnSide: "left" },
        { id: "g3", type: "turn", center: { lon: -119.874, lat: 39.6925 }, widthM: 300, headingDeg: 318, pylon: "rodeo-reno", groundElevM: 1552, turnSide: "left" },
        { id: "g4", type: "turn", center: { lon: -119.8865, lat: 39.6935 }, widthM: 300, headingDeg: 270, pylon: "rodeo-reno", groundElevM: 1536, turnSide: "left" },
        { id: "g5", type: "turn", center: { lon: -119.899, lat: 39.6925 }, widthM: 300, headingDeg: 222, pylon: "rodeo-reno", groundElevM: 1540, turnSide: "left" },
        { id: "g6", type: "turn", center: { lon: -119.899, lat: 39.6795 }, widthM: 300, headingDeg: 136, pylon: "rodeo-reno", groundElevM: 1527, turnSide: "left" },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "daggett-air-show",
      name: "Daggett Air Show",
      author: "Pylon Racer",
      description:
        "An aerobatic showcase on the flat desert 5 km north of KDAG. Westbound: wings level (2), knife edge (3), upside down (4) and a height window (5, between 15 and 40 m). Round two turn pylons, keeping them on your right (6, 7), then eastbound: above 30 m (8), upside down again (10) and a low wings-level pass below 25 m (11) to the finish. Take off on KDAG runway 26 and turn right: the start is 5 km north-west of the airport, flown west.",
      createdAt: "2026-10-24T00:00:00Z",
      updatedAt: "2026-10-24T00:00:00Z",
      laps: 1,
      // Lat 34.8965 out and 34.9105 back, 600 m between gates, terrain 582–593 m (Open-Meteo); the
      // Calico foothills start 1 km further north.
      gates: [
        { id: "g1", type: "start", center: { lon: -116.8198, lat: 34.8965 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 582 },
        { id: "g2", type: "level", center: { lon: -116.826372, lat: 34.8965 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 584 },
        { id: "g3", type: "knife", center: { lon: -116.832944, lat: 34.8965 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 587 },
        { id: "g4", type: "inverted", center: { lon: -116.839516, lat: 34.8965 }, widthM: 100, headingDeg: 270, pylon: null, groundElevM: 592 },
        { id: "g5", type: "gate", center: { lon: -116.846088, lat: 34.8965 }, widthM: 100, headingDeg: 277, pylon: null, groundElevM: 593, topM: 40, bottomM: 15 },
        { id: "g6", type: "turn", center: { lon: -116.856, lat: 34.8985 }, widthM: 250, headingDeg: 322, pylon: null, groundElevM: 593, turnSide: "right" },
        { id: "g7", type: "turn", center: { lon: -116.856, lat: 34.9085 }, widthM: 250, headingDeg: 38, pylon: null, groundElevM: 593, turnSide: "right" },
        { id: "g8", type: "gate", center: { lon: -116.8461, lat: 34.9105 }, widthM: 100, headingDeg: 83, pylon: null, groundElevM: 592, bottomM: 30 },
        { id: "g9", type: "gate", center: { lon: -116.8395, lat: 34.9105 }, widthM: 100, headingDeg: 90, pylon: null, groundElevM: 592 },
        { id: "g10", type: "inverted", center: { lon: -116.833, lat: 34.9105 }, widthM: 100, headingDeg: 90, pylon: null, groundElevM: 588 },
        { id: "g11", type: "level", center: { lon: -116.8264, lat: 34.9105 }, widthM: 100, headingDeg: 90, pylon: null, groundElevM: 588, topM: 25 },
        { id: "g12", type: "finish", center: { lon: -116.8198, lat: 34.9105 }, widthM: 100, headingDeg: 90, pylon: null, groundElevM: 587 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "grand-canyon-west-river-run",
      name: "Grand Canyon West River Run",
      author: "Jugac64",
      description:
        "21 km along the Colorado River at the bottom of the canyon, 1,000 m below the rim. Take off from Grand Canyon West, 1G4 in X-Plane, runway 17, turn left and descend east into the canyon: the start is on the river 3.8 km east of the airport, flown north-northwest. 7 wings level, 8 below 50 m, 9 knife edge, 13 wings level.",
      createdAt: "2026-10-24T10:53:37.241Z",
      updatedAt: "2026-10-24T20:00:00Z",
      laps: 1,
      // Designed and flown by Juan (2026-10-24, 04:10.56). The river at 353–360 m, the rim at ~1,400 m;
      // each gate centered on the river with cross-sections of the Open-Meteo DEM.
      gates: [
        { id: "g1", type: "start", center: { lon: -113.774595, lat: 35.983177 }, widthM: 100, headingDeg: 333, pylon: "rodeo-reno", groundElevM: 357 },
        { id: "g2", type: "gate", center: { lon: -113.779531, lat: 35.996075 }, widthM: 100, headingDeg: 345, pylon: "rodeo-25", groundElevM: 352 },
        { id: "g3", type: "gate", center: { lon: -113.782667, lat: 36.009375 }, widthM: 100, headingDeg: 0, pylon: "rodeo-18", groundElevM: 356 },
        { id: "g4", type: "gate", center: { lon: -113.78379, lat: 36.022957 }, widthM: 100, headingDeg: 332, pylon: "rodeo-25", groundElevM: 355 },
        { id: "g5", type: "gate", center: { lon: -113.797588, lat: 36.031203 }, widthM: 100, headingDeg: 314, pylon: "rodeo-18", groundElevM: 360 },
        { id: "g6", type: "gate", center: { lon: -113.806329, lat: 36.042794 }, widthM: 100, headingDeg: 328, pylon: "rodeo-25", groundElevM: 354 },
        { id: "g7", type: "level", center: { lon: -113.820151, lat: 36.048 }, widthM: 100, headingDeg: 270, pylon: "rodeo-18", groundElevM: 354 },
        { id: "g8", type: "gate", center: { lon: -113.836838, lat: 36.048807 }, widthM: 100, headingDeg: 274, pylon: "rodeo-25", groundElevM: 354, topM: 50 },
        { id: "g9", type: "knife", center: { lon: -113.852677, lat: 36.051192 }, widthM: 100, headingDeg: 270, pylon: "rodeo-25", groundElevM: 358 },
        { id: "g10", type: "gate", center: { lon: -113.869058, lat: 36.05452 }, widthM: 100, headingDeg: 292, pylon: "rodeo-18", groundElevM: 355 },
        { id: "g11", type: "gate", center: { lon: -113.882804, lat: 36.061233 }, widthM: 100, headingDeg: 321, pylon: "rodeo-25", groundElevM: 354 },
        { id: "g12", type: "gate", center: { lon: -113.89378, lat: 36.071736 }, widthM: 100, headingDeg: 339, pylon: "rodeo-18", groundElevM: 353 },
        { id: "g13", type: "level", center: { lon: -113.894639, lat: 36.085399 }, widthM: 100, headingDeg: 345, pylon: "rodeo-18", groundElevM: 354 },
        { id: "g14", type: "gate", center: { lon: -113.906898, lat: 36.092404 }, widthM: 100, headingDeg: 270, pylon: "rodeo-25", groundElevM: 354 },
        { id: "g15", type: "finish", center: { lon: -113.922547, lat: 36.097332 }, widthM: 100, headingDeg: 321, pylon: "rodeo-reno", groundElevM: 353 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "queenstown-lake-race-01",
      name: "Queenstown Lake Race",
      author: "ChatGPT",
      description:
        "11 km over the open water of Lake Wakatipu, south of the Kelvin Peninsula, with tall pylons that stand out on the lake. Take off from Queenstown (NZQN) and fly south-west across the peninsula: the start is on the lake 6.7 km south-west of the airport, flown east-south-east, with only 1 km of water behind it, so swing round over the lake to line up. 3 wings level between 55 and 180 m, 5 a turn pylon kept on your right, 6 between 70 and 160 m, 7 wings level.",
      createdAt: "2026-10-25T13:00:00Z",
      updatedAt: "2026-10-25T23:00:00Z",
      laps: 1,
      // Designed by ChatGPT; Juan moved the turn pylon (g5) ~335 m south-west, away from the east
      // shore, and flew it on 2026-10-25 (02:44.71). The lake at 310 m (Open-Meteo); X-Plane measures
      // the height above its surface. The id keeps the "-01" of the shared file, so a copy already
      // imported is this course, not a second one.
      gates: [
        { id: "g1", type: "start", center: { lon: 168.664, lat: -45.049 }, widthM: 160, headingDeg: 119, pylon: "green", groundElevM: 309 },
        { id: "g2", type: "gate", center: { lon: 168.677, lat: -45.054 }, widthM: 145, headingDeg: 119, pylon: "rodeo-18", groundElevM: 309 },
        { id: "g3", type: "level", center: { lon: 168.69, lat: -45.059 }, widthM: 130, headingDeg: 116, pylon: "blue", groundElevM: 309, topM: 180, bottomM: 55 },
        { id: "g4", type: "gate", center: { lon: 168.707, lat: -45.064 }, widthM: 145, headingDeg: 119, pylon: "rodeo-25", groundElevM: 309 },
        { id: "g5", type: "turn", center: { lon: 168.7140376, lat: -45.071156 }, widthM: 250, headingDeg: 182, pylon: "home2", groundElevM: 310, turnSide: "right" },
        { id: "g6", type: "gate", center: { lon: 168.701, lat: -45.076 }, widthM: 145, headingDeg: 260, pylon: "rodeo-25", groundElevM: 309, topM: 160, bottomM: 70 },
        { id: "g7", type: "level", center: { lon: 168.68, lat: -45.073 }, widthM: 130, headingDeg: 290, pylon: "blue", groundElevM: 309 },
        { id: "g8", type: "gate", center: { lon: 168.657, lat: -45.064 }, widthM: 145, headingDeg: 331, pylon: "red", groundElevM: 309 },
        { id: "g9", type: "finish", center: { lon: 168.658, lat: -45.05 }, widthM: 160, headingDeg: 3, pylon: "home", groundElevM: 309 },
      ],
      rules: { pylonSize: "tall" },
    }),
  ];
}
