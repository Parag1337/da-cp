# ChainScope — Cryptocurrency Transaction Graph Analyzer

## Stack
- Frontend: Vite + React + TypeScript + Tailwind
- Backend: Express + TypeScript + SQLite (better-sqlite3)
- Graph engine: C++ (nlohmann/json) with CMake
- Graph viz: Sigma.js + Graphology

## Run locally
Backend:
```
cd backend && npm install && npm run build && node dist/index.js
```
Frontend:
```
cd frontend && npm install && npm run dev
```
C++ engine:
```
cd cpp && mkdir -p build && cd build && cmake .. && make
```
Tests:
```
cd cpp/build && ctest
cd backend && npm test (if configured)
cd frontend && npm run build
```

## Algorithms
BFS, DFS-based cycle detection, Dijkstra (nonnegative cost), degrees/top-k, Tarjan SCC, connected components, neighborhood.

## Data
Demo synthetic dataset seeded on first run. Live blockchain provider not verified (mock/none). API keys would be stored backend-side.

## Limitations
- SQLite used instead of PostgreSQL.
- Amounts stored as raw text; JS Number conversion may lose precision for huge values (raw preserved in DB).
- Graph patterns are not proof of illicit activity.# da-cp
