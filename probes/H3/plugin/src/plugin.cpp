// Probe H3: the in-sim display. A modern X-Plane window that draws what the app sends over UDP
// (protocol.h): it never judges the race. The one thing it computes itself is where the next gate
// is from the nose, from the sim's own position every frame, so the arrow is smoother than RPOS.
//
// Only XPLM301 APIs (X-Plane 11.50 and newer), so the same build runs on 12.4.3 and on 12.4.4.
// Every 10 s it writes what the probe measures to Log.txt (lines start with "XPR_H3:").

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

#ifdef _WIN32
#include <windows.h>
#endif
#if defined(__APPLE__)
#include <OpenGL/gl.h>
#else
#include <GL/gl.h>
#endif

#include "XPLMDataAccess.h"
#include "XPLMDisplay.h"
#include "XPLMGraphics.h"
#include "XPLMMenus.h"
#include "XPLMPlugin.h"
#include "XPLMProcessing.h"
#include "XPLMUtilities.h"
#include "protocol.h"
#include "udp.h"

namespace {

constexpr const char* kVersion = "0.1.0-h3";
constexpr double kStaleS = 2.0;      // no message for this long = the app is gone
constexpr double kLogEveryS = 10.0;  // the probe's measurements, to Log.txt
constexpr double kHelloEveryS = 1.0;
constexpr double kCloseM = 150;      // nearer than this (or the gate's width), the arrow shows the gate's heading

// Colors copied from src/renderer/theme/tokens.css: the plugin cannot read the app's tokens.
struct Rgb { float r, g, b; };
constexpr Rgb kText{0.93f, 0.95f, 0.97f};    // --gate-finish / text
constexpr Rgb kMuted{0.55f, 0.60f, 0.68f};
constexpr Rgb kAccent{1.00f, 0.35f, 0.12f};  // --accent
constexpr Rgb kGood{0.24f, 0.86f, 0.52f};    // --good
constexpr Rgb kBad{1.00f, 0.30f, 0.37f};     // --bad
constexpr Rgb kWarn{1.00f, 0.69f, 0.13f};    // --warn
constexpr Rgb kLine{0.18f, 0.23f, 0.32f};    // --line-strong

Rgb gateColor(const std::string& type) {
  if (type == "start") return {0.24f, 0.86f, 0.52f};
  if (type == "finish") return {0.93f, 0.95f, 0.97f};
  if (type == "level") return {0.30f, 0.71f, 1.00f};
  if (type == "knife") return {1.00f, 0.69f, 0.13f};
  if (type == "inverted") return {0.18f, 0.90f, 0.78f};
  if (type == "turn") return {0.78f, 0.49f, 1.00f};
  return {1.00f, 0.30f, 0.37f};  // gate
}

// ---------------------------------------------------------------- geometry (as src/core/geo/geo.ts)

constexpr double kEarthR = 6371008.8;
constexpr double kDeg = 3.14159265358979323846 / 180.0;

double wrap180(double a) {
  a = std::fmod(a + 180.0, 360.0);
  if (a < 0) a += 360.0;
  return a - 180.0;
}

double haversine(double lat1, double lon1, double lat2, double lon2) {
  double dLat = (lat2 - lat1) * kDeg, dLon = (lon2 - lon1) * kDeg;
  double h = std::sin(dLat / 2) * std::sin(dLat / 2) +
             std::cos(lat1 * kDeg) * std::cos(lat2 * kDeg) * std::sin(dLon / 2) * std::sin(dLon / 2);
  return 2 * kEarthR * std::asin(std::min(1.0, std::sqrt(h)));
}

double bearing(double lat1, double lon1, double lat2, double lon2) {
  double p1 = lat1 * kDeg, p2 = lat2 * kDeg, dl = (lon2 - lon1) * kDeg;
  double y = std::sin(dl) * std::cos(p2);
  double x = std::cos(p1) * std::sin(p2) - std::sin(p1) * std::cos(p2) * std::cos(dl);
  return std::atan2(y, x) / kDeg;
}

std::string fmtDistance(double m) {
  char b[32];
  if (m >= 1000) std::snprintf(b, sizeof b, "%.1f km", m / 1000);
  else std::snprintf(b, sizeof b, "%d m", static_cast<int>(std::lround(m)));
  return b;
}

// ---------------------------------------------------------------- state

XPLMWindowID gWindow = nullptr;
XPLMMenuID gMenu = nullptr;
XPLMCommandRef gToggle = nullptr;
XPLMFlightLoopID gLoop = nullptr;
XPLMDataRef gLat, gLon, gPsi, gFramePeriod, gVr;

xpr::Udp gUdp;
xpr::Course gCourse;
xpr::Live gLive;
bool gWrongVersion = false;
double gLastRx = -1e9;

using Clock = std::chrono::steady_clock;
const Clock::time_point gT0 = Clock::now();
double now() { return std::chrono::duration<double>(Clock::now() - gT0).count(); }

/** What the probe measures, per log period. */
struct Stats {
  double since = 0;
  int frames = 0;
  double frameSum = 0;  // sim/time/framerate_period, summed per flight loop
  int draws = 0;
  double drawSum = 0, drawMax = 0;  // ms in our draw callback
  int rxCourse = 0, rxLive = 0, rxOther = 0;
  int fixN = 0;
  double fixSum = 0, fixMax = 0;  // m between the sim's position now and the app's last fix
  double fps() const { return frameSum > 0 ? frames / frameSum : 0; }
  void reset(double t) { *this = Stats{}; since = t; }
};
Stats gStats, gHelloStats;
double gLastLog = 0, gLastHello = 0;

// ---------------------------------------------------------------- drawing helpers

/** X-Plane leaves back-face culling on in window callbacks (12.4.3, Vulkan): counter-clockwise
 *  shapes (the background, the clock) vanished while the clockwise arrow drew. XPLMSetGraphicsState
 *  does not touch culling, so it is switched off here. */
void glState() {
  XPLMSetGraphicsState(0, 0, 0, 0, 1, 0, 0);
  glDisable(GL_CULL_FACE);
}

void color(Rgb c, float a = 1.0f) { glColor4f(c.r, c.g, c.b, a); }

/** A triangle strip (glState turns culling off, so the winding does not matter). */
void rect(float x0, float y0, float x1, float y1) {
  glBegin(GL_TRIANGLE_STRIP);
  glVertex2f(x0, y0);
  glVertex2f(x1, y0);
  glVertex2f(x0, y1);
  glVertex2f(x1, y1);
  glEnd();
}

void text(Rgb c, int x, int y, const std::string& s) {
  float rgb[3] = {c.r, c.g, c.b};
  XPLMDrawString(rgb, x, y, const_cast<char*>(s.c_str()), nullptr, xplmFont_Proportional);
}

int textWidth(const std::string& s) {
  return static_cast<int>(XPLMMeasureString(xplmFont_Proportional, s.c_str(), static_cast<int>(s.size())));
}

/** The clock as seven-segment digits: XPLMDrawString has one small size, and a timer is read at a glance. */
float drawClock(const std::string& s, float x, float y, float h) {
  // Segments a b c d e f g, bit 0 = a.
  static const int kDigits[10] = {0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f};
  const float w = h * 0.52f, th = h * 0.11f, gap = h * 0.16f, m = h / 2;
  glState();
  for (char ch : s) {
    if (ch >= '0' && ch <= '9') {
      int seg = kDigits[ch - '0'];
      if (seg & 0x01) rect(x, y + h - th, x + w, y + h);           // a
      if (seg & 0x02) rect(x + w - th, y + m, x + w, y + h);       // b
      if (seg & 0x04) rect(x + w - th, y, x + w, y + m);           // c
      if (seg & 0x08) rect(x, y, x + w, y + th);                   // d
      if (seg & 0x10) rect(x, y, x + th, y + m);                   // e
      if (seg & 0x20) rect(x, y + m, x + th, y + h);               // f
      if (seg & 0x40) rect(x, y + m - th / 2, x + w, y + m + th / 2);  // g
      x += w + gap;
    } else if (ch == ':') {
      rect(x, y + h * 0.22f, x + th, y + h * 0.22f + th);
      rect(x, y + h * 0.70f, x + th, y + h * 0.70f + th);
      x += th + gap;
    } else if (ch == '.') {
      rect(x, y, x + th, y + th);
      x += th + gap;
    }
  }
  return x;
}

/** The arrow of the app's TurnCue, rotated clockwise by `relDeg` (0 = straight ahead). */
void drawArrow(float cx, float cy, float size, double relDeg) {
  const float pts[4][2] = {{0, 10}, {7, -6}, {0, -2}, {-7, -6}};
  float c = static_cast<float>(std::cos(relDeg * kDeg)), s = static_cast<float>(std::sin(relDeg * kDeg));
  float k = size / 20.0f, out[4][2];
  for (int i = 0; i < 4; ++i) {
    out[i][0] = cx + k * (pts[i][0] * c + pts[i][1] * s);
    out[i][1] = cy + k * (-pts[i][0] * s + pts[i][1] * c);
  }
  glBegin(GL_TRIANGLES);
  for (int i : {0, 1, 2, 0, 2, 3}) glVertex2f(out[i][0], out[i][1]);
  glEnd();
}

// ---------------------------------------------------------------- the window

struct Position {
  bool valid = false;
  double lat = 0, lon = 0, heading = 0;
  bool fromApp = false;
};

/** The sim's position, read in the flight loop only: windows are drawn in the main menu too, and
 *  reading the position there logs "Sim is not yet started - Position is unset" every frame. */
Position gSim;

/** The sim's own position, unless the app is flying its demo: then the demo's. */
Position position() {
  if (gLive.valid && gLive.hasFix && gLive.demo) return {true, gLive.lat, gLive.lon, gLive.headingDeg, true};
  return gSim;
}

void drawMap(float x0, float y0, float x1, float y1, const Position& me) {
  glState();
  color(kLine);
  glBegin(GL_LINE_LOOP);
  glVertex2f(x0, y0);
  glVertex2f(x1, y0);
  glVertex2f(x1, y1);
  glVertex2f(x0, y1);
  glEnd();
  if (gCourse.pylons.empty()) return;

  // North up, metres east and north of the course's corner, fitted to the box.
  double minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const auto& p : gCourse.pylons) {
    minLat = std::min(minLat, p.lat), maxLat = std::max(maxLat, p.lat);
    minLon = std::min(minLon, p.lon), maxLon = std::max(maxLon, p.lon);
  }
  const double kx = std::cos((minLat + maxLat) / 2 * kDeg) * kDeg * kEarthR, ky = kDeg * kEarthR;
  const double wM = std::max(50.0, (maxLon - minLon) * kx), hM = std::max(50.0, (maxLat - minLat) * ky);
  const float pad = 14;
  const double scale = std::min((x1 - x0 - 2 * pad) / wM, (y1 - y0 - 2 * pad) / hM);
  const float cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const double midLat = (minLat + maxLat) / 2, midLon = (minLon + maxLon) / 2;
  auto px = [&](double lon) { return static_cast<float>(cx + (lon - midLon) * kx * scale); };
  auto py = [&](double lat) { return static_cast<float>(cy + (lat - midLat) * ky * scale); };

  // The route through the gate centers.
  glColor4f(0.93f, 0.95f, 0.97f, 0.24f);  // --map-route
  glBegin(GL_LINE_STRIP);
  for (const auto& g : gCourse.gates) glVertex2f(px(g.lon), py(g.lat));
  glEnd();

  // Each gate: the line between its pylons (or a ring round a turn pylon), by its state.
  for (std::size_t gi = 0; gi < gCourse.gates.size(); ++gi) {
    const auto& g = gCourse.gates[gi];
    char state = gi < gLive.gates.size() ? gLive.gates[gi] : 't';
    bool next = state == 'n';
    if (next) color(kAccent);
    else if (state == 'd') color(kMuted, 0.6f);
    else if (state == 'm') color(kBad);
    else color(gateColor(g.type), 0.85f);
    glLineWidth(next ? 3.0f : 1.5f);
    std::vector<const xpr::Pylon*> mine;
    for (const auto& p : gCourse.pylons)
      if (p.gate == static_cast<int>(gi)) mine.push_back(&p);
    if (mine.size() == 2) {
      glBegin(GL_LINES);
      glVertex2f(px(mine[0]->lon), py(mine[0]->lat));
      glVertex2f(px(mine[1]->lon), py(mine[1]->lat));
      glEnd();
    } else if (mine.size() == 1) {
      glBegin(GL_LINE_LOOP);
      for (int i = 0; i < 16; ++i)
        glVertex2f(px(mine[0]->lon) + 6 * std::cos(i * 0.3927f), py(mine[0]->lat) + 6 * std::sin(i * 0.3927f));
      glEnd();
    }
    glLineWidth(1.0f);
    for (const auto* p : mine) rect(px(p->lon) - 2, py(p->lat) - 2, px(p->lon) + 2, py(p->lat) + 2);
  }

  // The aircraft, held inside the box when it is off the map.
  if (me.valid) {
    float ax = std::clamp(px(me.lon), x0 + 6, x1 - 6), ay = std::clamp(py(me.lat), y0 + 6, y1 - 6);
    color(kText);
    drawArrow(ax, ay, 16, me.heading);
  }
}

void draw(XPLMWindowID win, void*) {
  auto start = Clock::now();
  int l, t, r, b;
  XPLMGetWindowGeometry(win, &l, &t, &r, &b);
  int fontH = 0;
  XPLMGetFontDimensions(xplmFont_Proportional, nullptr, &fontH, nullptr);
  const int pad = 10, lineH = fontH + 6;

  glState();
  glColor4f(0, 0, 0, 1);
  rect(static_cast<float>(l), static_cast<float>(b), static_cast<float>(r), static_cast<float>(t));

  const double tNow = now();
  const bool stale = tNow - gLastRx > kStaleS;
  int y = t - pad - fontH;
  const Position me = position();

  if (gWrongVersion) {
    text(kWarn, l + pad, y, "This display needs another version of XP Pylon Racer.");
  } else if (!gUdp.isOpen()) {
    text(kBad, l + pad, y, gUdp.error().empty() ? "No UDP socket" : gUdp.error());
  } else if (stale) {
    text(kMuted, l + pad, y, "Waiting for XP Pylon Racer...");
    text(kMuted, l + pad, y - lineH, "Start the app (or npm run probe:display) on this computer.");
  } else if (!gCourse.valid || gCourse.rev != gLive.rev) {
    text(kMuted, l + pad, y, "Waiting for the course...");
  } else {
    // Status line, colored like the app's.
    Rgb sc = gLive.status == "running" ? kGood : gLive.status == "dnf" ? kBad : gLive.status == "finished" ? kText : kWarn;
    text(sc, l + pad, y, gLive.line);
    text(kMuted, r - pad - textWidth(gCourse.name), y, gCourse.name);
    y -= 8;

    // The clock.
    const float clockH = std::clamp((t - b) * 0.12f, 22.0f, 64.0f);
    y -= static_cast<int>(clockH);
    color(gLive.status == "running" ? kText : kMuted);
    drawClock(gLive.time, static_cast<float>(l + pad), static_cast<float>(y), clockH);
    y -= lineH + 4;

    // The next gate: what it is, what it asks, how far and which way.
    if (gLive.next >= 0 && gLive.next < static_cast<int>(gCourse.gates.size())) {
      const auto& g = gCourse.gates[gLive.next];
      text(gateColor(g.type), l + pad, y, gLive.title);
      if (!gLive.needs.empty()) text(kMuted, l + pad, y -= lineH, gLive.needs);
      if (me.valid) {
        double d = haversine(me.lat, me.lon, g.lat, g.lon);
        // Close to the gate the bearing to its center swings round as you pass beside it, and
        // turns behind you until the app says the gate was passed (first flight, 2026-10-26).
        // There the arrow shows the way through the gate instead, which holds still.
        double width = 0;
        const xpr::Pylon* first = nullptr;
        for (const auto& p : gCourse.pylons) {
          if (p.gate != gLive.next) continue;
          if (first) width = haversine(first->lat, first->lon, p.lat, p.lon);
          else first = &p;
        }
        const bool close = d < std::max(kCloseM, width);
        double rel = wrap180((close ? g.headingDeg : bearing(me.lat, me.lon, g.lat, g.lon)) - me.heading);
        int deg = static_cast<int>(std::lround(std::fabs(rel)));
        std::string cue = deg <= 10 ? "ahead" : deg >= 170 ? "behind you" : std::to_string(deg) + "\xC2\xB0 " + (rel < 0 ? "left" : "right");
        y -= 34;
        std::string dist = fmtDistance(d);
        text(kText, l + pad, y + 8, dist);
        int ax = l + pad + std::max(70, textWidth(dist) + 30);
        glState();
        color(deg <= 10 ? kGood : kAccent);
        drawArrow(static_cast<float>(ax), static_cast<float>(y + 12), 30, rel);
        text(deg <= 10 ? kGood : kText, ax + 24, y + 8, cue);
      }
      y -= lineH;
    }
    if (!gLive.pen.empty()) {
      text(kBad, l + pad, y -= 4, gLive.pen);
      y -= lineH;
    }
    if (me.fromApp) text(kMuted, r - pad - textWidth("demo position"), y + lineH, "demo position");

    float mapTop = static_cast<float>(y - 4);
    if (mapTop - b > 60) drawMap(static_cast<float>(l + pad), static_cast<float>(b + pad), static_cast<float>(r - pad), mapTop, me);
  }

  double ms = std::chrono::duration<double, std::milli>(Clock::now() - start).count();
  for (Stats* s : {&gStats, &gHelloStats}) {
    ++s->draws;
    s->drawSum += ms;
    s->drawMax = std::max(s->drawMax, ms);
  }
}

int onMouse(XPLMWindowID, int, int, XPLMMouseStatus, void*) { return 1; }
int onWheel(XPLMWindowID, int, int, int, int, void*) { return 0; }
void onKey(XPLMWindowID, char, XPLMKeyFlags, char, void*, int) {}
XPLMCursorStatus onCursor(XPLMWindowID, int, int, void*) { return xplm_CursorDefault; }

void placeDefault() {
  int l, t, r, b;
  XPLMGetScreenBoundsGlobal(&l, &t, &r, &b);
  XPLMSetWindowGeometry(gWindow, r - 420, t - 80, r - 40, t - 560);
}

void createWindow() {
  XPLMCreateWindow_t p{};
  p.structSize = sizeof p;
  p.visible = 1;
  p.drawWindowFunc = draw;
  p.handleMouseClickFunc = onMouse;
  p.handleRightClickFunc = onMouse;
  p.handleMouseWheelFunc = onWheel;
  p.handleKeyFunc = onKey;
  p.handleCursorFunc = onCursor;
  p.decorateAsFloatingWindow = xplm_WindowDecorationRoundRectangle;
  p.layer = xplm_WindowLayerFloatingWindows;
  p.left = 100, p.top = 600, p.right = 480, p.bottom = 120;
  gWindow = XPLMCreateWindowEx(&p);
  XPLMSetWindowTitle(gWindow, "XP Pylon Racer");
  XPLMSetWindowResizingLimits(gWindow, 260, 220, 1600, 1400);
  XPLMSetWindowPositioningMode(gWindow, xplm_WindowPositionFree, -1);
  placeDefault();
}

// ---------------------------------------------------------------- the loop: UDP, stats, log

void xlog(const std::string& s) { XPLMDebugString(("XPR_H3: " + s + "\n").c_str()); }

std::string statsLine(const Stats& s, double t) {
  double span = std::max(0.001, t - s.since);
  char b[512];
  std::snprintf(b, sizeof b,
                "fps %.1f | draw avg %.3f ms max %.3f ms (%d draws) | rx live %.1f Hz course %d other %d | "
                "app fix vs sim %s | window %s",
                s.fps(), s.draws ? s.drawSum / s.draws : 0.0, s.drawMax, s.draws, s.rxLive / span, s.rxCourse, s.rxOther,
                s.fixN ? (std::to_string(static_cast<int>(std::lround(s.fixSum / s.fixN))) + " m avg, " +
                          std::to_string(static_cast<int>(std::lround(s.fixMax))) + " m max").c_str()
                       : "-",
                !XPLMGetWindowIsVisible(gWindow) ? "hidden"
                : XPLMWindowIsInVR(gWindow)      ? "in VR"
                : XPLMWindowIsPoppedOut(gWindow) ? "popped out"
                                                 : "in the sim");
  return b;
}

float onLoop(float, float, int, void*) {
  const double t = now();
  if (gLat && gLon && gPsi) gSim = {true, XPLMGetDatad(gLat), XPLMGetDatad(gLon), XPLMGetDataf(gPsi), false};
  if (gFramePeriod) {
    float period = XPLMGetDataf(gFramePeriod);
    for (Stats* s : {&gStats, &gHelloStats}) ++s->frames, s->frameSum += period;
  }

  static char buf[65536];
  for (std::size_t n; (n = gUdp.receive(buf, sizeof buf)) > 0;) {
    gLastRx = t;
    const std::string revBefore = gCourse.rev;
    xpr::Kind k = xpr::parse(buf, n, gCourse, gLive);
    gWrongVersion = k == xpr::Kind::WrongVersion;
    for (Stats* s : {&gStats, &gHelloStats}) {
      if (k == xpr::Kind::Live) ++s->rxLive;
      else if (k == xpr::Kind::Course) ++s->rxCourse;
      else ++s->rxOther;
    }
    // The course is resent every 2 s: log it when it changes, not each time.
    if (k == xpr::Kind::Course && gCourse.rev != revBefore) xlog("course: " + gCourse.name + " (" + std::to_string(gCourse.gates.size()) + " gates, rev " + gCourse.rev + ")");
    // How far the app's fix (RPOS, ~30 Hz) is from the sim's position as this packet arrives.
    if (k == xpr::Kind::Live && gLive.hasFix && !gLive.demo && gSim.valid) {
      double d = haversine(gLive.lat, gLive.lon, gSim.lat, gSim.lon);
      for (Stats* s : {&gStats, &gHelloStats}) ++s->fixN, s->fixSum += d, s->fixMax = std::max(s->fixMax, d);
    }
  }

  if (t - gLastHello >= kHelloEveryS) {
    int xp = 0, xplm = 0;
    XPLMHostApplicationID host;
    XPLMGetVersions(&xp, &xplm, &host);
    const Stats& s = gHelloStats;
    char b[512];
    std::snprintf(b, sizeof b,
                  "XPR\t%d\thello\nplugin\t%s\nxplane\t%d\nxplm\t%d\nfps\t%.1f\ndraw_avg_ms\t%.3f\ndraw_max_ms\t%.3f\nrx_hz\t%.1f\nfix_diff_m\t%s\n",
                  xpr::kProtocol, kVersion, xp, xplm, s.fps(), s.draws ? s.drawSum / s.draws : 0.0, s.drawMax,
                  s.rxLive / std::max(0.001, t - s.since), s.fixN ? std::to_string(s.fixSum / s.fixN).c_str() : "-");
    gUdp.reply(b);
    gHelloStats.reset(t);
    gLastHello = t;
  }
  if (t - gLastLog >= kLogEveryS) {
    xlog(statsLine(gStats, t));
    gStats.reset(t);
    gLastLog = t;
  }
  return -1.0f;  // every frame
}

// ---------------------------------------------------------------- menu and command

enum MenuItem : intptr_t { kPopOut = 1, kVr, kBack };

void moveTo(intptr_t where) {
  if (!gWindow) return;
  XPLMSetWindowIsVisible(gWindow, 1);
  if (where == kPopOut) {
    XPLMSetWindowPositioningMode(gWindow, xplm_WindowPopOut, -1);
  } else if (where == kVr) {
    if (gVr && XPLMGetDatai(gVr)) XPLMSetWindowPositioningMode(gWindow, xplm_WindowVR, -1);
    else xlog("Move into VR: VR is not on");
  } else {
    XPLMSetWindowPositioningMode(gWindow, xplm_WindowPositionFree, -1);
    placeDefault();
  }
  xlog(std::string("window moved: ") + (where == kPopOut ? "pop out" : where == kVr ? "VR" : "back into the sim"));
}

void onMenu(void*, void* item) { moveTo(reinterpret_cast<intptr_t>(item)); }

int onToggle(XPLMCommandRef, XPLMCommandPhase phase, void*) {
  if (phase == xplm_CommandBegin && gWindow) XPLMSetWindowIsVisible(gWindow, !XPLMGetWindowIsVisible(gWindow));
  return 0;
}

}  // namespace

// ---------------------------------------------------------------- the plugin's entry points

PLUGIN_API int XPluginStart(char* name, char* sig, char* desc) {
  std::strcpy(name, "XP Pylon Racer display (probe H3)");
  std::strcpy(sig, "jlgabriel.xppylonracer.h3");
  std::strcpy(desc, "Shows the race from XP Pylon Racer inside X-Plane.");

  gLat = XPLMFindDataRef("sim/flightmodel/position/latitude");
  gLon = XPLMFindDataRef("sim/flightmodel/position/longitude");
  gPsi = XPLMFindDataRef("sim/flightmodel/position/true_psi");
  gFramePeriod = XPLMFindDataRef("sim/time/framerate_period");
  gVr = XPLMFindDataRef("sim/graphics/VR/enabled");

  int xp = 0, xplm = 0;
  XPLMHostApplicationID host;
  XPLMGetVersions(&xp, &xplm, &host);
  xlog(std::string("start ") + kVersion + ", X-Plane " + std::to_string(xp) + ", XPLM " + std::to_string(xplm) +
      ", built with SDK 4.3.0 at XPLM301");

  createWindow();

  gToggle = XPLMCreateCommand("xpr/h3/toggle_display", "XP Pylon Racer: show or hide the display");
  XPLMRegisterCommandHandler(gToggle, onToggle, 1, nullptr);
  int item = XPLMAppendMenuItem(XPLMFindPluginsMenu(), "XP Pylon Racer (H3)", nullptr, 0);
  gMenu = XPLMCreateMenu("XP Pylon Racer (H3)", XPLMFindPluginsMenu(), item, onMenu, nullptr);
  XPLMAppendMenuItemWithCommand(gMenu, "Show / hide the display", gToggle);
  XPLMAppendMenuItem(gMenu, "Pop out into its own window", reinterpret_cast<void*>(kPopOut), 0);
  XPLMAppendMenuItem(gMenu, "Move into VR", reinterpret_cast<void*>(kVr), 0);
  XPLMAppendMenuItem(gMenu, "Back into the sim", reinterpret_cast<void*>(kBack), 0);
  return 1;
}

PLUGIN_API void XPluginStop() {
  if (gMenu) XPLMDestroyMenu(gMenu);
  if (gToggle) XPLMUnregisterCommandHandler(gToggle, onToggle, 1, nullptr);
  if (gWindow) XPLMDestroyWindow(gWindow);
  gMenu = nullptr, gWindow = nullptr;
  xlog("stop");
}

PLUGIN_API int XPluginEnable() {
  if (gUdp.open(xpr::kPort)) xlog("listening on 127.0.0.1:" + std::to_string(xpr::kPort));
  else xlog(gUdp.error());
  XPLMCreateFlightLoop_t fl{sizeof(XPLMCreateFlightLoop_t), xplm_FlightLoop_Phase_AfterFlightModel, onLoop, nullptr};
  gLoop = XPLMCreateFlightLoop(&fl);
  XPLMScheduleFlightLoop(gLoop, -1.0f, 1);
  gStats.reset(now());
  gHelloStats.reset(now());
  return 1;
}

PLUGIN_API void XPluginDisable() {
  if (gLoop) XPLMDestroyFlightLoop(gLoop);
  gLoop = nullptr;
  gUdp.close();
}

PLUGIN_API void XPluginReceiveMessage(XPLMPluginID, int msg, void*) {
  if (msg == XPLM_MSG_EXITING_VR && gWindow && XPLMWindowIsInVR(gWindow)) moveTo(kBack);
}
