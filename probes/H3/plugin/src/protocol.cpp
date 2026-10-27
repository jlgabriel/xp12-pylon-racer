#include "protocol.h"

#include <cstdlib>

namespace xpr {
namespace {

std::vector<std::string> split(const std::string& s, char sep) {
  std::vector<std::string> out;
  std::size_t start = 0;
  for (;;) {
    std::size_t at = s.find(sep, start);
    out.push_back(s.substr(start, at == std::string::npos ? std::string::npos : at - start));
    if (at == std::string::npos) return out;
    start = at + 1;
  }
}

double num(const std::string& s) { return std::strtod(s.c_str(), nullptr); }

/** The rest of the line after the key, tabs and all: free text may hold anything but a newline. */
std::string rest(const std::vector<std::string>& f) {
  std::string out;
  for (std::size_t i = 1; i < f.size(); ++i) {
    if (i > 1) out += '\t';
    out += f[i];
  }
  return out;
}

}  // namespace

Kind parse(const char* data, std::size_t len, Course& course, Live& live) {
  std::vector<std::string> lines = split(std::string(data, len), '\n');
  std::vector<std::string> head = split(lines[0], '\t');
  if (head.size() < 3 || head[0] != "XPR") return Kind::None;
  if (std::atoi(head[1].c_str()) != kProtocol) return Kind::WrongVersion;

  if (head[2] == "course") {
    Course c;
    for (std::size_t i = 1; i < lines.size(); ++i) {
      std::vector<std::string> f = split(lines[i], '\t');
      if (f[0] == "name") c.name = rest(f);
      else if (f[0] == "rev" && f.size() > 1) c.rev = f[1];
      else if (f[0] == "gate" && f.size() >= 6) {
        std::size_t index = static_cast<std::size_t>(std::atoi(f[1].c_str()));
        if (index != c.gates.size()) return Kind::None;  // gates come in order, or not at all
        c.gates.push_back({f[2], num(f[3]), num(f[4]), num(f[5])});
      } else if (f[0] == "pylon" && f.size() >= 4) {
        c.pylons.push_back({std::atoi(f[1].c_str()), num(f[2]), num(f[3])});
      }
    }
    c.valid = !c.gates.empty();
    course = c;
    return Kind::Course;
  }

  if (head[2] == "live") {
    Live l;
    for (std::size_t i = 1; i < lines.size(); ++i) {
      std::vector<std::string> f = split(lines[i], '\t');
      const std::string& k = f[0];
      if (k == "rev" && f.size() > 1) l.rev = f[1];
      else if (k == "status") l.status = rest(f);
      else if (k == "line") l.line = rest(f);
      else if (k == "time") l.time = rest(f);
      else if (k == "next" && f.size() > 1) l.next = std::atoi(f[1].c_str());
      else if (k == "title") l.title = rest(f);
      else if (k == "needs") l.needs = rest(f);
      else if (k == "pen") l.pen = rest(f);
      else if (k == "gates") l.gates = rest(f);
      else if (k == "fix" && f.size() >= 5) {
        l.hasFix = true;
        l.lat = num(f[1]);
        l.lon = num(f[2]);
        l.headingDeg = num(f[3]);
        l.demo = f[4] == "1";
      }
    }
    l.valid = true;
    live = l;
    return Kind::Live;
  }

  if (head[2] == "hello") return Kind::Hello;
  return Kind::None;
}

}  // namespace xpr
