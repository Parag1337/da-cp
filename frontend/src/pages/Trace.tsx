import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { formatAmount, shortAddr } from '../utils/format';
import { motion } from 'framer-motion';
import HelpTooltip from '../components/HelpTooltip';

export default function Trace() {
  const [src, setSrc] = useState('');
  const [dst, setDst] = useState('');
  const [algo, setAlgo] = useState('bfs');
  const [maxHops, setMaxHops] = useState(6);
  const [res, setRes] = useState<any>(null);
  const mut = useMutation({
    mutationFn: (body: any) => api('/graph/path', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: setRes,
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Fund Tracer</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Fund tracing explores recorded transaction connections between two addresses. A path shows how the addresses are connected in the available graph; it does not by itself prove that specific funds traveled along the entire route. <HelpTooltip text="Fewest hops = path with fewest connections. Minimum cost = smallest sum of selected edge costs." />
        </p>
      </div>
      <div className="flex gap-2 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-[var(--muted)]">Source address</label>
          <input value={src} onChange={e => setSrc(e.target.value)} placeholder="0x…" className="w-full bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-[var(--muted)]">Destination address</label>
          <input value={dst} onChange={e => setDst(e.target.value)} placeholder="0x…" className="w-full bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        </div>
        <select value={algo} onChange={e => setAlgo(e.target.value)} className="bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm">
          <option value="bfs">BFS — fewest hops</option>
          <option value="dijkstra">Dijkstra — minimum cost</option>
        </select>
        <select value={maxHops} onChange={e => setMaxHops(Number(e.target.value))} className="bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm">
          {[4, 6, 8, 10].map(n => <option key={n} value={n}>{n} hops</option>)}
        </select>
        <button onClick={() => mut.mutate({ source: src, destination: dst, algorithm: algo, maxHops, costMetric: 'cost' })} disabled={!src || !dst || mut.isPending} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm disabled:opacity-50">
          {mut.isPending ? 'Tracing…' : 'Run trace'}
        </button>
      </div>

      {!res && !mut.isPending && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-8 text-center text-[var(--muted)]">
          Enter a source and destination address to trace a path through the recorded transaction graph.
        </div>
      )}
      {mut.isError && <div className="text-[var(--danger)]">{String(mut.error)}</div>}

      {res?.result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[var(--panel)] border border-[var(--border)] rounded p-4 text-sm space-y-3">
          {res.result.found ? (
            <>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-green-900/40 text-green-300 text-xs">PATH FOUND</span>
                <span className="text-[var(--muted)] text-xs">{res.result.algorithm} · {res.result.metric}</span>
              </div>
              <div className="text-xs text-[var(--muted)]">Hops: {res.result.hops} {res.result.cost !== undefined && `· Total cost: ${res.result.cost}`}</div>
              <div className="space-y-2">
                {res.result.path?.map((p: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
                    <span className="font-mono text-xs">{shortAddr(p)}</span>
                    {i < (res.result.edges?.length ?? 0) && (
                      <span className="text-xs text-[var(--muted)]">→ {formatAmount(res.result.edges[i].amount)} · {new Date(res.result.edges[i].timestamp * 1000).toLocaleString()}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-xs text-[var(--muted)] border-t border-[var(--border)] pt-2">
                This path connects addresses in the available graph. It does not prove funds traveled the entire route.
              </div>
            </>
          ) : (
            <div>
              <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-300 text-xs">NO PATH</span>
              <p className="mt-2 text-[var(--muted)]">{res.result.error ?? 'No path found within the available data and hop limit.'}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}