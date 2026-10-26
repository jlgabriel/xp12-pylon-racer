// Courses seeded so there is something to fly (or to watch in demo mode) from the first launch.
// The first eight are the ones Pylon Racer (Aerofly) ships, gate for gate. Their revisions differ
// between the two apps, as they should: here every pylon has a known height, which is part of how a
// course is scored. Two sit just north-east of EDDM (Munich); four are in the open Mojave desert at
// KDAG: a sprint, a flight test of every rule, a flight test of the three air-race pylons and an
// aerobatic showcase. Then a Reno-style pylon oval at Reno Stead (KRTS) and Juan's river run at the
// bottom of the Grand Canyon. The rest are only here, all with tall pylons: a lake race at
// Queenstown (NZQN), the first course flown on water, and nine laid out on 2026-10-26, eight of
// them from Juan's catalog of proposed courses: Lake Villarrica at Pucón (SCPC), a three-lap oval on
// the Salar de Uyuni (SLUY), the floor of Monument Valley (UT25), the south coast of Rapa Nui (SCIP),
// a two-lap oval on Lake Llanquihue (SCTE), Lake General Carrera (SCCC), the sea round Heimaey
// (BIVM), the east coast of Kauaʻi (PHLI), and Lake Tahoe (KTVL). Last, sixteen Juan prepared:
// twelve over land (the Osorno volcano, canyons, badlands, valleys, a dune field and the steppe) and
// four training versions of real air-race courses at Abu Dhabi, Chiba, Porto and Reno.
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
    // The four below come from Juan's catalog of proposed courses and are not flown yet. Each was laid
    // out on the AWS Terrarium DEM: every pylon on water (or, in Monument Valley and Uyuni, on flat
    // ground), nothing more than 30 m above the course within 250–400 m of the path, and each gate
    // facing the bisector of its legs. Ground heights from Open-Meteo, like the others.
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "pucon-volcano-race",
      name: "Pucón Volcano Race",
      author: "XP Pylon Racer",
      description:
        "15 km over Lake Villarrica, with the Villarrica volcano to the south. Take off from Pucón (SCPC) runway 27 and turn right over the town: the start is on the lake 9 km north-west of the airport, flown west. Out west along the north half of the lake, round a turn pylon kept on your left (6), and back east in an S. 3 wings level, 9 knife edge.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // The east half of the lake, at least 1 km from every shore and clear of the La Poza peninsula
      // (SE of the finish). The lake at 213 m.
      gates: [
        { id: "g1", type: "start", center: { lon: -71.998, lat: -39.24 }, widthM: 160, headingDeg: 270, pylon: "green", groundElevM: 213 },
        { id: "g2", type: "gate", center: { lon: -72.016, lat: -39.237 }, widthM: 145, headingDeg: 270, pylon: "rodeo-18", groundElevM: 213 },
        { id: "g3", type: "level", center: { lon: -72.034, lat: -39.24 }, widthM: 130, headingDeg: 270, pylon: "blue", groundElevM: 213 },
        { id: "g4", type: "gate", center: { lon: -72.052, lat: -39.237 }, widthM: 145, headingDeg: 266, pylon: "rodeo-25", groundElevM: 213 },
        { id: "g5", type: "gate", center: { lon: -72.07, lat: -39.242 }, widthM: 145, headingDeg: 236, pylon: "rodeo-18", groundElevM: 213 },
        { id: "g6", type: "turn", center: { lon: -72.084, lat: -39.254 }, widthM: 250, headingDeg: 177, pylon: "home2", groundElevM: 213, turnSide: "left" },
        { id: "g7", type: "gate", center: { lon: -72.068, lat: -39.265 }, widthM: 145, headingDeg: 101, pylon: "rodeo-25", groundElevM: 213 },
        { id: "g8", type: "gate", center: { lon: -72.05, lat: -39.26 }, widthM: 145, headingDeg: 88, pylon: "rodeo-18", groundElevM: 213 },
        { id: "g9", type: "knife", center: { lon: -72.032, lat: -39.264 }, widthM: 130, headingDeg: 92, pylon: "red", groundElevM: 213 },
        { id: "g10", type: "finish", center: { lon: -72.014, lat: -39.261 }, widthM: 160, headingDeg: 78, pylon: "home", groundElevM: 213 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "uyuni-salt-flats-speed",
      name: "Uyuni Salt Flats Speed Challenge",
      author: "XP Pylon Racer",
      description:
        "Three laps of a 6.4 km oval on the white salt of the Salar de Uyuni, 3,654 m above the sea: fly it clockwise and keep every pylon on your right. The start line, on the south side flown west, closes each lap: cross it below 60 m. Take off from Uyuni (SLUY) runway 31 and hold runway heading for 25 km: the start is straight ahead. The air is thin up here, so expect a long take-off roll and a slow climb.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 3,
      // Near the Dakar monument, 10 km inside the salar's east shore: the DEM is flat within 6 m
      // for 400 m round the whole oval. Each pylon faces the bisector of its two legs.
      gates: [
        { id: "g1", type: "start", center: { lon: -67.07, lat: -20.334 }, widthM: 150, headingDeg: 270, pylon: "rodeo-25", groundElevM: 3654, topM: 60 },
        { id: "g2", type: "turn", center: { lon: -67.081, lat: -20.334 }, widthM: 300, headingDeg: 315, pylon: "rodeo-reno", groundElevM: 3654, turnSide: "right" },
        { id: "g3", type: "turn", center: { lon: -67.081, lat: -20.326 }, widthM: 300, headingDeg: 45, pylon: "rodeo-reno", groundElevM: 3654, turnSide: "right" },
        { id: "g4", type: "turn", center: { lon: -67.059, lat: -20.326 }, widthM: 300, headingDeg: 135, pylon: "rodeo-reno", groundElevM: 3654, turnSide: "right" },
        { id: "g5", type: "turn", center: { lon: -67.059, lat: -20.334 }, widthM: 300, headingDeg: 225, pylon: "rodeo-reno", groundElevM: 3654, turnSide: "right" },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "monument-valley-challenge",
      name: "Monument Valley Challenge",
      author: "XP Pylon Racer",
      description:
        "16 km on the valley floor east of the Mittens and Merrick Butte. Take off from Monument Valley (UT25; XKUT25 in X-Plane) and fly east over the mesa: the start is on the valley floor 14 km east of the airport, flown south-south-west. South past the buttes, round two turn pylons kept on your left (6, 7) and back north. 4 wings level.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // The floor slopes from 1,560 m down to 1,485 m eastward; no pylon on rock. The nearest buttes
      // stand ~600 m west of gates 3–5, 200–300 m tall.
      gates: [
        { id: "g1", type: "start", center: { lon: -110.043, lat: 36.991 }, widthM: 160, headingDeg: 198, pylon: "green", groundElevM: 1559 },
        { id: "g2", type: "gate", center: { lon: -110.048, lat: 36.979 }, widthM: 145, headingDeg: 176, pylon: "rodeo-25", groundElevM: 1518 },
        { id: "g3", type: "gate", center: { lon: -110.04, lat: 36.966 }, widthM: 145, headingDeg: 160, pylon: "rodeo-18", groundElevM: 1517 },
        { id: "g4", type: "level", center: { lon: -110.036, lat: 36.953 }, widthM: 130, headingDeg: 182, pylon: "blue", groundElevM: 1540 },
        { id: "g5", type: "gate", center: { lon: -110.041, lat: 36.941 }, widthM: 145, headingDeg: 178, pylon: "rodeo-25", groundElevM: 1526 },
        { id: "g6", type: "turn", center: { lon: -110.034, lat: 36.928 }, widthM: 250, headingDeg: 117, pylon: "home2", groundElevM: 1556, turnSide: "left" },
        { id: "g7", type: "turn", center: { lon: -110.01, lat: 36.932 }, widthM: 250, headingDeg: 44, pylon: "home2", groundElevM: 1549, turnSide: "left" },
        { id: "g8", type: "gate", center: { lon: -110.006, lat: 36.952 }, widthM: 145, headingDeg: 0, pylon: "rodeo-18", groundElevM: 1507 },
        { id: "g9", type: "gate", center: { lon: -110.01, lat: 36.972 }, widthM: 145, headingDeg: 343, pylon: "rodeo-25", groundElevM: 1485 },
        { id: "g10", type: "finish", center: { lon: -110.02, lat: 36.99 }, widthM: 160, headingDeg: 336, pylon: "home", groundElevM: 1516 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "rapa-nui-coastal-race",
      name: "Rapa Nui Coastal Race",
      author: "XP Pylon Racer",
      description:
        "15.5 km on the sea off the south coast of Rapa Nui, round the cliffs of Rano Kau and back on an outer line. Take off from Mataveri (SCIP) runway 10 and come round over the sea: the start is 4 km east of the end of the runway, flown west-south-west along the coast. 3 and 6 wings level.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Outbound 0.6–1 km off the coast, the turn (5) 1.2 km south of the Rano Kau cliffs and 2.5 km
      // east of the Motu Nui islets; the way back 2–3 km offshore.
      gates: [
        { id: "g1", type: "start", center: { lon: -109.365, lat: -27.173 }, widthM: 160, headingDeg: 249, pylon: "green", groundElevM: 0 },
        { id: "g2", type: "gate", center: { lon: -109.38, lat: -27.178 }, widthM: 145, headingDeg: 249, pylon: "rodeo-18", groundElevM: 0 },
        { id: "g3", type: "level", center: { lon: -109.395, lat: -27.183 }, widthM: 130, headingDeg: 236, pylon: "blue", groundElevM: 0 },
        { id: "g4", type: "gate", center: { lon: -109.41, lat: -27.198 }, widthM: 145, headingDeg: 229, pylon: "rodeo-25", groundElevM: 0 },
        { id: "g5", type: "gate", center: { lon: -109.425, lat: -27.207 }, widthM: 145, headingDeg: 174, pylon: "rodeo-18", groundElevM: 0 },
        { id: "g6", type: "level", center: { lon: -109.405, lat: -27.214 }, widthM: 130, headingDeg: 87, pylon: "blue", groundElevM: 0 },
        { id: "g7", type: "gate", center: { lon: -109.385, lat: -27.205 }, widthM: 145, headingDeg: 59, pylon: "rodeo-25", groundElevM: 0 },
        { id: "g8", type: "gate", center: { lon: -109.367, lat: -27.194 }, widthM: 145, headingDeg: 54, pylon: "rodeo-18", groundElevM: 0 },
        { id: "g9", type: "finish", center: { lon: -109.352, lat: -27.184 }, widthM: 160, headingDeg: 53, pylon: "home", groundElevM: 0 },
      ],
      rules: { pylonSize: "tall" },
    }),
    // Four more from the catalog and one of ours (Lake Tahoe), laid out the same way and not flown
    // yet. At sea the DEM carries the depth, so "on water" there is below 2 m.
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "puerto-varas-lake-oval",
      name: "Puerto Varas Lake Oval",
      author: "XP Pylon Racer",
      description:
        "Two laps of a 7 km oval on Lake Llanquihue, 3.7 km off Puerto Varas, with the Osorno volcano to the north-east: the easiest course here. Fly it counterclockwise and keep every pylon on your left. The start line, on the south side flown east, closes each lap. Take off from El Tepual (SCTE) and fly north-east for 21 km, over Puerto Varas: the start is straight ahead on the lake.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 2,
      // At least 2 km from every shore; the lake at 48 m. Each pylon faces the bisector of its legs.
      gates: [
        { id: "g1", type: "start", center: { lon: -72.945, lat: -41.285 }, widthM: 160, headingDeg: 90, pylon: "green", groundElevM: 48 },
        { id: "g2", type: "turn", center: { lon: -72.93, lat: -41.285 }, widthM: 300, headingDeg: 45, pylon: "rodeo-reno", groundElevM: 48, turnSide: "left" },
        { id: "g3", type: "turn", center: { lon: -72.93, lat: -41.276 }, widthM: 300, headingDeg: 315, pylon: "rodeo-reno", groundElevM: 48, turnSide: "left" },
        { id: "g4", type: "gate", center: { lon: -72.945, lat: -41.276 }, widthM: 160, headingDeg: 270, pylon: "rodeo-25", groundElevM: 48 },
        { id: "g5", type: "turn", center: { lon: -72.96, lat: -41.276 }, widthM: 300, headingDeg: 225, pylon: "rodeo-reno", groundElevM: 48, turnSide: "left" },
        { id: "g6", type: "turn", center: { lon: -72.96, lat: -41.285 }, widthM: 300, headingDeg: 135, pylon: "rodeo-reno", groundElevM: 48, turnSide: "left" },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "general-carrera-lake-race",
      name: "General Carrera Lake Race",
      author: "XP Pylon Racer",
      description:
        "15 km on the turquoise water of Lake General Carrera, off Chile Chico. Take off from Chile Chico (SCCC) and fly north over the town: the start is on the lake 9 km north-north-west of the airport, 2.5 km off the shore, flown east. Four gates east, round a turn pylon kept on your left (6) and back west. 3 and 8 wings level.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // 2.5–4 km off the south shore, open water for 400 m round the whole path. The lake at 206 m
      // (Open-Meteo; the DEM says 201).
      gates: [
        { id: "g1", type: "start", center: { lon: -71.72, lat: -46.505 }, widthM: 160, headingDeg: 90, pylon: "green", groundElevM: 206 },
        { id: "g2", type: "gate", center: { lon: -71.7, lat: -46.507 }, widthM: 145, headingDeg: 88, pylon: "rodeo-18", groundElevM: 206 },
        { id: "g3", type: "level", center: { lon: -71.68, lat: -46.504 }, widthM: 130, headingDeg: 90, pylon: "blue", groundElevM: 206 },
        { id: "g4", type: "gate", center: { lon: -71.66, lat: -46.507 }, widthM: 145, headingDeg: 90, pylon: "rodeo-25", groundElevM: 206 },
        { id: "g5", type: "gate", center: { lon: -71.64, lat: -46.504 }, widthM: 145, headingDeg: 66, pylon: "rodeo-18", groundElevM: 206 },
        { id: "g6", type: "turn", center: { lon: -71.622, lat: -46.495 }, widthM: 250, headingDeg: 360, pylon: "home2", groundElevM: 206, turnSide: "left" },
        { id: "g7", type: "gate", center: { lon: -71.64, lat: -46.486 }, widthM: 145, headingDeg: 283, pylon: "rodeo-25", groundElevM: 206 },
        { id: "g8", type: "level", center: { lon: -71.665, lat: -46.489 }, widthM: 130, headingDeg: 272, pylon: "blue", groundElevM: 206 },
        { id: "g9", type: "gate", center: { lon: -71.69, lat: -46.485 }, widthM: 145, headingDeg: 271, pylon: "rodeo-18", groundElevM: 206 },
        { id: "g10", type: "finish", center: { lon: -71.712, lat: -46.488 }, widthM: 160, headingDeg: 259, pylon: "home", groundElevM: 206 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "heimaey-volcano-island-race",
      name: "Heimaey Volcano Island Race",
      author: "XP Pylon Racer",
      description:
        "17 km on the sea round the south of Heimaey, the volcanic island of the Westman Islands. Take off from Vestmannaeyjar (BIVM): the start is 4 km east-north-east of the airport, flown south-south-west down the east side of the island, between it and the islet of Bjarnarey. Round a turn pylon south of Stórhöfði kept on your left (5) and back north on an outer line, east of Bjarnarey. 3 and 7 wings level.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // 1–2 km off the island, 1.2 km or more from Bjarnarey and the skerries north of the harbor;
      // nothing above the sea within 400 m of the path. Clear of the islets off the west side.
      gates: [
        { id: "g1", type: "start", center: { lon: -20.2, lat: 63.44 }, widthM: 160, headingDeg: 193, pylon: "green", groundElevM: 0 },
        { id: "g2", type: "gate", center: { lon: -20.208, lat: 63.424 }, widthM: 145, headingDeg: 197, pylon: "rodeo-18", groundElevM: 0 },
        { id: "g3", type: "level", center: { lon: -20.22, lat: 63.41 }, widthM: 130, headingDeg: 201, pylon: "blue", groundElevM: 0 },
        { id: "g4", type: "gate", center: { lon: -20.235, lat: 63.393 }, widthM: 145, headingDeg: 206, pylon: "rodeo-25", groundElevM: 0 },
        { id: "g5", type: "turn", center: { lon: -20.255, lat: 63.378 }, widthM: 250, headingDeg: 142, pylon: "home2", groundElevM: 0, turnSide: "left" },
        { id: "g6", type: "gate", center: { lon: -20.212, lat: 63.384 }, widthM: 145, headingDeg: 63, pylon: "rodeo-18", groundElevM: 0 },
        { id: "g7", type: "level", center: { lon: -20.17, lat: 63.398 }, widthM: 130, headingDeg: 44, pylon: "blue", groundElevM: 0 },
        { id: "g8", type: "gate", center: { lon: -20.14, lat: 63.418 }, widthM: 145, headingDeg: 24, pylon: "rodeo-25", groundElevM: 0 },
        { id: "g9", type: "finish", center: { lon: -20.13, lat: 63.437 }, widthM: 160, headingDeg: 13, pylon: "home", groundElevM: 0 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "kauai-coast-challenge",
      name: "Kauai Coast Challenge",
      author: "XP Pylon Racer",
      description:
        "15.7 km on the sea off the east coast of Kauaʻi, past Nawiliwili to the cliffs of Hoary Head. Take off from Līhuʻe (PHLI): the start is 4 km north-east of the airport, 2 km off the coast, flown south. Down the coast, round two turn pylons kept on your left (4, 5) and back north 2.5 km further out. 2 and 7 wings level.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // The inner line 1 km or more off the coast (Ninini Point is the nearest), the turns 2.4 km east
      // of Hoary Head.
      gates: [
        { id: "g1", type: "start", center: { lon: -159.312, lat: 22 }, widthM: 160, headingDeg: 180, pylon: "green", groundElevM: 0 },
        { id: "g2", type: "level", center: { lon: -159.313, lat: 21.981 }, widthM: 130, headingDeg: 184, pylon: "blue", groundElevM: 0 },
        { id: "g3", type: "gate", center: { lon: -159.315, lat: 21.962 }, widthM: 145, headingDeg: 192, pylon: "rodeo-25", groundElevM: 0 },
        { id: "g4", type: "turn", center: { lon: -159.322, lat: 21.942 }, widthM: 250, headingDeg: 143, pylon: "home2", groundElevM: 0, turnSide: "left" },
        { id: "g5", type: "turn", center: { lon: -159.3, lat: 21.943 }, widthM: 250, headingDeg: 57, pylon: "home2", groundElevM: 0, turnSide: "left" },
        { id: "g6", type: "gate", center: { lon: -159.29, lat: 21.962 }, widthM: 145, headingDeg: 16, pylon: "rodeo-18", groundElevM: 0 },
        { id: "g7", type: "level", center: { lon: -159.288, lat: 21.982 }, widthM: 130, headingDeg: 0, pylon: "blue", groundElevM: 0 },
        { id: "g8", type: "finish", center: { lon: -159.29, lat: 22.002 }, widthM: 160, headingDeg: 355, pylon: "home", groundElevM: 0 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "lake-tahoe-emerald-run",
      name: "Lake Tahoe Emerald Run",
      author: "XP Pylon Racer",
      description:
        "15 km on Lake Tahoe, 1,897 m up, toward Emerald Bay. Take off from South Lake Tahoe (KTVL) runway 36: the start is on the lake 8 km north-north-west of the airport, flown west-north-west. Up the west shore past the mouth of Emerald Bay, round a turn pylon kept on your right (5) and back south-east. 2 wings level, 7 knife edge.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Not in the catalog. Outside Emerald Bay (its mouth is 400 m wide), 1.5 km or more from the
      // west shore; the lake at 1,897 m.
      gates: [
        { id: "g1", type: "start", center: { lon: -120.03, lat: 38.963 }, widthM: 160, headingDeg: 294, pylon: "green", groundElevM: 1897 },
        { id: "g2", type: "level", center: { lon: -120.05, lat: 38.97 }, widthM: 130, headingDeg: 300, pylon: "blue", groundElevM: 1897 },
        { id: "g3", type: "gate", center: { lon: -120.068, lat: 38.98 }, widthM: 145, headingDeg: 328, pylon: "rodeo-25", groundElevM: 1897 },
        { id: "g4", type: "gate", center: { lon: -120.072, lat: 38.998 }, widthM: 145, headingDeg: 7, pylon: "rodeo-18", groundElevM: 1897 },
        { id: "g5", type: "turn", center: { lon: -120.062, lat: 39.015 }, widthM: 250, headingDeg: 78, pylon: "home2", groundElevM: 1897, turnSide: "right" },
        { id: "g6", type: "gate", center: { lon: -120.045, lat: 39.003 }, widthM: 145, headingDeg: 139, pylon: "rodeo-25", groundElevM: 1897 },
        { id: "g7", type: "knife", center: { lon: -120.032, lat: 38.988 }, widthM: 130, headingDeg: 145, pylon: "red", groundElevM: 1897 },
        { id: "g8", type: "gate", center: { lon: -120.02, lat: 38.975 }, widthM: 145, headingDeg: 149, pylon: "rodeo-18", groundElevM: 1897 },
        { id: "g9", type: "finish", center: { lon: -120.012, lat: 38.962 }, widthM: 160, headingDeg: 154, pylon: "home", groundElevM: 1897 },
      ],
      rules: { pylonSize: "tall" },
    }),
    // Sixteen prepared by Juan on 2026-10-26 and reviewed here: twelve over land, most of them in
    // valleys and badlands, and four training versions of real air-race courses (Abu Dhabi, Chiba and
    // Porto with the 25 m pylons of those races, Reno with its own). Not flown yet. Each checked on the
    // Terrarium DEM: the elevations match, and where the straight line between two gates crosses a spur the
    // valley round it is open (the description says so).
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "auvergne-volcano-circuit",
      name: "Auvergne Volcano Circuit",
      author: "XP Pylon Racer",
      description:
        "12.4 km round the wooded volcanoes of the Chaîne des Puys, west of Clermont-Ferrand, at about 1,000 m. Take off from Clermont-Ferrand (LFLC) and fly west-south-west for 22 km, up onto the plateau: the start is in open farmland, flown north-north-west. A clockwise loop through the clearings between the puys: round the turn pylons kept on your right (4, 9), 3 and 8 wings level. From 8 to 9 the straight line runs into a wooded hill 100 m high: go round it in the valley. Keep some height over the trees.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Through clearings between the puys, 920–1,065 m. The straight line from 8 to 9 crosses a
      // 109 m hill; the valley round it stays below gate 8.
      gates: [
        { id: "g1", type: "start", center: { lon: 2.91975, lat: 45.701125 }, widthM: 160, headingDeg: 347.37, pylon: "green", groundElevM: 967.1 },
        { id: "g2", type: "gate", center: { lon: 2.91557, lat: 45.71415 }, widthM: 120, headingDeg: 358.13, pylon: "red", groundElevM: 951.5 },
        { id: "g3", type: "level", center: { lon: 2.918, lat: 45.725 }, widthM: 120, headingDeg: 5.73, pylon: "blue", groundElevM: 919.2 },
        { id: "g4", type: "turn", center: { lon: 2.91864, lat: 45.73492 }, widthM: 250, headingDeg: 61.47, pylon: "home2", groundElevM: 955.5, turnSide: "right" },
        { id: "g5", type: "gate", center: { lon: 2.93593, lat: 45.72785 }, widthM: 120, headingDeg: 155.52, pylon: "red", groundElevM: 1021.3 },
        { id: "g6", type: "gate", center: { lon: 2.93285, lat: 45.71645 }, widthM: 120, headingDeg: 143.44, pylon: "red", groundElevM: 1025.8 },
        { id: "g7", type: "gate", center: { lon: 2.94636, lat: 45.715425 }, widthM: 120, headingDeg: 131.9, pylon: "red", groundElevM: 1064.5 },
        { id: "g8", type: "level", center: { lon: 2.95186, lat: 45.69795 }, widthM: 120, headingDeg: 194.45, pylon: "blue", groundElevM: 984.7 },
        { id: "g9", type: "turn", center: { lon: 2.94136, lat: 45.6896 }, widthM: 250, headingDeg: 257.65, pylon: "home2", groundElevM: 975.8, turnSide: "right" },
        { id: "g10", type: "finish", center: { lon: 2.924, lat: 45.695 }, widthM: 160, headingDeg: 294.01, pylon: "home", groundElevM: 981.7 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "bardenas-badlands-race",
      name: "Bardenas Badlands Race",
      author: "XP Pylon Racer",
      description:
        "11.9 km over the white badlands of the Bardena Blanca, in Navarre: flat ground between eroded buttes and mesas, all within 20 m of 290 m. Take off from Ablitas (XLE001L in X-Plane) and fly north-north-east for 22 km: the start is out in the open, flown east-north-east; cross it below 90 m. Knife edge right away at 2, then a counterclockwise loop: turn pylons kept on your left (5, 9) and 8 wings level, just west of the Castildetierra chimney. The thin rock spires may not be in your scenery.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Open ground between the buttes, 280–301 m; nothing on the line rises more than 10 m between
      // gates.
      gates: [
        { id: "g1", type: "start", center: { lon: -1.507, lat: 42.189 }, widthM: 160, headingDeg: 67.13, pylon: "green", groundElevM: 282.2, topM: 90 },
        { id: "g2", type: "knife", center: { lon: -1.491, lat: 42.194 }, widthM: 140, headingDeg: 60.56, pylon: "rgb", groundElevM: 300.7 },
        { id: "g3", type: "gate", center: { lon: -1.478, lat: 42.201 }, widthM: 140, headingDeg: 34.94, pylon: "red", groundElevM: 290.9 },
        { id: "g4", type: "gate", center: { lon: -1.473, lat: 42.214 }, widthM: 140, headingDeg: 352.98, pylon: "red", groundElevM: 298.2 },
        { id: "g5", type: "turn", center: { lon: -1.48, lat: 42.223 }, widthM: 250, headingDeg: 304.08, pylon: "home2", groundElevM: 297.2, turnSide: "left" },
        { id: "g6", type: "gate", center: { lon: -1.499, lat: 42.225 }, widthM: 140, headingDeg: 260.33, pylon: "red", groundElevM: 298.3 },
        { id: "g7", type: "gate", center: { lon: -1.512, lat: 42.22 }, widthM: 140, headingDeg: 227.96, pylon: "red", groundElevM: 288.8 },
        { id: "g8", type: "level", center: { lon: -1.52, lat: 42.211 }, widthM: 140, headingDeg: 209.82, pylon: "blue", groundElevM: 284 },
        { id: "g9", type: "turn", center: { lon: -1.526, lat: 42.202 }, widthM: 250, headingDeg: 189.62, pylon: "home2", groundElevM: 283.1, turnSide: "left" },
        { id: "g10", type: "finish", center: { lon: -1.524, lat: 42.19 }, widthM: 160, headingDeg: 172.96, pylon: "home", groundElevM: 279.8 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "cappadocia-ridge-challenge",
      name: "Cappadocia Ridge Challenge",
      author: "XP Pylon Racer",
      description:
        "13.7 km over the valleys and ridges of Cappadocia, north of Göreme and Ortahisar, from 970 m up to 1,310 m. Take off from Nevşehir Kapadokya (LTAZ) and fly east-south-east for 27 km: the start is in open fields, flown south; cross it below 100 m. Down the western valley (3 wings level), left round 5 and then climb hard: the ground rises 230 m before 6, onto the central ridge. Right round 8 and 11, 10 wings level, and finish north of Ortahisar heading west. The fairy chimneys are off the line and may not be in your scenery.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // From 5 to 6 the ground climbs 228 m in 1.4 km (16 %), the steepest leg of any course here.
      gates: [
        { id: "g1", type: "start", center: { lon: 34.831, lat: 38.694 }, widthM: 160, headingDeg: 180, pylon: "green", groundElevM: 972.1, topM: 100 },
        { id: "g2", type: "gate", center: { lon: 34.831, lat: 38.6815 }, widthM: 120, headingDeg: 177.97, pylon: "red", groundElevM: 1001.3 },
        { id: "g3", type: "level", center: { lon: 34.832, lat: 38.6705 }, widthM: 120, headingDeg: 171.68, pylon: "blue", groundElevM: 1026.2 },
        { id: "g4", type: "gate", center: { lon: 34.835, lat: 38.66 }, widthM: 120, headingDeg: 142.22, pylon: "red", groundElevM: 1052.8 },
        { id: "g5", type: "turn", center: { lon: 34.8473, lat: 38.6551 }, widthM: 250, headingDeg: 90.91, pylon: "home2", groundElevM: 1064.4, turnSide: "left" },
        { id: "g6", type: "gate", center: { lon: 34.862, lat: 38.6605 }, widthM: 120, headingDeg: 72.85, pylon: "red", groundElevM: 1291.9 },
        { id: "g7", type: "gate", center: { lon: 34.874, lat: 38.662 }, widthM: 120, headingDeg: 95.31, pylon: "red", groundElevM: 1310.7 },
        { id: "g8", type: "turn", center: { lon: 34.8865, lat: 38.6585 }, widthM: 250, headingDeg: 147.77, pylon: "home2", groundElevM: 1162, turnSide: "right" },
        { id: "g9", type: "gate", center: { lon: 34.885, lat: 38.647 }, widthM: 120, headingDeg: 195.46, pylon: "red", groundElevM: 1128.1 },
        { id: "g10", type: "level", center: { lon: 34.879, lat: 38.637 }, widthM: 120, headingDeg: 228.13, pylon: "blue", groundElevM: 1191.8 },
        { id: "g11", type: "turn", center: { lon: 34.864, lat: 38.633 }, widthM: 250, headingDeg: 259.27, pylon: "home2", groundElevM: 1244.8, turnSide: "right" },
        { id: "g12", type: "finish", center: { lon: 34.85, lat: 38.6325 }, widthM: 160, headingDeg: 267.39, pylon: "home", groundElevM: 1212.1 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "flinders-valley-run",
      name: "Flinders Valley Run",
      author: "XP Pylon Racer",
      description:
        "14.8 km up the valley east of Rawnsley Bluff, in the Flinders Ranges, and back, with the wall of Wilpena Pound to the west. Take off from Rawnsley Park (YRYK): the start is 2 km east-north-east of the strip, flown north-north-east; cross it below 100 m. North up the west side of the valley, 3 wings level, round the turn pylon at 7 kept on your right, a 136° turnaround, and back south on a separate line, 10 wings level. The ground rises 130 m to the turn.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // 448 m at the start, 581 m at the turn; dry creek beds with trees along them.
      gates: [
        { id: "g1", type: "start", center: { lon: 138.632, lat: -31.647 }, widthM: 160, headingDeg: 16.04, pylon: "green", groundElevM: 448, topM: 100 },
        { id: "g2", type: "gate", center: { lon: 138.63636, lat: -31.63409 }, widthM: 140, headingDeg: 24.8, pylon: "red", groundElevM: 456 },
        { id: "g3", type: "level", center: { lon: 138.645, lat: -31.623 }, widthM: 140, headingDeg: 20.82, pylon: "blue", groundElevM: 471 },
        { id: "g4", type: "gate", center: { lon: 138.647, lat: -31.611 }, widthM: 140, headingDeg: 10.58, pylon: "red", groundElevM: 505 },
        { id: "g5", type: "gate", center: { lon: 138.65, lat: -31.6 }, widthM: 140, headingDeg: 9.1, pylon: "red", groundElevM: 515 },
        { id: "g6", type: "gate", center: { lon: 138.651, lat: -31.5905 }, widthM: 140, headingDeg: 32.36, pylon: "red", groundElevM: 543 },
        { id: "g7", type: "turn", center: { lon: 138.662, lat: -31.585 }, widthM: 250, headingDeg: 127.72, pylon: "home2", groundElevM: 581, turnSide: "right" },
        { id: "g8", type: "gate", center: { lon: 138.65885, lat: -31.59445 }, widthM: 140, headingDeg: 188.54, pylon: "red", groundElevM: 517 },
        { id: "g9", type: "gate", center: { lon: 138.6585, lat: -31.60837 }, widthM: 140, headingDeg: 186.95, pylon: "red", groundElevM: 489 },
        { id: "g10", type: "level", center: { lon: 138.65543, lat: -31.62 }, widthM: 140, headingDeg: 191.33, pylon: "blue", groundElevM: 479 },
        { id: "g11", type: "gate", center: { lon: 138.65243, lat: -31.6345 }, widthM: 140, headingDeg: 194.07, pylon: "red", groundElevM: 474 },
        { id: "g12", type: "finish", center: { lon: 138.648, lat: -31.646 }, widthM: 160, headingDeg: 198.16, pylon: "home", groundElevM: 468 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "gorafe-ravine-run",
      name: "Gorafe Ravine Run",
      author: "XP Pylon Racer",
      description:
        "15.1 km off the plateau and down through the badlands of Gorafe, north-east of Granada, to the red ravines of Los Coloraos. No airfield close by: take off from Granada (LEGR) and fly east-north-east for 73 km. The start is on the plateau, flown north-north-west; cross it below 100 m. It drops 200 m by gate 4 and keeps winding down: turn pylons 4, 7 and 9 on your right, 5, 10, 11 and 12 on your left, 6 wings level. From 9 to 10 and from 11 to 12 the straight line crosses a spur: follow the ravine round it. The course stays west of the river and the reservoir.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // From 973 m on the plateau down to 619 m. The spurs on 9→10 and 11→12 rise 74 m and 64 m over
      // the line; the ravine round them, 34 m and 11 m.
      gates: [
        { id: "g1", type: "start", center: { lon: -3.04, lat: 37.4923 }, widthM: 160, headingDeg: 337.11, pylon: "green", groundElevM: 972.9, topM: 100 },
        { id: "g2", type: "gate", center: { lon: -3.047, lat: 37.50545 }, widthM: 120, headingDeg: 3.97, pylon: "red", groundElevM: 828.9 },
        { id: "g3", type: "gate", center: { lon: -3.0394, lat: 37.51555 }, widthM: 120, headingDeg: 3.9, pylon: "red", groundElevM: 789.2 },
        { id: "g4", type: "turn", center: { lon: -3.045, lat: 37.526 }, widthM: 250, headingDeg: 350.55, pylon: "home2", groundElevM: 772.1, turnSide: "right" },
        { id: "g5", type: "turn", center: { lon: -3.044, lat: 37.537 }, widthM: 250, headingDeg: 336.44, pylon: "home2", groundElevM: 795.8, turnSide: "left" },
        { id: "g6", type: "level", center: { lon: -3.055, lat: 37.544 }, widthM: 120, headingDeg: 308.75, pylon: "blue", groundElevM: 781.1 },
        { id: "g7", type: "turn", center: { lon: -3.066, lat: 37.551 }, widthM: 250, headingDeg: 344.97, pylon: "home2", groundElevM: 701.2, turnSide: "right" },
        { id: "g8", type: "gate", center: { lon: -3.0616, lat: 37.56 }, widthM: 120, headingDeg: 41.04, pylon: "red", groundElevM: 720.9 },
        { id: "g9", type: "turn", center: { lon: -3.048, lat: 37.566 }, widthM: 250, headingDeg: 86.85, pylon: "home2", groundElevM: 689.4, turnSide: "right" },
        { id: "g10", type: "turn", center: { lon: -3.036, lat: 37.562 }, widthM: 250, headingDeg: 96.63, pylon: "home2", groundElevM: 661.1, turnSide: "left" },
        { id: "g11", type: "turn", center: { lon: -3.021, lat: 37.564 }, widthM: 250, headingDeg: 44.73, pylon: "home2", groundElevM: 619.1, turnSide: "left" },
        { id: "g12", type: "turn", center: { lon: -3.019, lat: 37.574 }, widthM: 250, headingDeg: 348.09, pylon: "home2", groundElevM: 649.6, turnSide: "left" },
        { id: "g13", type: "finish", center: { lon: -3.026, lat: 37.5826 }, widthM: 160, headingDeg: 327.18, pylon: "home", groundElevM: 664.6 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "lindis-pass-traverse",
      name: "Lindis Pass Traverse",
      author: "XP Pylon Racer",
      description:
        "13.1 km over Lindis Pass, in the tussock hills between Wanaka and Omarama: from 700 m over a spur at 1,070 m (6), across the saddle (7) and down the far side. Take off from Wanaka (NZWF) and fly east-north-east for 30 km: the start is in a side valley south-west of the pass, flown east-north-east; cross it below 100 m. A climb of 375 m in the first 4.5 km, then turn pylons 5, 9 and 10 on your right and 7 and 11 on your left, 13 wings level. The valley walls rise 150 m either side.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // The road's saddle is gate 7 (971 m). Walls rise 100–170 m within 250 m of the path on 4→7 and
      // 9→11.
      gates: [
        { id: "g1", type: "start", center: { lon: 169.6014, lat: -44.6203 }, widthM: 160, headingDeg: 71.4, pylon: "green", groundElevM: 696.9, topM: 100 },
        { id: "g2", type: "gate", center: { lon: 169.6135, lat: -44.6174 }, widthM: 120, headingDeg: 56.74, pylon: "red", groundElevM: 734 },
        { id: "g3", type: "gate", center: { lon: 169.6187, lat: -44.6133 }, widthM: 120, headingDeg: 32.72, pylon: "red", groundElevM: 814 },
        { id: "g4", type: "gate", center: { lon: 169.6234, lat: -44.60555 }, widthM: 120, headingDeg: 29.52, pylon: "red", groundElevM: 921.7 },
        { id: "g5", type: "turn", center: { lon: 169.629, lat: -44.6 }, widthM: 250, headingDeg: 40.38, pylon: "home2", groundElevM: 993.2, turnSide: "right" },
        { id: "g6", type: "gate", center: { lon: 169.6366, lat: -44.5946 }, widthM: 120, headingDeg: 48.01, pylon: "red", groundElevM: 1072.1 },
        { id: "g7", type: "turn", center: { lon: 169.6482, lat: -44.5879 }, widthM: 250, headingDeg: 35.04, pylon: "home2", groundElevM: 970.9, turnSide: "left" },
        { id: "g8", type: "gate", center: { lon: 169.6528, lat: -44.57845 }, widthM: 120, headingDeg: 18.23, pylon: "red", groundElevM: 858.8 },
        { id: "g9", type: "turn", center: { lon: 169.6574, lat: -44.56795 }, widthM: 250, headingDeg: 34.64, pylon: "home2", groundElevM: 838.1, turnSide: "right" },
        { id: "g10", type: "turn", center: { lon: 169.673, lat: -44.55925 }, widthM: 250, headingDeg: 78.48, pylon: "home2", groundElevM: 792.9, turnSide: "right" },
        { id: "g11", type: "turn", center: { lon: 169.6874, lat: -44.562 }, widthM: 250, headingDeg: 60.33, pylon: "home2", groundElevM: 743.2, turnSide: "left" },
        { id: "g12", type: "gate", center: { lon: 169.6897, lat: -44.55615 }, widthM: 120, headingDeg: 26.48, pylon: "red", groundElevM: 731.1 },
        { id: "g13", type: "level", center: { lon: 169.6982, lat: -44.5482 }, widthM: 120, headingDeg: 45.99, pylon: "blue", groundElevM: 700.1 },
        { id: "g14", type: "finish", center: { lon: 169.7076, lat: -44.54345 }, widthM: 160, headingDeg: 54.67, pylon: "home", groundElevM: 738.6 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "namib-dune-run",
      name: "Namib Dune Run",
      author: "XP Pylon Racer",
      description:
        "15.2 km over the gravel plains and red dunes of Elim, just north of Sesriem, where the road to Sossusvlei begins. Take off from Sesriem (FYSS): the start is 1.5 km north of the strip, flown north-west; cross it below 90 m. North-east along the southern edge of the dunes, 5 wings level, round the turn pylon at 7 kept on your right and back south-west across the open plain, 9 wings level. The ground rises 90 m to the turn.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Along the south of the Elim dune, 747–836 m; nothing on the line more than 17 m above the
      // gates.
      gates: [
        { id: "g1", type: "start", center: { lon: 15.748, lat: -24.5 }, widthM: 160, headingDeg: 323.33, pylon: "green", groundElevM: 751, topM: 90 },
        { id: "g2", type: "gate", center: { lon: 15.739, lat: -24.489 }, widthM: 140, headingDeg: 7.35, pylon: "red", groundElevM: 747 },
        { id: "g3", type: "gate", center: { lon: 15.75, lat: -24.481 }, widthM: 140, headingDeg: 53.99, pylon: "red", groundElevM: 752 },
        { id: "g4", type: "gate", center: { lon: 15.76, lat: -24.475 }, widthM: 140, headingDeg: 52.07, pylon: "red", groundElevM: 773 },
        { id: "g5", type: "level", center: { lon: 15.772, lat: -24.465 }, widthM: 140, headingDeg: 52.44, pylon: "blue", groundElevM: 802 },
        { id: "g6", type: "gate", center: { lon: 15.784, lat: -24.458 }, widthM: 140, headingDeg: 80.3, pylon: "red", groundElevM: 824 },
        { id: "g7", type: "turn", center: { lon: 15.798, lat: -24.461 }, widthM: 250, headingDeg: 135.22, pylon: "home2", groundElevM: 836, turnSide: "right" },
        { id: "g8", type: "gate", center: { lon: 15.801, lat: -24.473 }, widthM: 140, headingDeg: 200.06, pylon: "red", groundElevM: 805 },
        { id: "g9", type: "level", center: { lon: 15.785, lat: -24.484 }, widthM: 140, headingDeg: 237.89, pylon: "blue", groundElevM: 773 },
        { id: "g10", type: "gate", center: { lon: 15.77, lat: -24.491 }, widthM: 140, headingDeg: 224.62, pylon: "red", groundElevM: 764 },
        { id: "g11", type: "finish", center: { lon: 15.764, lat: -24.502 }, widthM: 160, headingDeg: 206.4, pylon: "home", groundElevM: 762 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "orkhon-steppe-circuit",
      name: "Orkhon Steppe Circuit",
      author: "XP Pylon Racer",
      description:
        "Two laps of an 8.1 km loop on the open steppe of the Orkhon valley, north of Kharkhorin, near the old Mongol capital, at 1,440 m. Take off from Kharkhorin (ZMHH): the start is 2 km north of the field, flown east-south-east; cross it below 100 m every time. Fly it counterclockwise and keep the turn pylons on your left (3, 5, 7); 4 and 8 wings level. The start line closes each lap. Flat as a table, but the air is thin: watch your climb.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 2,
      // Flat within 8 m round the whole loop; the river west of the course.
      gates: [
        { id: "g1", type: "start", center: { lon: 102.825, lat: 47.263 }, widthM: 180, headingDeg: 106.13, pylon: "green", groundElevM: 1447, topM: 100 },
        { id: "g2", type: "gate", center: { lon: 102.836, lat: 47.263 }, widthM: 160, headingDeg: 67.75, pylon: "red", groundElevM: 1444 },
        { id: "g3", type: "turn", center: { lon: 102.845, lat: 47.269 }, widthM: 250, headingDeg: 22.75, pylon: "home2", groundElevM: 1445, turnSide: "left" },
        { id: "g4", type: "level", center: { lon: 102.845, lat: 47.278 }, widthM: 160, headingDeg: 339.37, pylon: "blue", groundElevM: 1441 },
        { id: "g5", type: "turn", center: { lon: 102.8375, lat: 47.2838 }, widthM: 250, headingDeg: 294.91, pylon: "home2", groundElevM: 1441, turnSide: "left" },
        { id: "g6", type: "gate", center: { lon: 102.8216, lat: 47.284 }, widthM: 160, headingDeg: 250.62, pylon: "red", groundElevM: 1439 },
        { id: "g7", type: "turn", center: { lon: 102.811, lat: 47.278 }, widthM: 250, headingDeg: 205.08, pylon: "home2", groundElevM: 1441, turnSide: "left" },
        { id: "g8", type: "level", center: { lon: 102.811, lat: 47.269 }, widthM: 160, headingDeg: 151.13, pylon: "blue", groundElevM: 1447 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "osorno-spiral-ascent",
      name: "Osorno Spiral Ascent",
      author: "XP Pylon Racer",
      description:
        "A climb in a spiral round the Osorno volcano: two turns with the mountain on your left, 24 km from 950 m on the south-west slope to the finish on the summit at 2,660 m. Take off from El Tepual (SCTE) and fly north-east for 57 km, across Lake Llanquihue: the start is on the lower slope, flown east. Keep every pylon on your left, passing on the outside, within 500 m, and be at least 80 m above the ground at every pylon and at the finish. No ceiling: climb early. The last turns are tight and steep: be at about 2,800 m before pylon 33, since the finish is 170 m above it and only 360 m away. It takes an aircraft that climbs well up high.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // 34 gates, 33 of them turn pylons. On the lower slope the straight lines cross lava ridges up
      // to 100 m high; a route round each stays within 7 m of the higher pylon.
      gates: [
        { id: "g1", type: "start", center: { lon: -72.5383914, lat: -41.1365794 }, widthM: 120, headingDeg: 79.2, pylon: "green", groundElevM: 952, bottomM: 80 },
        { id: "g2", type: "turn", center: { lon: -72.511502, lat: -41.1327201 }, widthM: 500, headingDeg: 74.1, pylon: "rodeo-25", groundElevM: 997, bottomM: 80, turnSide: "left" },
        { id: "g3", type: "turn", center: { lon: -72.49611, lat: -41.1282822 }, widthM: 500, headingDeg: 84.3, pylon: "rodeo-25", groundElevM: 1047, bottomM: 80, turnSide: "left" },
        { id: "g4", type: "turn", center: { lon: -72.4821795, lat: -41.1300614 }, widthM: 500, headingDeg: 69.2, pylon: "rodeo-25", groundElevM: 1096, bottomM: 80, turnSide: "left" },
        { id: "g5", type: "turn", center: { lon: -72.473408, lat: -41.1218261 }, widthM: 500, headingDeg: 33.8, pylon: "rodeo-25", groundElevM: 1141, bottomM: 80, turnSide: "left" },
        { id: "g6", type: "turn", center: { lon: -72.4674408, lat: -41.113668 }, widthM: 500, headingDeg: 22.5, pylon: "rodeo-25", groundElevM: 1198, bottomM: 80, turnSide: "left" },
        { id: "g7", type: "turn", center: { lon: -72.4640046, lat: -41.10472 }, widthM: 500, headingDeg: 7.1, pylon: "rodeo-25", groundElevM: 1241, bottomM: 80, turnSide: "left" },
        { id: "g8", type: "turn", center: { lon: -72.4644637, lat: -41.0948427 }, widthM: 500, headingDeg: 334.4, pylon: "rodeo-25", groundElevM: 1289, bottomM: 80, turnSide: "left" },
        { id: "g9", type: "turn", center: { lon: -72.4744208, lat: -41.088377 }, widthM: 500, headingDeg: 304.4, pylon: "rodeo-25", groundElevM: 1333, bottomM: 80, turnSide: "left" },
        { id: "g10", type: "turn", center: { lon: -72.4848286, lat: -41.0841977 }, widthM: 500, headingDeg: 289.1, pylon: "rodeo-25", groundElevM: 1382, bottomM: 80, turnSide: "left" },
        { id: "g11", type: "turn", center: { lon: -72.49611, lat: -41.0826866 }, widthM: 500, headingDeg: 267.6, pylon: "rodeo-25", groundElevM: 1440, bottomM: 80, turnSide: "left" },
        { id: "g12", type: "turn", center: { lon: -72.507026, lat: -41.0848623 }, widthM: 500, headingDeg: 240.8, pylon: "rodeo-25", groundElevM: 1485, bottomM: 80, turnSide: "left" },
        { id: "g13", type: "turn", center: { lon: -72.5149298, lat: -41.0905391 }, widthM: 500, headingDeg: 230.8, pylon: "rodeo-25", groundElevM: 1530, bottomM: 80, turnSide: "left" },
        { id: "g14", type: "turn", center: { lon: -72.5248894, lat: -41.0957375 }, widthM: 500, headingDeg: 209.3, pylon: "rodeo-25", groundElevM: 1581, bottomM: 80, turnSide: "left" },
        { id: "g15", type: "turn", center: { lon: -72.5255897, lat: -41.10472 }, widthM: 500, headingDeg: 168.3, pylon: "rodeo-25", groundElevM: 1626, bottomM: 80, turnSide: "left" },
        { id: "g16", type: "turn", center: { lon: -72.5204788, lat: -41.1123258 }, widthM: 500, headingDeg: 128, pylon: "rodeo-25", groundElevM: 1679, bottomM: 80, turnSide: "left" },
        { id: "g17", type: "turn", center: { lon: -72.5088535, lat: -41.1143223 }, widthM: 500, headingDeg: 106.4, pylon: "rodeo-25", groundElevM: 1720, bottomM: 80, turnSide: "left" },
        { id: "g18", type: "turn", center: { lon: -72.5023673, lat: -41.1161028 }, widthM: 500, headingDeg: 101.9, pylon: "rodeo-25", groundElevM: 1776, bottomM: 80, turnSide: "left" },
        { id: "g19", type: "turn", center: { lon: -72.49611, lat: -41.1164112 }, widthM: 500, headingDeg: 83.4, pylon: "rodeo-25", groundElevM: 1818, bottomM: 80, turnSide: "left" },
        { id: "g20", type: "turn", center: { lon: -72.4904008, lat: -41.1151058 }, widthM: 500, headingDeg: 58.2, pylon: "rodeo-25", groundElevM: 1863, bottomM: 80, turnSide: "left" },
        { id: "g21", type: "turn", center: { lon: -72.4864891, lat: -41.1119694 }, widthM: 500, headingDeg: 32, pylon: "rodeo-25", groundElevM: 1925, bottomM: 80, turnSide: "left" },
        { id: "g22", type: "turn", center: { lon: -72.4846423, lat: -41.1082992 }, widthM: 500, headingDeg: 14.6, pylon: "rodeo-25", groundElevM: 1965, bottomM: 80, turnSide: "left" },
        { id: "g23", type: "turn", center: { lon: -72.4839362, lat: -41.10472 }, widthM: 500, headingDeg: 357.9, pylon: "rodeo-25", groundElevM: 2011, bottomM: 80, turnSide: "left" },
        { id: "g24", type: "turn", center: { lon: -72.4849731, lat: -41.101244 }, widthM: 500, headingDeg: 329.5, pylon: "rodeo-25", groundElevM: 2068, bottomM: 80, turnSide: "left" },
        { id: "g25", type: "turn", center: { lon: -72.4884302, lat: -41.0989332 }, widthM: 500, headingDeg: 307.7, pylon: "rodeo-25", groundElevM: 2114, bottomM: 80, turnSide: "left" },
        { id: "g26", type: "turn", center: { lon: -72.4919537, lat: -41.0971591 }, widthM: 500, headingDeg: 279.6, pylon: "rodeo-25", groundElevM: 2166, bottomM: 80, turnSide: "left" },
        { id: "g27", type: "turn", center: { lon: -72.49611, lat: -41.0979751 }, widthM: 500, headingDeg: 248.2, pylon: "rodeo-25", groundElevM: 2198, bottomM: 80, turnSide: "left" },
        { id: "g28", type: "turn", center: { lon: -72.4991245, lat: -41.0992363 }, widthM: 500, headingDeg: 233, pylon: "rodeo-25", groundElevM: 2246, bottomM: 80, turnSide: "left" },
        { id: "g29", type: "turn", center: { lon: -72.501258, lat: -41.1008409 }, widthM: 500, headingDeg: 213.3, pylon: "rodeo-25", groundElevM: 2309, bottomM: 80, turnSide: "left" },
        { id: "g30", type: "turn", center: { lon: -72.5022849, lat: -41.1027927 }, widthM: 500, headingDeg: 187.2, pylon: "rodeo-25", groundElevM: 2353, bottomM: 80, turnSide: "left" },
        { id: "g31", type: "turn", center: { lon: -72.5019582, lat: -41.10472 }, widthM: 500, headingDeg: 157.3, pylon: "rodeo-25", groundElevM: 2410, bottomM: 80, turnSide: "left" },
        { id: "g32", type: "turn", center: { lon: -72.5005206, lat: -41.1060966 }, widthM: 500, headingDeg: 136.6, pylon: "rodeo-25", groundElevM: 2460, bottomM: 80, turnSide: "left" },
        { id: "g33", type: "turn", center: { lon: -72.4991482, lat: -41.1070093 }, widthM: 500, headingDeg: 88.2, pylon: "rodeo-25", groundElevM: 2493, bottomM: 80, turnSide: "left" },
        { id: "g34", type: "finish", center: { lon: -72.49611, lat: -41.10472 }, widthM: 80, headingDeg: 45, pylon: "home", groundElevM: 2660, bottomM: 80 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "quebrada-de-las-conchas-run",
      name: "Quebrada de las Conchas Run",
      author: "XP Pylon Racer",
      description:
        "13.9 km up the Quebrada de las Conchas, the red canyon of the Río de las Conchas north of Cafayate, at about 1,450 m. Take off from Cafayate (SA02) and fly north-east for 26 km along the valley: the start is on the dry terraces west of the river, flown north-north-east; cross it below 100 m. Eight turn pylons mark the bends and spurs: 2, 3, 5, 7 and 9 on your left, 4, 8 and 11 on your right; no wings-level gates. The straight line between pylons often crosses a spur 100–150 m high: follow the valley round it. The rock formations are off the line.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Spurs of 148, 121, 88 and 140 m on the straight lines 4→5, 7→8, 8→9 and 10→11; the valley
      // round each stays within 12 m of the higher pylon.
      gates: [
        { id: "g1", type: "start", center: { lon: -65.724, lat: -25.919 }, widthM: 160, headingDeg: 15.1, pylon: "green", groundElevM: 1462, topM: 100 },
        { id: "g2", type: "turn", center: { lon: -65.721, lat: -25.909 }, widthM: 250, headingDeg: 351.8, pylon: "home2", groundElevM: 1480, turnSide: "left" },
        { id: "g3", type: "turn", center: { lon: -65.7288, lat: -25.89755 }, widthM: 250, headingDeg: 319.76, pylon: "home2", groundElevM: 1551, turnSide: "left" },
        { id: "g4", type: "turn", center: { lon: -65.741, lat: -25.888 }, widthM: 250, headingDeg: 7.83, pylon: "home2", groundElevM: 1539, turnSide: "right" },
        { id: "g5", type: "turn", center: { lon: -65.724, lat: -25.88075 }, widthM: 250, headingDeg: 56.09, pylon: "home2", groundElevM: 1473, turnSide: "left" },
        { id: "g6", type: "gate", center: { lon: -65.7158, lat: -25.874 }, widthM: 120, headingDeg: 26.34, pylon: "red", groundElevM: 1413 },
        { id: "g7", type: "turn", center: { lon: -65.715, lat: -25.866 }, widthM: 250, headingDeg: 355.87, pylon: "home2", groundElevM: 1447, turnSide: "left" },
        { id: "g8", type: "turn", center: { lon: -65.7168, lat: -25.8592 }, widthM: 250, headingDeg: 14.29, pylon: "home2", groundElevM: 1445, turnSide: "right" },
        { id: "g9", type: "turn", center: { lon: -65.7088, lat: -25.8512 }, widthM: 250, headingDeg: 24.95, pylon: "home2", groundElevM: 1456, turnSide: "left" },
        { id: "g10", type: "gate", center: { lon: -65.707, lat: -25.83955 }, widthM: 120, headingDeg: 340.94, pylon: "red", groundElevM: 1412 },
        { id: "g11", type: "turn", center: { lon: -65.718, lat: -25.83 }, widthM: 250, headingDeg: 351.82, pylon: "home2", groundElevM: 1474, turnSide: "right" },
        { id: "g12", type: "finish", center: { lon: -65.7136, lat: -25.82305 }, widthM: 160, headingDeg: 29.68, pylon: "home", groundElevM: 1467 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "san-rafael-desert-run",
      name: "San Rafael Desert Run",
      author: "XP Pylon Racer",
      description:
        "16 km on the open desert below the San Rafael Reef, beside Goblin Valley, Utah, at about 1,500 m. Take off from Hanksville (KHVE) and fly north for 18 km: the start is flown north-north-east; cross it below 100 m. A clockwise loop: turn pylons kept on your right (4, 7, 8), 3 and 10 wings level. From 7 to 8 you fly beside a 150 m rock wall. The low ridges and dry washes rise and fall 100 m: don't hold one altitude.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // 1,475–1,576 m. On 7→8 the ground rises 148 m within 250 m of the line.
      gates: [
        { id: "g1", type: "start", center: { lon: -110.698, lat: 38.582 }, widthM: 160, headingDeg: 26.44, pylon: "green", groundElevM: 1502.9, topM: 100 },
        { id: "g2", type: "gate", center: { lon: -110.691, lat: 38.593 }, widthM: 120, headingDeg: 35.06, pylon: "red", groundElevM: 1530.1 },
        { id: "g3", type: "level", center: { lon: -110.68, lat: 38.602 }, widthM: 120, headingDeg: 56.53, pylon: "blue", groundElevM: 1543.3 },
        { id: "g4", type: "turn", center: { lon: -110.663, lat: 38.607 }, widthM: 250, headingDeg: 85.7, pylon: "home2", groundElevM: 1575.7, turnSide: "right" },
        { id: "g5", type: "gate", center: { lon: -110.645, lat: 38.604 }, widthM: 120, headingDeg: 108.83, pylon: "red", groundElevM: 1567.5 },
        { id: "g6", type: "gate", center: { lon: -110.629, lat: 38.598 }, widthM: 120, headingDeg: 128.81, pylon: "red", groundElevM: 1569.9 },
        { id: "g7", type: "turn", center: { lon: -110.618, lat: 38.587 }, widthM: 250, headingDeg: 175.34, pylon: "home2", groundElevM: 1550.5, turnSide: "right" },
        { id: "g8", type: "turn", center: { lon: -110.625, lat: 38.577 }, widthM: 250, headingDeg: 229.57, pylon: "home2", groundElevM: 1553.4, turnSide: "right" },
        { id: "g9", type: "gate", center: { lon: -110.643, lat: 38.572 }, widthM: 120, headingDeg: 264.27, pylon: "red", groundElevM: 1496.4 },
        { id: "g10", type: "level", center: { lon: -110.661, lat: 38.574 }, widthM: 120, headingDeg: 266.87, pylon: "blue", groundElevM: 1487.8 },
        { id: "g11", type: "gate", center: { lon: -110.676, lat: 38.571 }, widthM: 120, headingDeg: 260.02, pylon: "red", groundElevM: 1489.7 },
        { id: "g12", type: "finish", center: { lon: -110.689, lat: 38.57 }, widthM: 160, headingDeg: 264.38, pylon: "home", groundElevM: 1475.3 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "swaledale-valley-sprint",
      name: "Swaledale Valley Sprint",
      author: "XP Pylon Racer",
      description:
        "12.9 km up Swaledale, in the Yorkshire Dales, from the fields by Reeth to the meadows by Muker, following the bends of the river at about 200 m. Take off from RAF Leeming (EGXE) and fly west-north-west for 29 km into the Dales: the start is flown west; cross it below 100 m. No turn pylons, just gates along the valley: 3 and 10 wings level, 7 between 40 and 90 m. Mind the stone walls, the trees and the fells either side.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // The valley floor from 181 to 255 m, fells 35–75 m above the path within 250 m.
      gates: [
        { id: "g1", type: "start", center: { lon: -1.95325, lat: 54.3848 }, widthM: 160, headingDeg: 268.43, pylon: "green", groundElevM: 181.5, topM: 100 },
        { id: "g2", type: "gate", center: { lon: -1.972, lat: 54.3845 }, widthM: 140, headingDeg: 261.65, pylon: "red", groundElevM: 184.6 },
        { id: "g3", type: "level", center: { lon: -1.9885, lat: 54.3819 }, widthM: 140, headingDeg: 256.96, pylon: "blue", groundElevM: 188.4 },
        { id: "g4", type: "gate", center: { lon: -2.00535, lat: 54.38 }, widthM: 140, headingDeg: 255.12, pylon: "red", groundElevM: 194.6 },
        { id: "g5", type: "gate", center: { lon: -2.025, lat: 54.3761 }, widthM: 140, headingDeg: 242.87, pylon: "red", groundElevM: 195 },
        { id: "g6", type: "gate", center: { lon: -2.0385, lat: 54.3705 }, widthM: 120, headingDeg: 258.48, pylon: "red", groundElevM: 203.5 },
        { id: "g7", type: "gate", center: { lon: -2.058, lat: 54.373 }, widthM: 140, headingDeg: 286.54, pylon: "red", groundElevM: 206.5, topM: 90, bottomM: 40 },
        { id: "g8", type: "gate", center: { lon: -2.07485, lat: 54.3767 }, widthM: 140, headingDeg: 281.96, pylon: "red", groundElevM: 217.9 },
        { id: "g9", type: "gate", center: { lon: -2.096, lat: 54.3774 }, widthM: 140, headingDeg: 263.45, pylon: "red", groundElevM: 234 },
        { id: "g10", type: "level", center: { lon: -2.115, lat: 54.37415 }, widthM: 140, headingDeg: 270.16, pylon: "blue", groundElevM: 235.2 },
        { id: "g11", type: "gate", center: { lon: -2.13307, lat: 54.3773 }, widthM: 120, headingDeg: 267.49, pylon: "red", groundElevM: 238 },
        { id: "g12", type: "finish", center: { lon: -2.143, lat: 54.375 }, widthM: 160, headingDeg: 248.32, pylon: "home", groundElevM: 254.6 },
      ],
      rules: { pylonSize: "tall" },
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "abu-dhabi-2014-training",
      name: "Abu Dhabi 2014 — Training",
      author: "XP Pylon Racer",
      description:
        "A short training version of the 2014 Red Bull Air Race on the water off the Corniche in Abu Dhabi, after the gate positions published by TU Delft: 2.3 km of 40 m gates and 25 m pylons, all flown between 15 and 25 m. Take off from Al Bateen (OMAD) and fly west-north-west along the coast for 14 km: the start is offshore, flown west-south-west. Slalom through 2, 3 and 4 (keep them left, right, left), turn left after 5 for three wings-level gates (6, 7, 8), round 9 kept on your left and finish heading north-west.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Standard pylons, as in the real race. The gates widened to 40 m; the finish (10) added 250 m
      // past the last pylon; gate 5 turned for a flat turn instead of the vertical one.
      gates: [
        { id: "g1", type: "start", center: { lon: 54.3316333, lat: 24.4744472 }, widthM: 40, headingDeg: 247, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g2", type: "turn", center: { lon: 54.3298323, lat: 24.4733337 }, widthM: 60, headingDeg: 230, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "left" },
        { id: "g3", type: "turn", center: { lon: 54.3288861, lat: 24.4726111 }, widthM: 60, headingDeg: 230, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "right" },
        { id: "g4", type: "turn", center: { lon: 54.32794, lat: 24.4718885 }, widthM: 60, headingDeg: 230, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "left" },
        { id: "g5", type: "gate", center: { lon: 54.3262056, lat: 24.4691639 }, widthM: 40, headingDeg: 145, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g6", type: "level", center: { lon: 54.3294806, lat: 24.46985 }, widthM: 40, headingDeg: 55, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g7", type: "level", center: { lon: 54.33095, lat: 24.4716528 }, widthM: 40, headingDeg: 53, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g8", type: "level", center: { lon: 54.3339444, lat: 24.4723556 }, widthM: 40, headingDeg: 56, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g9", type: "turn", center: { lon: 54.3344694, lat: 24.4749889 }, widthM: 100, headingDeg: 335, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "left" },
        { id: "g10", type: "finish", center: { lon: 54.3323301, lat: 24.476113 }, widthM: 40, headingDeg: 300, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "chiba-2019-training",
      name: "Chiba 2019 — Training",
      author: "XP Pylon Racer",
      description:
        "A short training version of the 2019 Red Bull Air Race off Makuhari Beach, Chiba: 1.6 km of 40 m gates and 25 m pylons, all flown between 15 and 25 m. Positions are approximate, rebuilt from the event maps. Take off from Haneda (RJTT) and fly east-north-east across Tokyo Bay for 25 km: the start is offshore south-east of ZOZO Marine Stadium, flown north-west. 2 wings level, slalom through 3, 4 and 5 (keep them left, right, left), round 6 kept on your right, through 7 and turn right to finish heading east-south-east.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Standard pylons. One pass through each gate: the race's return legs and second lap are left
      // out.
      gates: [
        { id: "g1", type: "start", center: { lon: 140.0317949, lat: 35.6390225 }, widthM: 40, headingDeg: 322, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g2", type: "level", center: { lon: 140.0293615, lat: 35.6415626 }, widthM: 40, headingDeg: 320, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g3", type: "turn", center: { lon: 140.0280982, lat: 35.6427175 }, widthM: 60, headingDeg: 310, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "left" },
        { id: "g4", type: "turn", center: { lon: 140.0270385, lat: 35.6434401 }, widthM: 60, headingDeg: 310, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "right" },
        { id: "g5", type: "turn", center: { lon: 140.0259788, lat: 35.6441627 }, widthM: 60, headingDeg: 310, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "left" },
        { id: "g6", type: "turn", center: { lon: 140.0228908, lat: 35.64439 }, widthM: 100, headingDeg: 307, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "right" },
        { id: "g7", type: "gate", center: { lon: 140.0217316, lat: 35.6467651 }, widthM: 40, headingDeg: 48, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g8", type: "finish", center: { lon: 140.0247374, lat: 35.6454788 }, widthM: 40, headingDeg: 118, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "porto-2017-training",
      name: "Porto 2017 — Training",
      author: "XP Pylon Racer",
      description:
        "A short training version of the 2017 Red Bull Air Race on the Douro, between Porto and Vila Nova de Gaia: 1.75 km upstream, 40 m gates and 25 m pylons, all flown between 15 and 25 m. Positions are approximate, rebuilt from the event images. Take off from Porto (LPPR) and fly south-south-east for 12 km to the river, then upstream past the Arrábida bridge: the start is 700 m beyond it, flown east. 2 and 6 wings level, slalom through 3, 4 and 5 (keep them left, right, left) and finish heading east. Pull up straight after the finish: the Luís I bridge is 250 m ahead.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 1,
      // Standard pylons, on the river (the DEM gives 2 m). The race's return legs and end turns are
      // left out.
      gates: [
        { id: "g1", type: "start", center: { lon: -8.6318, lat: 41.1443 }, widthM: 40, headingDeg: 100, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g2", type: "level", center: { lon: -8.6267, lat: 41.14365 }, widthM: 40, headingDeg: 107, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g3", type: "turn", center: { lon: -8.6238, lat: 41.1429 }, widthM: 60, headingDeg: 114, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "left" },
        { id: "g4", type: "turn", center: { lon: -8.622, lat: 41.1422 }, widthM: 60, headingDeg: 121, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "right" },
        { id: "g5", type: "turn", center: { lon: -8.6202, lat: 41.1413 }, widthM: 60, headingDeg: 125, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15, turnSide: "left" },
        { id: "g6", type: "level", center: { lon: -8.617, lat: 41.1397 }, widthM: 40, headingDeg: 108, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
        { id: "g7", type: "finish", center: { lon: -8.6124, lat: 41.1396 }, widthM: 40, headingDeg: 92, pylon: "rodeo-25", groundElevM: 0, topM: 25, bottomM: 15 },
      ],
    }),
    parseCourse({
      format: COURSE_FORMAT,
      version: COURSE_VERSION,
      id: "reno-sport-2023-training",
      name: "Reno Sport 2023 — Training",
      author: "XP Pylon Racer",
      description:
        "The Sport class course of the Reno air races at Stead, rebuilt from the 2023 Sport class manual: two counterclockwise laps of about 12 km. Take off from Reno Stead (KRTS): the Home gate is on the field, flown east, and closes each lap. Keep every pylon on your left, passing outside within 250 m: outer pylons 2–4, the blue Sport pylons 5–7, outer pylons 8–10. Stay between 15 and 76 m (50–250 ft) at every pylon. The long leg from 4 to 5 crosses rising ground. Not the six-lap race itself: the pylons are estimated, not surveyed.",
      createdAt: "2026-10-26T00:00:00Z",
      updatedAt: "2026-10-26T00:00:00Z",
      laps: 2,
      // Reno's 15 m pylons, standard size. Positions estimated by hand from the manual's map; the lap
      // is shorter than the published race distance.
      gates: [
        { id: "g1", type: "start", center: { lon: -119.8764691, lat: 39.6653679 }, widthM: 80, headingDeg: 95, pylon: "rodeo-reno", groundElevM: 1532, topM: 76.2, bottomM: 15.24 },
        { id: "g2", type: "turn", center: { lon: -119.8700305, lat: 39.6651418 }, widthM: 250, headingDeg: 77, pylon: "rodeo-reno", groundElevM: 1536, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g3", type: "turn", center: { lon: -119.860588, lat: 39.669267 }, widthM: 250, headingDeg: 37, pylon: "rodeo-reno", groundElevM: 1548, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g4", type: "turn", center: { lon: -119.8574921, lat: 39.6793596 }, widthM: 250, headingDeg: 348, pylon: "rodeo-reno", groundElevM: 1548, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g5", type: "turn", center: { lon: -119.876996, lat: 39.6995563 }, widthM: 250, headingDeg: 297, pylon: "blue", groundElevM: 1546, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g6", type: "turn", center: { lon: -119.8903096, lat: 39.6994962 }, widthM: 250, headingDeg: 238, pylon: "blue", groundElevM: 1541, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g7", type: "turn", center: { lon: -119.9009572, lat: 39.6827354 }, widthM: 250, headingDeg: 191, pylon: "blue", groundElevM: 1532, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g8", type: "turn", center: { lon: -119.9002381, lat: 39.674191 }, widthM: 250, headingDeg: 159, pylon: "rodeo-reno", groundElevM: 1526, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g9", type: "turn", center: { lon: -119.8948733, lat: 39.6688569 }, widthM: 250, headingDeg: 127, pylon: "rodeo-reno", groundElevM: 1522, topM: 76.2, bottomM: 15.24, turnSide: "left" },
        { id: "g10", type: "turn", center: { lon: -119.8871956, lat: 39.6664677 }, widthM: 250, headingDeg: 105, pylon: "rodeo-reno", groundElevM: 1524, topM: 76.2, bottomM: 15.24, turnSide: "left" },
      ],
    }),
  ];
}
