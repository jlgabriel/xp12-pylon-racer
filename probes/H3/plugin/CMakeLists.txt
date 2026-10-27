# Probe H3: the in-sim display plugin, and a listener that checks its wire format without the sim.
#   npm run probe:plugin   (finds CMake in Visual Studio, builds, and assembles probes/H3/XPR_H3_Display/)
cmake_minimum_required(VERSION 3.20)
project(XPR_H3_Display CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
# The static runtime: a plugin must not need the user to install a Visual C++ redistributable.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")

set(XPSDK "${CMAKE_CURRENT_SOURCE_DIR}/../sdk/SDK" CACHE PATH "The X-Plane SDK (4.3.0)")

add_library(xpr_wire STATIC src/protocol.cpp src/udp.cpp)
target_include_directories(xpr_wire PUBLIC src)
if(WIN32)
  target_link_libraries(xpr_wire PUBLIC ws2_32)
endif()

add_library(XPR_H3_Display SHARED src/plugin.cpp)
target_link_libraries(XPR_H3_Display PRIVATE xpr_wire)
target_include_directories(XPR_H3_Display PRIVATE "${XPSDK}/CHeaders/XPLM")
# XPLM301 and below only: X-Plane 11.50 and newer, so 12.4.3 and 12.4.4 alike.
target_compile_definitions(XPR_H3_Display PRIVATE XPLM200=1 XPLM210=1 XPLM300=1 XPLM301=1)
set_target_properties(XPR_H3_Display PROPERTIES PREFIX "" SUFFIX ".xpl")

if(WIN32)
  target_compile_definitions(XPR_H3_Display PRIVATE IBM=1 WIN32_LEAN_AND_MEAN NOMINMAX)
  target_link_libraries(XPR_H3_Display PRIVATE "${XPSDK}/Libraries/Win/XPLM_64.lib" opengl32)
elseif(APPLE)
  target_compile_definitions(XPR_H3_Display PRIVATE APL=1)
  target_link_options(XPR_H3_Display PRIVATE "-F${XPSDK}/Libraries/Mac" -framework XPLM -framework OpenGL)
else()
  target_compile_definitions(XPR_H3_Display PRIVATE LIN=1)
  set_target_properties(XPR_H3_Display PROPERTIES CXX_VISIBILITY_PRESET hidden)
endif()

add_executable(xpr_h3_listen test/listen.cpp)
target_link_libraries(xpr_h3_listen PRIVATE xpr_wire)
