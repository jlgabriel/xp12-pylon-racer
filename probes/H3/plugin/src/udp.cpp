#include "udp.h"

#include <cstring>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
using socklen = int;
using sock_t = SOCKET;
#define CLOSE_SOCKET closesocket
#else
#include <arpa/inet.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
using socklen = socklen_t;
using sock_t = int;
#define CLOSE_SOCKET ::close
#endif

static_assert(sizeof(sockaddr_in) <= 16, "the sender buffer holds a sockaddr_in");

namespace xpr {

Udp::~Udp() { close(); }

bool Udp::open(int port) {
  close();
#ifdef _WIN32
  WSADATA wsa;
  if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
    error_ = "WSAStartup failed";
    return false;
  }
  started_ = true;
#endif
  sock_t s = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
#ifdef _WIN32
  if (s == INVALID_SOCKET) {
#else
  if (s < 0) {
#endif
    error_ = "no UDP socket";
    close();
    return false;
  }
  fd_ = static_cast<long long>(s);

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(static_cast<unsigned short>(port));
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (bind(s, reinterpret_cast<sockaddr*>(&addr), sizeof addr) != 0) {
    error_ = "UDP port " + std::to_string(port) + " is taken by another program";
    close();
    return false;
  }
#ifdef _WIN32
  u_long nonBlocking = 1;
  ioctlsocket(s, FIONBIO, &nonBlocking);
#else
  fcntl(s, F_SETFL, fcntl(s, F_GETFL, 0) | O_NONBLOCK);
#endif
  error_.clear();
  return true;
}

void Udp::close() {
  if (fd_ >= 0) CLOSE_SOCKET(static_cast<sock_t>(fd_));
  fd_ = -1;
  haveSender_ = false;
#ifdef _WIN32
  if (started_) WSACleanup();
#endif
  started_ = false;
}

std::size_t Udp::receive(char* buf, std::size_t size) {
  if (fd_ < 0) return 0;
  sockaddr_in from{};
  socklen fromLen = sizeof from;
  auto n = recvfrom(static_cast<sock_t>(fd_), buf, static_cast<int>(size), 0,
                    reinterpret_cast<sockaddr*>(&from), &fromLen);
  if (n <= 0) return 0;  // nothing waiting (or an ICMP echo of an old reply on Windows): same thing
  std::memcpy(sender_, &from, sizeof from);
  haveSender_ = true;
  return static_cast<std::size_t>(n);
}

void Udp::reply(const std::string& text) {
  if (fd_ < 0 || !haveSender_) return;
  sendto(static_cast<sock_t>(fd_), text.data(), static_cast<int>(text.size()), 0,
         reinterpret_cast<const sockaddr*>(sender_), sizeof(sockaddr_in));
}

}  // namespace xpr
