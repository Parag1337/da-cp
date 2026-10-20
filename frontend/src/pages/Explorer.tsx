import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import Graph from 'graphology';
import { SigmaContainer, useRegisterEvents } from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { formatAmount, shortAddr } from '../utils/format';
import HelpTooltip from '../components/HelpTooltip';
import { motion } from 'framer-motion';

function GraphEvents({ onSelect }: { onSelect: (n: string | null) => void }) {
  const registerEvents = useRegisterEvents();
  // register once
  useState(() => {
    registerEvents({
      clickNode: (e) => onSelect(e.node),
      clickStage: () => onSelect(null),
    });
  });
  return null;
}

export default function Explorer() {
  const [center, setCenter] = useState('');
  const [graphData, setGraphData] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [direction, setDirection] = useState('both');
  const [hops, setHops] = useState(2);
  const graphRef = useRef<any>(null);

  const mut = useMutation({
    mutationFn: (body: any) => api('/graph/neighborhood', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (d) => { setGraphData(d.graph); setSelected(null); },
  });

  const g = graphData ? (() => {
    const gr = new Graph({ multi: true, type: 'directed' });
    for (const n of graphData.nodes) gr.addNode(n, { label: shortAddr(n), size: 8, color: '#3ddc84' });
    for (const e of graphData.edges) {
      if (!gr.hasNode(e.from) || !gr.hasNode(e.to)) continue;
      gr.addEdge(e.from, e.to, { size: 1.2, color: '#4dd0e1' });
    }
    forceAtlas2.assign(gr, { iterations: 150 });
    graphRef.current = gr;
    return gr;
  })() : null;

  const selectedStats = selected && graphData ? {
    node: selected,
    out: graphData.edges.filter((e: any) => e.from === selected).length,
    in: graphData.edges.filter((e: any) => e.to === selected).length,
  } : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Graph Explorer</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          A transaction graph shows cryptocurrency addresses as nodes and transfers as directed connections between them. Select an address to inspect its activity and expand its connections. <HelpTooltip text="Node = address; Edge = transfer; Direction = from sender to receiver; Hop = one transfer step." />
        </p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input value={center} onChange={e => setCenter(e.target.value)} placeholder="center address (optional)" className="flex-1 min-w-[200px] bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <select value={direction} onChange={e => setDirection(e.target.value)} className="bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm">
          <option value="both">Both directions</option>
          <option value="out">Outgoing</option>
          <option value="in">Incoming</option>
        </select>
        <select value={hops} onChange={e => setHops(Number(e.target.value))} className="bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm">
          <option value={1}>1 hop</option>
          <option value={2}>2 hops</option>
          <option value={3}>3 hops</option>
        </select>
        <button onClick={() => mut.mutate({ center: center || undefined, hops, limit: 200, direction })} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm">
          {graphData ? 'Reload' : 'Load graph'}
        </button>
      </div>

      {!graphData && !mut.isPending && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-8 text-center">
          <NetworkIcon />
          <p className="text-[var(--muted)] mt-3">No graph loaded. Enter a starting address or load the demo network.</p>
          <button onClick={() => mut.mutate({ hops: 2, limit: 120 })} className="mt-4 px-4 py-2 bg-[var(--accent)] text-black rounded text-sm">Load demo graph</button>
        </div>
      )}
      {mut.isPending && <div className="text-[var(--muted)]">Loading graph…</div>}
      {mut.isError && <div className="text-[var(--danger)]">{String(mut.error)}</div>}

      {g && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[var(--panel)] border border-[var(--border)] rounded overflow-hidden">
            <SigmaContainer style={{ height: '520px', width: '100%' }} graph={g}>
              <GraphEvents onSelect={setSelected} />
            </SigmaContainer>
            <div className="p-2 text-xs text-[var(--muted)] border-t border-[var(--border)] flex gap-4">
              <span><span className="inline-block w-3 h-3 rounded-full bg-[#3ddc84] mr-1" />Address</span>
              <span><span className="inline-block w-6 h-0.5 bg-[#4dd0e1] mr-1" />Transfer (direction = arrow)</span>
            </div>
          </div>
          <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
            <h2 className="font-semibold mb-2 text-sm">Address details</h2>
            {selectedStats ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 text-sm">
                <div className="font-mono text-xs break-all">{selectedStats.node}</div>
                <div>Outgoing edges: {selectedStats.out}</div>
                <div>Incoming edges: {selectedStats.in}</div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <a href={`/addresses/${selectedStats.node}`} className="px-3 py-1 bg-[var(--panel-2)] rounded text-xs">Open profile</a>
                  <a href={`/trace?src=${selectedStats.node}`} className="px-3 py-1 bg-[var(--panel-2)] rounded text-xs">Trace from here</a>
                </div>
              </motion.div>
            ) : (
              <p className="text-xs text-[var(--muted)]">Click a node to inspect it. Drag to pan, scroll to zoom.</p>
            )}
          </div>
        </div>
      )}

      {graphData && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
          <h2 className="font-semibold mb-2 text-sm">Transfers in view ({graphData.edges.length})</h2>
          <div className="max-h-48 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--muted)]"><th>From</th><th>To</th><th>Amount</th><th>Time</th></tr></thead>
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
    </div>
  );
}

function NetworkIcon() {
  return <div className="text-4xl text-[var(--muted)]">◎</div>;
}