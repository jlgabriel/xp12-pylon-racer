// The probe's wire format, app -> plugin, and back. No XPLM here, so the same parser runs in the
// plugin and in the listen test (test/listen.cpp) that checks it without the sim.
//
// One UDP datagram is one message: UTF-8 lines separated by '\n', fields by '\t' (names have spaces).
// The first line is always `XPR <version> <kind>`; a message with another version is ignored, and
// the plugin says so instead of drawing something half understood.
//
//   XPR 1 course                      every 2 s and whenever the course changes
//   name    <course name>
//   rev     <revision>
//   gate    <index> <type> <lat> <lon> <headingDeg>
//   pylon   <gateIndex> <lat> <lon>
//
//   XPR 1 live                        ~20 Hz
//   rev     <revision of the course this is about>
//   status  waiting|running|finished|dnf
//   line    <status line, as the app shows it>
//   time    <formatted clock>
//   next    <gate index, -1 = none>
//   title   <"3 · Knife-edge gate · lap 1 of 2">
//   needs   <what the gate asks, may be empty>
//   pen     <penalties text, may be empty>
//   gates   <one char per gate index: n next, d done, m missed, t to do>
//   fix     <lat> <lon> <headingDeg> <demo 0|1>      (the app's own position)
//
//   XPR 1 hello                       plugin -> sender of the last message, every second
//   plugin / xplane / xplm / fps / draw_avg_ms / draw_max_ms / rx_hz / fix_diff_m
#pragma once

#include <cstddef>
#include <string>
#include <vector>

namespace xpr {

constexpr int kProtocol = 1;
constexpr int kPort = 49710;

struct GateInfo {
  std::string type;
  double lat = 0, lon = 0, headingDeg = 0;
};

struct Pylon {
  int gate = 0;
  double lat = 0, lon = 0;
};

struct Course {
  bool valid = false;
  std::string name, rev;
  std::vector<GateInfo> gates;
  std::vector<Pylon> pylons;
};

struct Live {
  bool valid = false;
  std::string rev, status, line, time, title, needs, pen, gates;
  int next = -1;
  bool hasFix = false, demo = false;
  double lat = 0, lon = 0, headingDeg = 0;
};

enum class Kind { None, Course, Live, Hello, WrongVersion };

/** Parses one datagram into `course` or `live` (only the one it carries is touched). */
Kind parse(const char* data, std::size_t len, Course& course, Live& live);

}  // namespace xpr
