// What the app says when X-Plane streams but its positions are not raced: the top bar's pill, the
// list before the start and the status line share these words.

/** Another program keeps taking RPOS (TelemetryStatus.rpos.shared). */
export const RPOS_SHARED =
  "another program is taking X-Plane's position (RPOS), and X-Plane sends it to only one: close that program, or switch it to another X-Plane output. The app takes RPOS back on its own.";

/** X-Plane plays a replay (TelemetryStatus.replay). */
export const REPLAY = "Replay: not racing";
export const REPLAY_HINT = "X-Plane is playing a replay. Go back to flying to race.";
