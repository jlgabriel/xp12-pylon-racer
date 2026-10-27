// The plugin's ears without the sim: the same socket and parser (protocol.cpp, udp.cpp), printing
// what they understood once a second and answering `hello` like the plugin does. It binds the
// plugin's port, so it cannot run while X-Plane has the plugin loaded.
//
//   xpr_listen [seconds]      (0 or nothing = until Ctrl+C)

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <thread>

#include "protocol.h"
#include "udp.h"

int main(int argc, char** argv) {
  const double seconds = argc > 1 ? std::atof(argv[1]) : 0;
  xpr::Udp udp;
  if (!udp.open(xpr::kPort)) {
    std::fprintf(stderr, "%s\n", udp.error().c_str());
    return 1;
  }
  std::printf("listening on 127.0.0.1:%d\n", xpr::kPort);

  xpr::Course course;
  xpr::Live live;
  int nCourse = 0, nLive = 0, nOther = 0, nWrong = 0;
  static char buf[65536];
  using Clock = std::chrono::steady_clock;
  const auto t0 = Clock::now();
  auto lastPrint = t0;
  for (;;) {
    for (std::size_t n; (n = udp.receive(buf, sizeof buf)) > 0;) {
      switch (xpr::parse(buf, n, course, live)) {
        case xpr::Kind::Course: ++nCourse; break;
        case xpr::Kind::Live: ++nLive; break;
        case xpr::Kind::WrongVersion: ++nWrong; break;
        default: ++nOther;
      }
    }
    const auto now = Clock::now();
    if (now - lastPrint >= std::chrono::seconds(1)) {
      lastPrint = now;
      std::printf("rx live %d course %d other %d wrong-version %d\n", nLive, nCourse, nOther, nWrong);
      if (course.valid)
        std::printf("  course \"%s\" rev %s: %zu gates, %zu pylons; gate 0 %s %.7f %.7f %.1f\n", course.name.c_str(),
                    course.rev.c_str(), course.gates.size(), course.pylons.size(), course.gates[0].type.c_str(),
                    course.gates[0].lat, course.gates[0].lon, course.gates[0].headingDeg);
      if (live.valid)
        std::printf("  live rev %s %s \"%s\" %s next %d \"%s\" \"%s\" pen \"%s\" gates %s fix %s %.6f %.6f %.1f\n",
                    live.rev.c_str(), live.status.c_str(), live.line.c_str(), live.time.c_str(), live.next,
                    live.title.c_str(), live.needs.c_str(), live.pen.c_str(), live.gates.c_str(),
                    live.hasFix ? (live.demo ? "demo" : "sim") : "none", live.lat, live.lon, live.headingDeg);
      std::fflush(stdout);
      nCourse = nLive = nOther = nWrong = 0;
      udp.reply(xpr::helloMessage({"listen-test"}));
    }
    if (seconds > 0 && now - t0 >= std::chrono::duration<double>(seconds)) return 0;
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
  }
}
