// The plugin's parser against the app's own messages: plugin/test/fixtures is written by
// tests/display.test.ts from src/core/display/wire.ts, so if the app changes what it sends, this
// says whether the plugin still understands it. And the hello the plugin writes is the one the
// app's test reads (fixtures/hello.txt).
//
//   ctest --test-dir plugin/build -C Release      (npm run plugin runs it)

#include <cstdio>
#include <fstream>
#include <sstream>
#include <string>

#include "protocol.h"

namespace {

int failures = 0;

void check(bool ok, const char* what, int line) {
  if (ok) return;
  ++failures;
  std::fprintf(stderr, "wire_test.cpp:%d: %s\n", line, what);
}
#define CHECK(x) check((x), #x, __LINE__)

std::string fixture(const char* name) {
  std::ifstream in(std::string(XPR_FIXTURES) + "/" + name, std::ios::binary);
  if (!in) {
    std::fprintf(stderr, "missing fixture %s (npx vitest run tests/display.test.ts writes it)\n", name);
    ++failures;
    return {};
  }
  std::ostringstream s;
  s << in.rdbuf();
  return s.str();
}

xpr::Kind parse(const std::string& m, xpr::Course& c, xpr::Live& l) { return xpr::parse(m.data(), m.size(), c, l); }

}  // namespace

int main() {
  xpr::Course course;
  xpr::Live live;

  // KDAG Rules Test: one gate of each kind, a turn pylon with one pylon.
  CHECK(parse(fixture("course.txt"), course, live) == xpr::Kind::Course);
  CHECK(course.valid);
  CHECK(course.name == "KDAG Rules Test");
  CHECK(course.rev == "4d4d30053ae44774");
  CHECK(course.gates.size() == 6);
  CHECK(course.pylons.size() == 11);
  if (course.gates.size() == 6) {
    CHECK(course.gates[0].type == "start");
    CHECK(course.gates[3].type == "turn");
    CHECK(course.gates[5].type == "finish");
    CHECK(course.gates[1].lat > 34.86 && course.gates[1].lat < 34.87);
    CHECK(course.gates[1].lon < -116.82 && course.gates[1].lon > -116.83);
    CHECK(course.gates[1].headingDeg == 270.0);
  }
  CHECK(!live.valid);  // a course leaves the live state alone

  // Under way, with the knife edge next: UTF-8 passes through untouched.
  CHECK(parse(fixture("live.txt"), course, live) == xpr::Kind::Live);
  CHECK(live.valid);
  CHECK(live.rev == course.rev);
  CHECK(live.status == "running");
  CHECK(live.line == "Racing");
  CHECK(live.time == "00:07.50");
  CHECK(live.next == 2);
  CHECK(live.title == "3 \xC2\xB7 Knife-edge gate");
  CHECK(live.needs == "knife edge, 90\xC2\xB0 \xC2\xB1" "15\xC2\xB0");
  CHECK(live.pen.empty());
  CHECK(live.gates == "ddnttt");
  CHECK(live.resultTone.empty());
  CHECK(live.hasFix && live.demo);
  CHECK(live.headingDeg == 270.0);
  CHECK(course.gates.size() == 6);  // and a live message leaves the course alone

  // Finished, a new best, the sim's own position.
  CHECK(parse(fixture("best.txt"), course, live) == xpr::Kind::Live);
  CHECK(live.status == "finished");
  CHECK(live.next == -1);
  CHECK(live.gates == "dddddd");
  CHECK(live.resultTone == "best");
  CHECK(live.resultText == "New best!");
  CHECK(live.hasFix && !live.demo);

  // Another version is said, not drawn; anything else is not ours.
  CHECK(parse("XPR\t2\tlive\nstatus\trunning", course, live) == xpr::Kind::WrongVersion);
  CHECK(live.status == "finished");
  CHECK(parse("RPOS4", course, live) == xpr::Kind::None);
  CHECK(parse("", course, live) == xpr::Kind::None);
  CHECK(parse("XPR\t1\tcourse\ngate\t1\tstart\t0\t0\t0", course, live) == xpr::Kind::None);  // gates out of order

  // The hello the app reads.
  CHECK(xpr::helloMessage({"1.4.0", 12431, 430, 59.8, 0.065, 0.19, 17.0, 2.1}) == fixture("hello.txt"));
  CHECK(parse(fixture("hello.txt"), course, live) == xpr::Kind::Hello);

  if (failures) {
    std::fprintf(stderr, "%d failed\n", failures);
    return 1;
  }
  std::printf("wire: all checks passed\n");
  return 0;
}
