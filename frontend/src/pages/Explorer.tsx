import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import Graph from 'graphology';
import { SigmaContainer, useRegisterEvents, useSigma } from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import circular from 'graphology-layout/circular';
import circlepack from 'graphology-layout/circlepack';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { formatAmount, shortAddr } from '../utils/format';
import TransactionFlowOverlay, { type FlowStatus } from '../components/TransactionFlowOverlay';
import PlaybackControls from '../components/PlaybackControls';
import AlgorithmPlayer from '../components/AlgorithmPlayer';
import DatasetDialog, { useDatasets } from '../components/DatasetDialog';
import { FirstUse, Term } from '../components/Help';

const EXAMPLES = [
  '0x0000000000000000000000000000000000000001',
  '0x0000000000000000000000000000000000000032',
  '0x000000000000000000000000000000000000000b',
];

function GraphLoader({ graph, highlight, selected }: { graph: Graph | null; highlight: { current: string | null; exploring: string | null; visited: string[]; path: string[] }; selected: string | null }) {
  const sigma = useSigma();
  const hlRef = useRef(highlight);
  hlRef.current = highlight;
  // NOTE: graph instance is passed directly to <SigmaContainer graph={graph}/>,
  // which constructs the Sigma renderer itself. Calling useLoadGraph() here
  // as well raced container creation (WebGL 'allocate of null') so it was removed.
  useEffect(() => {
    if (!graph) return;
    try {
      const h = hlRef.current;
      graph.forEachNode((node) => {
        try {
          // Styling is applied in place; never rebuild the layout on selection.
          const base = graph.getNodeAttributes(node) as any;
          const isCurrent = h.current === node || selected === node;
          const inPath = h.path.includes(node);
          const isVisited = h.visited.includes(node);
          graph.setNodeAttribute(node, 'color', isCurrent ? '#ffd166' : inPath ? '#c792ea' : isVisited ? '#4dd0e1' : base.baseColor ?? '#3ddc84');
          graph.setNodeAttribute(node, 'size', isCurrent ? 13 : base.baseSize ?? 8);
          sigma.setNodeState(node, { isHighlighted: isCurrent || inPath } as any);
        } catch { /* ignore */ }
      });
      graph.forEachEdge((edge) => {
        try {
          const ext = graph.getEdgeAttributes(edge) as any;
          const onPath = h.path.length > 1 && h.path.includes(ext.from) && h.path.includes(ext.to);
          const explored = !!(h.current && h.exploring && ((ext.from === h.current && ext.to === h.exploring) || (ext.from === h.exploring && ext.to === h.current)));
          graph.setEdgeAttribute(edge, 'color', explored ? '#ffd166' : onPath ? '#c792ea' : ext.baseColor ?? '#4dd0e1');
          graph.setEdgeAttribute(edge, 'size', explored ? 3.2 : onPath ? 2.6 : 1.2);
          sigma.setEdgeState(edge, { isHighlighted: explored || onPath } as any);
        } catch { /* ignore */ }
      });
      sigma.refresh();
    } catch { /* ignore */ }
  }, [graph, sigma, highlight, selected]);
  return null;
}

function GraphEvents({ onSelect, onEdge }: { onSelect: (n: string | null) => void; onEdge: (e: any | null) => void }) {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();
  useEffect(() => {
    registerEvents({
      clickNode: (e) => { onSelect(e.node); onEdge(null); },
      clickEdge: (e) => {
        try {
          const g = sigma.getGraph();
          onEdge({ key: e.edge, ...(g.getEdgeAttributes(e.edge) as any) });
        } catch { onEdge(null); }
      },
      clickStage: () => { onSelect(null); onEdge(null); },
    });
  }, [registerEvents, sigma, onSelect, onEdge]);
  return null;
}

export default function Explorer() {
  const [datasetSlug, setDatasetSlug] = useState('ethereum-demo');
  const [center, setCenter] = useState('');
  const [direction, setDirection] = useState('both');
  const [hops, setHops] = useState(2);
  const [layout, setLayout] = useState<'force' | 'circular' | 'pack'>('force');
  const [showLabels, setShowLabels] = useState(true);
  const [graphData, setGraphData] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(2);
  const [showParticles, setShowParticles] = useState(true);
  const [flowStatus, setFlowStatus] = useState<FlowStatus | null>(null);
  const [flowKey, setFlowKey] = useState(0);
  const [highlight, setHighlight] = useState<{ current: string | null; exploring: string | null; visited: string[]; path: string[] }>({ current: null, exploring: null, visited: [], path: [] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const datasets = useDatasets();
  // Fetch with the default dataset slug so scenario fallbacks resolve even
  // before the datasets list finishes loading.
  const scenarios = useQuery({ queryKey: ['scenarios', datasetSlug], queryFn: () => api(`/scenarios?network=${encodeURIComponent(datasetSlug)}`), staleTime: 60000 });

  const mut = useMutation({
    mutationFn: (body: any) => api(`/graph/neighborhood?network=${encodeURIComponent(datasetSlug)}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (d) => { setGraphData(d.graph); setSelected(null); setSelectedEdge(null); setFlowKey((k) => k + 1); },
  });
  const addrQuery = useQuery({ queryKey: ['address', datasetSlug, selected], queryFn: () => api(`/addresses/${selected}?network=${encodeURIComponent(datasetSlug)}`), enabled: !!selected });
  // Algorithm player defaults: prefer an explicit selection/center, else a
  // seeded scenario source, else the first loaded node. Destination prefers
  // a real outgoing neighbor so "Compute steps" is enabled and meaningful.
  const algoSource = selected || center || scenarios.data?.scenarios?.[0]?.source || (graphData?.nodes?.[0] ?? '');
  const algoDest =
    (graphData?.edges ?? []).find((e: any) => e.from === algoSource)?.to ||
    scenarios.data?.scenarios?.[0]?.destination ||
    (graphData?.nodes?.[1] ?? '');
  const activeDs = (datasets.data ?? []).find((d: any) => d.slug === datasetSlug);

  const graph: Graph | null = useMemo(() => {
    if (!graphData) return null;
    const gr = new Graph({ multi: true, type: 'directed' });
    const inC = new Map<string, number>(), outC = new Map<string, number>();
    for (const e of graphData.edges) { outC.set(e.from, (outC.get(e.from) ?? 0) + 1); inC.set(e.to, (inC.get(e.to) ?? 0) + 1); }
    for (const n of graphData.nodes) {
      const deg = (inC.get(n) ?? 0) + (outC.get(n) ?? 0);
      const baseColor = (outC.get(n) ?? 0) >= 15 ? '#f5a623' : '#3ddc84';
      const baseSize = 5 + Math.min(10, deg);
      gr.addNode(n, { label: showLabels ? shortAddr(n) : '', size: baseSize, color: baseColor, baseColor, baseSize, x: Math.random() * 10, y: Math.random() * 10 });
    }
    for (const e of graphData.edges) {
      if (!gr.hasNode(e.from) || !gr.hasNode(e.to)) continue;
      gr.addEdge(e.from, e.to, { size: 1.2, color: '#4dd0e1', baseColor: '#4dd0e1', type: 'arrow', from: e.from, to: e.to, txHash: e.id, amountRaw: e.amountRaw, timestamp: e.timestamp });
    }
    try {
      if (layout === 'force') forceAtlas2.assign(gr, { iterations: 120 });
      else if (layout === 'circular') circular.assign(gr);
      else circlepack.assign(gr);
    } catch { /* layout best-effort */ }
    return gr;
    // NOTE: deliberately excludes `selected`/`highlight` — selection is applied
    // in place by GraphLoader so the layout never re-runs on click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, layout, showLabels]);

  const edges = useMemo(() => (graphData?.edges ?? []).map((e: any) => ({ from: e.from, to: e.to, id: e.id, timestamp: e.timestamp, amountRaw: e.amountRaw, amount: e.amount })), [graphData]);
  const selectedStats = selected && graphData ? {
    node: selected,
    out: graphData.edges.filter((e: any) => e.from === selected),
    in: graphData.edges.filter((e: any) => e.to === selected),
  } : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Graph Explorer</h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">A <Term name="Transaction graph">transaction graph</Term> shows addresses as <Term name="Node">nodes</Term> and transfers as <Term name="Edge">edges</Term>. Arrows point from sender to recipient.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">{activeDs?.name ?? datasetSlug} · {activeDs?.transfer_count ?? '—'} transfers {(activeDs?.synthetic ?? true) ? <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">SYNTHETIC</span> : <span className="px-1.5 py-0.5 rounded bg-green-900/40 text-green-300">IMPORTED</span>}</span>
          <button onClick={() => setDialogOpen(true)} className="px-3 py-1.5 bg-[var(--accent)] text-black rounded font-medium">Import Dataset</button>
        </div>
      </div>
      <FirstUse id="explorer" title="Start here">Enter a starting address (or load the demo graph), then click any node to inspect it. Press Play transaction flow to replay recorded transfers along the edges.</FirstUse>
      <div className="flex gap-3 items-start">
        <aside className={`${leftOpen ? 'w-64' : 'w-10'} shrink-0 bg-[var(--panel)] border border-[var(--border)] rounded p-3 space-y-3 text-xs transition-all`}>
          <button onClick={() => setLeftOpen((v) => !v)} className="text-[var(--muted)]">{leftOpen ? '◀ Hide controls' : '▶'}</button>
          {leftOpen && (
            <>
              <div>
                <label className="text-[var(--muted)]">Starting address <Term name="Hop">(?)</Term></label>
                <input value={center} onChange={(e) => setCenter(e.target.value)} placeholder="0x… (empty = recent network)" className="mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 font-mono" />
                <div className="mt-1 flex flex-wrap gap-1">
                  {EXAMPLES.map((a) => <button key={a} onClick={() => setCenter(a)} className="px-1.5 py-0.5 bg-[var(--panel-2)] rounded font-mono">{shortAddr(a)}</button>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>Direction<select value={direction} onChange={(e) => setDirection(e.target.value)} className="mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5"><option value="both">Both</option><option value="out">Outgoing</option><option value="in">Incoming</option></select></label>
                <label><Term name="Hop">Hops</Term><select value={hops} onChange={(e) => setHops(Number(e.target.value))} className="mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5"><option value={1}>1 hop</option><option value={2}>2 hops</option><option value={3}>3 hops</option></select></label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>Layout<select value={layout} onChange={(e) => setLayout(e.target.value as any)} className="mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5"><option value="force">Force</option><option value="circular">Circular</option><option value="pack">Packed</option></select></label>
                <label className="flex items-end gap-1 pb-2"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Labels</label>
              </div>
              <button onClick={() => mut.mutate({ center: center || undefined, hops, limit: 400, direction })} className="w-full px-3 py-2 bg-[var(--accent)] text-black rounded font-medium">{graphData ? 'Reload graph' : 'Load graph'}</button>
              {(scenarios.data?.scenarios ?? []).length > 0 && (
                <div>
                  <div className="text-[var(--muted)] mb-1">Investigation scenarios</div>
                  <div className="space-y-1">
                    {(scenarios.data.scenarios ?? []).map((s: any) => (
                      <button key={s.id} title={s.description} onClick={() => { setCenter(s.source ?? ''); if (s.source) mut.mutate({ center: s.source, hops: 2, limit: 400, direction: 'both' }); }} className="w-full text-left px-2 py-1.5 bg-[var(--panel-2)] rounded hover:border hover:border-[var(--accent)]">● {s.label}<span className="block text-[var(--muted)]">{s.description}</span></button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
        <section className="flex-1 min-w-0 bg-[var(--panel)] border border-[var(--border)] rounded overflow-hidden relative">
          {!graph ? (
            <div className="p-10 text-center">
              <div className="text-4xl text-[var(--muted)]">◎</div>
              <p className="text-[var(--muted)] mt-3 text-sm">No graph loaded. Enter a starting address or load the demo network.</p>
              <button onClick={() => mut.mutate({ hops: 2, limit: 300 })} className="mt-4 px-4 py-2 bg-[var(--accent)] text-black rounded text-sm font-medium">Load demo graph</button>
              {mut.isPending && <div className="text-[var(--muted)] mt-2 text-xs">Loading graph…</div>}
              {mut.isError && <div className="text-[var(--danger)] mt-2 text-xs">{String(mut.error)}</div>}
            </div>
          ) : (
            <>
              <SigmaContainer style={{ height: '560px', width: '100%' }} graph={graph} options={{ defaultEdgeType: 'arrow', styles: { stage: { background: '#0b0f0e' } } } as any}>
                <GraphLoader graph={graph} highlight={highlight} selected={selected} />
                <GraphEvents onSelect={setSelected} onEdge={setSelectedEdge} />
                <TransactionFlowOverlay key={flowKey} playing={playing} speed={speed} intensity={intensity} show={showParticles} edges={edges} onStatus={setFlowStatus} />
              </SigmaContainer>
              <div className="border-t border-[var(--border)] p-3 bg-[var(--panel)]">
                <PlaybackControls playing={playing} setPlaying={setPlaying} speed={speed} setSpeed={setSpeed} intensity={intensity} setIntensity={setIntensity} show={showParticles} setShow={setShowParticles} status={flowStatus} onStop={() => { setPlaying(false); setFlowKey((k) => k + 1); }} onReplay={() => { setFlowKey((k) => k + 1); setPlaying(true); }} />
              </div>
              <div className="px-3 pb-3 border-t border-[var(--border)] pt-3">
                <h3 className="font-semibold mb-2 text-xs">Algorithm playback <span className="text-[var(--muted)] font-normal">(real engine steps)</span></h3>
                <AlgorithmPlayer initialSource={algoSource} initialDestination={algoDest} datasetSlug={datasetSlug} onHighlight={setHighlight} />
              </div>
              <div className="px-3 py-2 text-[11px] text-[var(--muted)] border-t border-[var(--border)] flex flex-wrap gap-x-4 gap-y-1">
                <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-[#3ddc84] mr-1" />Standard address</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-[#ffd166] mr-1" />Selected</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-[#4dd0e1] mr-1" />Visited by algorithm</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-[#c792ea] mr-1" />Examined path</span>
                <span><i className="inline-block w-2.5 h-2.5 rounded-full bg-[#f5a623] mr-1" />High-activity hub</span>
                <span><i className="inline-block w-4 h-0.5 bg-[#4dd0e1] mr-1" />Transfer edge (arrow = direction)</span>
              </div>
            </>
          )}
        </section>
        <aside className={`${rightOpen ? 'w-72' : 'w-10'} shrink-0 bg-[var(--panel)] border border-[var(--border)] rounded p-3 text-xs space-y-3 transition-all`}>
          <button onClick={() => setRightOpen((v) => !v)} className="text-[var(--muted)]">{rightOpen ? 'Details ▶' : '◀'}</button>
          {rightOpen && (
            <>
              {selectedEdge && (
                <div className="rounded border border-[var(--cyan)] p-2 space-y-1">
                  <div className="font-semibold">Transfer record</div>
                  <div className="font-mono break-all">{shortAddr(selectedEdge.from)} → {shortAddr(selectedEdge.to)}</div>
                  <div>Amount: <span className="font-mono">{formatAmount(selectedEdge.amountRaw ?? selectedEdge.amount ?? 0)}</span></div>
                  <div>Time: {selectedEdge.timestamp ? new Date(selectedEdge.timestamp * 1000).toLocaleString() : '—'}</div>
                  <div className="font-mono break-all">Hash: {selectedEdge.txHash ?? selectedEdge.key ?? '—'}</div>
                  <div>Source: {activeDs?.source ?? 'stored dataset'} · {(activeDs?.synthetic ?? true) ? 'synthetic' : 'imported'}</div>
                </div>
              )}
              <h2 className="font-semibold">Address details</h2>
              {selectedStats ? (
                <div className="space-y-2">
                  <div className="font-mono break-all">{selectedStats.node}</div>
                  <div className="flex gap-2">
                    <button onClick={() => navigator.clipboard.writeText(selectedStats.node)} className="px-2 py-1 bg-[var(--panel-2)] rounded">Copy</button>
                    <button onClick={() => { setCenter(selectedStats.node); mut.mutate({ center: selectedStats.node, hops, limit: 400, direction }); }} className="px-2 py-1 bg-[var(--panel-2)] rounded">Expand neighbors</button>
                  </div>
                  {addrQuery.data ? (
                    <div className="grid grid-cols-2 gap-1">
                      <div className="bg-[var(--panel-2)] rounded p-1.5">In: {addrQuery.data.incomingCount}<br /><span className="text-[var(--muted)] font-mono">{formatAmount(addrQuery.data.incomingTotal)}</span></div>
                      <div className="bg-[var(--panel-2)] rounded p-1.5">Out: {addrQuery.data.outgoingCount}<br /><span className="text-[var(--muted)] font-mono">{formatAmount(addrQuery.data.outgoingTotal)}</span></div>
                      <div className="bg-[var(--panel-2)] rounded p-1.5">Unique in: {addrQuery.data.uniqueIncomingCounterparties}</div>
                      <div className="bg-[var(--panel-2)] rounded p-1.5">Unique out: {addrQuery.data.uniqueOutgoingCounterparties}</div>
                    </div>
                  ) : <div>In: {selectedStats.in.length} · Out: {selectedStats.out.length}</div>}
                  <div>
                    <div className="text-[var(--muted)] mb-1">Recent transfers</div>
                    <div className="space-y-1 max-h-40 overflow-auto">
                      {[...selectedStats.in, ...selectedStats.out].slice(0, 12).map((e: any, i: number) => (
                        <div key={i} className="font-mono bg-[var(--panel-2)] rounded px-1.5 py-1">{shortAddr(e.from)} → {shortAddr(e.to)} · {formatAmount(e.amountRaw ?? e.amount)}</div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/addresses/${selectedStats.node}?network=${datasetSlug}`} className="px-2 py-1 bg-[var(--panel-2)] rounded">Open profile</a>
                    <a href={`/trace?src=${selectedStats.node}`} className="px-2 py-1 bg-[var(--panel-2)] rounded">Trace a path</a>
                  </div>
                </div>
              ) : <p className="text-[var(--muted)]">Click a node to inspect it. Drag to pan, scroll to zoom.</p>}
            </>
          )}
        </aside>
      </div>
      {graphData && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-3">
          <h2 className="font-semibold mb-2 text-xs">Transfers in view ({graphData.edges.length})</h2>
          <div className="max-h-44 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--muted)] text-left"><th>From</th><th>To</th><th>Amount</th><th>Time</th></tr></thead>
              <tbody>
                {graphData.edges.slice(0, 100).map((e: any, i: number) => (
                  <tr key={i} className="border-t border-[var(--border)]">
                    <td className="font-mono">{shortAddr(e.from)}</td>
                    <td className="font-mono">{shortAddr(e.to)}</td>
                    <td>{formatAmount(e.amountRaw ?? e.amount)}</td>
                    <td>{new Date(e.timestamp * 1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <DatasetDialog open={dialogOpen} onClose={() => setDialogOpen(false)} activeSlug={datasetSlug} onSelect={(s) => setDatasetSlug(s)} />
    </div>
  );
}
