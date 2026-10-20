# ChainScope — Cryptocurrency Transaction Graph Analyzer

An investigative workstation for exploring cryptocurrency transfer graphs: animated
transaction playback, algorithm visualizations, dataset import, pattern alerts and
case management.

## Stack
- Frontend: Vite + React + TypeScript + Tailwind (Sigma.js 4 + Graphology for the graph)
- Backend: Express + TypeScript + SQLite (better-sqlite3)
- Graph engine: C++17 (nlohmann/json) with CMake — BFS, DFS, Dijkstra, cycles, SCC, degrees, components, neighborhood + **step traces**
- Charts: recharts · Icons: lucide-react

## Run locally
Backend (port 3001, seeds the synthetic dataset on first start):
```
cd backend && npm install && npm run build && node dist/index.js
```
Frontend (port 5173, proxies /api to :3001):
```
cd frontend && npm install && npm run dev
```
C++ engine (required by the backend as ../cpp/build/graph_engine):
```
cd cpp && cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j
```

## Tests
```
cd cpp/build && ctest --output-on-failure      # 10 cases incl. bfs/dfs/dijkstra traces
cd backend && npx vitest run                  # 8 dataset-parsing/validation cases
cd frontend && npm run build                  # tsc -b + vite build
python3 /tmp/pwfinal.py                       # Playwright UI workflow checks (13/13)
```

## Animated transaction flows (how it works)
Sigma renders the graph with WebGL, so the particle system uses a **camera-synchronized
canvas overlay**:

- `frontend/src/components/TransactionFlowOverlay.tsx` converts every graph coordinate
  to screen pixels with `sigma.graphToViewport({x, y})` — the same transform Sigma uses
  to draw nodes — so particles ride the actual rendered edges, in the sender→receiver
  direction, and stay glued to the edge while panning/zooming. (The original bug plotted
  raw graph coordinates ≈[-5,5] as pixels, clustering particles in one corner.)
- One `requestAnimationFrame` loop, DPR-aware canvas, capped at ~220 concurrent
  particles, throttle: status callbacks fire at ≤4 Hz so React never re-renders per frame.
- Chronological **historical replay**: transfers are sorted by timestamp and scheduled
  across a 12 s timeline; the progress bar shows the replay window and current time.
  Arrival rings flash on destination nodes. Lanes offset parallel edges so repeated
  transfers stay distinguishable.
- Controls: Play / Pause / Resume / Stop / Replay, speed 0.5×/1×/2×, density
  (Low→Max), show/hide particles. Mode label is always **HISTORICAL REPLAY** — never
  presented as live activity. `prefers-reduced-motion` disables the loop while keeping
  all data accessible.

## Algorithm playback (separate from transaction playback)
The C++ engine now emits step traces (`bfsTrace`, `dfsTrace`, `dijkstraTrace`): current
node, edge being explored, visit/settle order, tentative distances, relaxation events
(`relaxed-improved` = shorter path found), final path + cost. The UI plays these real
steps with Play / Pause / Step forward / Reset / speed controls and highlights the
current node, explored edge, visited set and final path on the graph. Endpoints:
`POST /api/graph/trace-steps`.

## Datasets
- Built-in seeded synthetic investigation dataset: **324 addresses, 2,290 transfers**,
  generated from seed `20261020` (deterministic) with hubs, fan-in/fan-out, a 3-node
  directed cycle (39 cycles found by the detector), an isolated component, rapid-
  succession bursts, and a verified multi-hop route. Manifest stores actual counts,
  time range, seeded-pattern descriptions and expected algorithm results — recomputed
  at startup (`refreshManifest`) so displayed numbers always match stored rows.
- **Import Dataset** button (Explorer toolbar + Dashboard): CSV and JSON import with
  validation (required columns, address/tx-hash formats, amount normalization to 18
  decimals, timestamp checks, duplicate detection), row-level errors, preview and an
  import summary. Files are bounded (8 MB CSV / 20,000 rows) and never executed.
- Data isolation: every query takes a `network` (dataset slug) parameter; dashboards,
  graph, traces, alerts and reports are scoped to the active dataset.
- Curated scenarios (multi-hop, branching, hub, cycle, disconnected, mixed) are listed
  in the manifest and launched from the Explorer sidebar.

## Algorithms
BFS (fewest hops), DFS, Dijkstra (cost or amount metric), DFS cycle detection, degree
analysis, Tarjan SCC, connected components, bounded neighborhood queries.

## Limitations
- SQLite used instead of PostgreSQL; imported datasets persist in backend/data/chainscope.db.
- Amounts stored as raw text (18-decimals wei-style); JS Number conversion may lose
  precision for extreme values — raw string is preserved and displayed exactly.
- Graph patterns are not proof of illicit activity; synthetic data is never real
  blockchain evidence.
- Live blockchain provider (Etherscan) is configuration-only and unverified.
