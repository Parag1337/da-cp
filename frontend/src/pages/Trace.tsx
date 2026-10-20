import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

export default function Trace() {
  const [src, setSrc] = useState('');
  const [dst, setDst] = useState('');
  const [algo, setAlgo] = useState('bfs');
  const [res, setRes] = useState<any>(null);
  const mut = useMutation({
    mutationFn: (body: any) => api('/graph/path', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: setRes,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Fund Tracer</h1>
      <div className="flex gap-2 flex-wrap">
        <input value={src} onChange={e => setSrc(e.target.value)} placeholder="source address" className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <input value={dst} onChange={e => setDst(e.target.value)} placeholder="destination address" className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <select value={algo} onChange={e => setAlgo(e.target.value)} className="bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm">
          <option value="bfs">BFS (min hops)</option>
          <option value="dijkstra">Dijkstra (cost)</option>
        </select>
        <button onClick={() => mut.mutate({ source: src, destination: dst, algorithm: algo, maxHops: 8 })} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm">Trace</button>
      </div>
      {mut.isPending && <div>Running…</div>}
      {mut.isError && <div className="text-[var(--danger)]">{String(mut.error)}</div>}
      {res?.result && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4 text-sm">
          <div>Found: {String(res.result.found)}</div>
          {res.result.found && (
            <>
              <div className="mt-2 font-mono text-xs">{res.result.path?.join(' → ')}</div>
              <div className="mt-2">Hops: {res.result.hops} {res.result.cost !== undefined && `Cost: ${res.result.cost}`}</div>
              <div className="mt-2 text-xs text-[var(--muted)]">Edges:</div>
              <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(res.result.edges, null, 2)}</pre>
            </>
          )}
          {res.result.error && <div className="text-[var(--danger)]">{res.result.error}</div>}
        </div>
      )}
      <p className="text-xs text-[var(--muted)]">Note: address-level graph paths do not prove fund provenance.</p>
    </div>
  );
}