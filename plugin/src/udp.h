// A non-blocking UDP socket on 127.0.0.1, drained once per frame: no threads in the plugin.
#pragma once

#include <cstddef>
#include <string>

namespace xpr {

class Udp {
 public:
  Udp() = default;
  Udp(const Udp&) = delete;
  Udp& operator=(const Udp&) = delete;
  ~Udp();

  /** Binds 127.0.0.1:port. False with `error()` set when the port is taken or sockets fail. */
  bool open(int port);
  void close();
  bool isOpen() const { return fd_ >= 0; }
  const std::string& error() const { return error_; }

  /** One waiting datagram into buf; 0 when none is waiting. Remembers who sent it. */
  std::size_t receive(char* buf, std::size_t size);
  /** To whoever sent the last datagram; nothing before the first one. */
  void reply(const std::string& text);

 private:
  long long fd_ = -1;
  bool started_ = false;
  bool haveSender_ = false;
  unsigned char sender_[16] = {};  // a sockaddr_in, kept opaque so this header needs no socket headers
  std::string error_;
};

}  // namespace xpr
