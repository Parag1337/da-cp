import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { formatAmount, shortAddr } from '../utils/format';
import { motion } from 'framer-motion';
import AlgorithmPlayer from '../components/AlgorithmPlayer';
import { FirstUse, Term } from '../components/Help';
import { useDatasets } from '../components/DatasetDialog';

export default function Trace() {
  const params = new URLSearchParams(window.location.search);
  const [slug, setSlug] = useState('ethereum-demo');
  const [src, setSrc] = useState(params.get('src') ?? '');
  const [dst, setDst] = useState(params.get('dst') ?? '');
  const [algo, setAlgo] = useState('bfs');
  const [costMetric, setCostMetric] = useState('cost');
  const [maxHops, setMaxHops] = useState(6);
  const [res, setRes] = useState<any>(null);
  const datasets = useDatasets();
  const scenarios = useQuery({ queryKey: ['scenarios', slug], queryFn: () => api(`/scenarios?network=${encodeURIComponent(slug)}`) });
  const mut = useMutation({
    mutationFn: (body: any) => api(`/graph/path?network=${encodeURIComponent(slug)}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: setRes,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Fund Tracer</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Tracing explores recorded connections between two addresses. A path shows how they are linked in the stored graph — <b>not</b> proof that specific funds traveled the whole route.</p>
        </div>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="ml-auto bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5 text-xs">
          {(datasets.data ?? []).map((d: any) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
      </div>
      <FirstUse id="trace" title="Two tools, two questions">Use Run trace for the final route, and the algorithm player below to watch <Term name="BFS">BFS</Term>/<Term name="DFS">DFS</Term>/<Term name="Dijkstra">Dijkstra</Term> actually explore the graph step by step.</FirstUse>
      {(scenarios.data?.scenarios ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {(scenarios.data.scenarios ?? []).filter((s: any) => s.destination).map((s: any) => (
            <button key={s.id} title={s.description} onClick={() => { setSrc(s.source); setDst(s.destination); setAlgo(s.algorithm ?? 'bfs'); }} className="px-2 py-1 bg-[var(--panel-2)] rounded">▶ {s.label}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2 flex-wrap items-end bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3">
        <div className="flex-1 min-w-[200px]"><label className="text-xs text-[var(--muted)]">Source address</label><input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="0x…" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-mono" /></div>
        <div className="flex-1 min-w-[200px]"><label className="text-xs text-[var(--muted)]">Destination address</label><input value={dst} onChange={(e) => setDst(e.target.value)} placeholder="0x…" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-mono" /></div>
        <select value={algo} onChange={(e) => setAlgo(e.target.value)} className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm"><option value="bfs">BFS — fewest hops</option><option value="dijkstra">Dijkstra — minimum cost</option></select>
        {algo === 'dijkstra' && <select value={costMetric} onChange={(e) => setCostMetric(e.target.value)} className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm"><option value="cost">Cost = 1 per hop</option><option value="amount">Cost = amount</option></select>}
        <select value={maxHops} onChange={(e) => setMaxHops(Number(e.target.value))} className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm">{[4, 6, 8, 10].map((n) => <option key={n} value={n}>{n} hops</option>)}</select>
        <button onClick={() => mut.mutate({ source: src, destination: dst, algorithm: algo, maxHops, costMetric })} disabled={!src || !dst || mut.isPending} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm font-medium disabled:opacity-50">{mut.isPending ? 'Tracing…' : 'Run trace'}</button>
      </div>
      {!res && !mut.isPending && <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-8 text-center text-[var(--muted)] text-sm">Enter a source and destination to trace a route. Try a seeded scenario above for a guaranteed result.</div>}
      {mut.isError && <div className="text-[var(--danger)] text-sm">{String(mut.error)}</div>}
      {res?.result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4 text-sm space-y-3">
          {res.result.found ? (
            <>
              <div className="flex items-center gap-2"><span className="px-2 py-0.5 rounded bg-green-900/40 text-green-300 text-xs">PATH FOUND</span><span className="text-[var(--muted)] text-xs">{res.result.algorithm} · {res.result.metric}</span></div>
              <div className="text-xs text-[var(--muted)]">Hops: {res.result.hops} {res.result.cost !== undefined && `· Total cost: ${res.result.cost}`}</div>
              <div className="space-y-2">
                {res.result.path?.map((p: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
                    <a href={`/addresses/${p}?network=${slug}`} className="font-mono text-xs">{shortAddr(p)}</a>
                    {i < (res.result.edges?.length ?? 0) && <span className="text-xs text-[var(--muted)]">→ {formatAmount(res.result.edges[i].amount)} · {new Date(res.result.edges[i].timestamp * 1000).toLocaleString()}</span>}
                  </div>
                ))}
              </div>
              <div className="text-xs text-[var(--muted)] border-t border-[var(--border)] pt-2">This path connects addresses in the available graph. It does not prove funds traveled the entire route.</div>
            </>
          ) : <div><span className="px-2 py-0.5 rounded bg-red-900/40 text-red-300 text-xs">NO PATH</span><p className="mt-2 text-[var(--muted)]">{res.result.error ?? 'No path found within the available data and hop limit.'}</p></div>}
        </motion.div>
      )}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
        <h2 className="font-semibold mb-2 text-sm">Algorithm playback <span className="text-[var(--muted)] font-normal">(real engine steps — not a mock highlight)</span></h2>
        <AlgorithmPlayer initialSource={src} initialDestination={dst} datasetSlug={slug} onHighlight={() => {}} />
      </div>
    </div>
  );
}
