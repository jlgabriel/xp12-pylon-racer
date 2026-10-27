# XP Pylon Racer's in-sim display plugin, the parser test, and a listener that checks the wire format
# without the sim.
#   npm run plugin   (fetches the SDK, builds, tests, and lays out plugin/out/XPPylonRacer/)
cmake_minimum_required(VERSION 3.20)

# Before project(): a universal binary, and the oldest macOS X-Plane 12 runs on.
set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "")
set(CMAKE_OSX_DEPLOYMENT_TARGET "12.0" CACHE STRING "")

project(XPPylonRacer CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# The static runtime: a plugin must not need the user to install a Visual C++ redistributable.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

set(XPSDK "${CMAKE_CURRENT_SOURCE_DIR}/sdk/SDK" CACHE PATH "The X-Plane SDK (4.3.0)")
set(XPR_VERSION "dev" CACHE STRING "The app's version, shown by the plugin")

add_library(xpr_wire STATIC src/protocol.cpp src/udp.cpp)
target_include_directories(xpr_wire PUBLIC src)
set_target_properties(xpr_wire PROPERTIES POSITION_INDEPENDENT_CODE ON)
if(WIN32)
  target_link_libraries(xpr_wire PUBLIC ws2_32)
endif()

add_library(XPPylonRacer SHARED src/plugin.cpp)
target_link_libraries(XPPylonRacer PRIVATE xpr_wire)
target_include_directories(XPPylonRacer PRIVATE "${XPSDK}/CHeaders/XPLM")
# XPLM301 and below only: X-Plane 11.50 and newer, so 12.4.3 and 12.4.4 alike.
target_compile_definitions(XPPylonRacer PRIVATE XPLM200=1 XPLM210=1 XPLM300=1 XPLM301=1 XPR_VERSION="${XPR_VERSION}")
set_target_properties(XPPylonRacer PROPERTIES PREFIX "" SUFFIX ".xpl")

if(WIN32)
  target_compile_definitions(XPPylonRacer PRIVATE IBM=1 WIN32_LEAN_AND_MEAN NOMINMAX _CRT_SECURE_NO_WARNINGS)
  target_link_libraries(XPPylonRacer PRIVATE "${XPSDK}/Libraries/Win/XPLM_64.lib" opengl32)
elseif(APPLE)
  target_compile_definitions(XPPylonRacer PRIVATE APL=1 GL_SILENCE_DEPRECATION)
  # SHELL: keeps each pair together; CMake would otherwise fold the repeated -framework into one.
  target_link_options(XPPylonRacer PRIVATE "-F${XPSDK}/Libraries/Mac" "SHELL:-framework XPLM" "SHELL:-framework OpenGL")
else()
  target_compile_definitions(XPPylonRacer PRIVATE LIN=1)
  set_target_properties(XPPylonRacer PROPERTIES CXX_VISIBILITY_PRESET hidden)
  # XPLM comes from X-Plane when it loads us. The C++ runtime goes inside, so the plugin does not
  # depend on the libstdc++ of the distribution it was built on, and stays inside: exported, its
  # symbols could stand in for another plugin's. Exported: the five XPlugin* functions (and two digit
  # tables libstdc++'s headers make unique, which are harmless).
  find_package(OpenGL REQUIRED)
  target_link_libraries(XPPylonRacer PRIVATE OpenGL::GL)
  target_link_options(XPPylonRacer PRIVATE -static-libstdc++ -static-libgcc "LINKER:--exclude-libs,ALL")
endif()

# The parser against the app's own messages (plugin/test/fixtures, written by tests/display.test.ts).
enable_testing()
add_executable(xpr_wire_test test/wire_test.cpp)
target_link_libraries(xpr_wire_test PRIVATE xpr_wire)
target_compile_definitions(xpr_wire_test PRIVATE XPR_FIXTURES="${CMAKE_CURRENT_SOURCE_DIR}/test/fixtures")
add_test(NAME wire COMMAND xpr_wire_test)

add_executable(xpr_listen test/listen.cpp)
target_link_libraries(xpr_listen PRIVATE xpr_wire)
