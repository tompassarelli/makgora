cmake_minimum_required(VERSION 3.15)
project(player_tools CXX C)

set(CASC_BUILD_SHARED_LIB OFF CACHE BOOL "" FORCE)
set(CASC_BUILD_STATIC_LIB ON CACHE BOOL "" FORCE)
add_subdirectory(${CASCLIB_SOURCE} casclib EXCLUDE_FROM_ALL)

add_executable(casc-extract ../animations/casc-extract.cpp)
target_include_directories(casc-extract PRIVATE ${CASCLIB_SOURCE}/src)
target_link_libraries(casc-extract PRIVATE casc_static)
if(NOT MSVC)
  target_link_options(casc-extract PRIVATE -static-libstdc++ -static-libgcc)
endif()
