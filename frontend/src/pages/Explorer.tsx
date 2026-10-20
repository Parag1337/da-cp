import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import Graph from 'graphology';
import { SigmaContainer } from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import forceAtlas2 from 'graphology-layout-forceatlas2';

function GraphView({ graphData }: { graphData: any }) {
  const [g] = useState(() => {
    const gr = new Graph({ multi: true, type: 'directed' });
    for (const n of graphData.nodes) gr.addNode(n, { label: n.slice(0, 8), size: 6, color: '#3ddc84' });
    for (const e of graphData.edges) {
      if (!gr.hasNode(e.from) || !gr.hasNode(e.to)) continue;
      gr.addEdge(e.from, e.to, { size: 1, color: '#4dd0e1' });
    }
    forceAtlas2.assign(gr, { iterations: 100 });
    return gr;
  });
  return (
    <SigmaContainer style={{ height: '500px', width: '100%' }} graph={g}>
    </SigmaContainer>
  );
}

export default function Explorer() {
  const [center, setCenter] = useState('');
  const [result, setResult] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const mut = useMutation({
    mutationFn: (body: any) => api('/graph/neighborhood', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (d) => { setGraphData(d.graph); setResult(d.analysis); },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Graph Explorer</h1>
      <div className="flex gap-2">
        <input value={center} onChange={e => setCenter(e.target.value)} placeholder="center address (optional)" className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <button onClick={() => mut.mutate({ center: center || undefined, hops: 2, limit: 200 })} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm">Load</button>
      </div>
      {mut.isPending && <div>Loading…</div>}
      {mut.isError && <div className="text-[var(--danger)]">{String(mut.error)}</div>}
      {graphData && <GraphView graphData={graphData} />}
      {result && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4 text-xs">
          <pre className="overflow-auto max-h-60">{JSON.stringify(result, null, 2).slice(0, 2000)}</pre>
        </div>
      )}
    </div>
  );
}