cmake_minimum_required(VERSION 3.16)
project(chainscope_engine LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

add_executable(graph_engine
  src/graph.cpp
  src/main.cpp
)
target_include_directories(graph_engine PRIVATE include)

enable_testing()
add_executable(graph_tests
  src/graph.cpp
  tests/test_graph.cpp
)
target_include_directories(graph_tests PRIVATE include src)
add_test(NAME graph_tests COMMAND graph_tests)