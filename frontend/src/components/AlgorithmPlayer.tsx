import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';
import { shortAddr } from '../utils/format';
import { Term } from './Help';

export interface AlgoStep { current?: string; exploring?: string; hasEdge?: boolean; edge?: any; visitOrder?: string[]; settleOrder?: string[]; event?: string; distance?: number; candidateDist?: number; newDist?: number; bestDist?: number; distances?: Record<string, number>; }

export default function AlgorithmPlayer({ initialSource, initialDestination, datasetSlug, onHighlight }: { initialSource: string; initialDestination: string; datasetSlug: string; onHighlight: (h: { current: string | null; exploring: string | null; visited: string[]; path: string[] }) => void; }) {
  // Fully controlled by parent props: parent computes fallbacks (scenario
  // source, first graph node) so the button enables as soon as data arrives.
  // Local state caused a stale-empty race after graph load; do not duplicate
  // props into state here.
  const src = initialSource;
  const dst = initialDestination;
  const [algo, setAlgo] = useState<'bfs' | 'dfs' | 'dijkstra'>('bfs');
  const [steps, setSteps] = useState<AlgoStep[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const timer = useRef<number>(0);
  const mut = useMutation({
    mutationFn: (body: any) => {
      const b = { ...body, destination: body.destination || body.source };
      return api(`/graph/trace-steps?network=${encodeURIComponent(datasetSlug)}`, { method: 'POST', body: JSON.stringify(b) });
    },
    onSuccess: (d) => { setSteps(d.result.steps ?? []); setMeta(d.result); setIdx(0); setPlaying(false); },
  });
  const step = steps[idx];
  useEffect(() => {
    if (!step) { onHighlight({ current: null, exploring: null, visited: [], path: [] }); return; }
    onHighlight({
      current: step.current ?? null,
      exploring: step.exploring ?? null,
      visited: step.visitOrder ?? step.settleOrder ?? [],
      path: meta?.path ?? [],
    });
  }, [idx, steps]);
  useEffect(() => {
    if (!playing || !steps.length) return;
    timer.current = window.setTimeout(() => setIdx((i) => {
      if (i + 1 >= steps.length) { setPlaying(false); return i; }
      return i + 1;
    }), Math.round(650 / speed));
    return () => window.clearTimeout(timer.current);
  }, [playing, idx, steps.length, speed]);
  const visited = useMemo(() => step?.visitOrder ?? step?.settleOrder ?? [], [step]);
  return (
    <div className="space-y-2 text-xs">
      <div className="text-[11px] text-[var(--muted)]">Source <span className="font-mono text-[var(--fg)]">{src ? src.slice(0, 10) + '…' : '(none — load a graph first)'}</span>{dst ? <span> → <span className="font-mono text-[var(--fg)]">{dst.slice(0, 10)}…</span></span> : null}</div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={algo} onChange={(e) => setAlgo(e.target.value as any)} className="bg-[var(--panel-2)] rounded px-2 py-1.5">
          <option value="bfs">BFS — fewest hops</option>
          <option value="dfs">DFS — depth-first</option>
          <option value="dijkstra">Dijkstra — lowest cost</option>
        </select>
        <button disabled={!src || mut.isPending} onClick={() => mut.mutate({ source: src, destination: dst, algorithm: algo, maxHops: 6, maxSteps: 300 })} className="px-3 py-1.5 bg-[var(--cyan)] text-black rounded disabled:opacity-50">{mut.isPending ? 'Computing…' : 'Compute steps'}</button>
        <button disabled={!steps.length} onClick={() => setPlaying((p) => !p)} className="px-3 py-1.5 bg-[var(--panel-2)] rounded disabled:opacity-40">{playing ? 'Pause' : 'Play'}</button>
        <button disabled={!steps.length} onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))} className="px-3 py-1.5 bg-[var(--panel-2)] rounded disabled:opacity-40">Step forward</button>
        <button disabled={!steps.length} onClick={() => { setIdx(0); setPlaying(false); }} className="px-3 py-1.5 bg-[var(--panel-2)] rounded disabled:opacity-40">Reset</button>
        <label className="flex items-center gap-1">Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-[var(--panel-2)] rounded px-1 py-1">
            <option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option>
          </select>
        </label>
      </div>
      {algo === 'bfs' && <p className="text-[11px] text-[var(--muted)]"><Term name="BFS">BFS</Term> visits addresses level by level. Current node, explored edge, and visit order come from the real engine trace.</p>}
      {algo === 'dfs' && <p className="text-[11px] text-[var(--muted)]"><Term name="DFS">DFS</Term> dives deep along one branch before backtracking. Steps below are the actual engine visit order.</p>}
      {algo === 'dijkstra' && <p className="text-[11px] text-[var(--muted)]"><Term name="Dijkstra">Dijkstra</Term> settles the cheapest unvisited address first and relaxes outgoing edges. Watch tentative distances update.</p>}
      {mut.isError && <div className="text-[var(--danger)]">{String(mut.error)}</div>}
      {steps.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-[var(--muted)]">Step {idx + 1}/{steps.length}</span>
            <div className="flex-1 h-1.5 rounded bg-[var(--panel-2)] overflow-hidden"><div className="h-full bg-[var(--cyan)]" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} /></div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-2 space-y-1">
            <div>Visiting: <span className="font-mono text-[var(--accent)]">{step?.current ? shortAddr(step.current) : '—'}</span>{step?.exploring ? <span> → exploring <span className="font-mono text-[var(--cyan)]">{shortAddr(step.exploring)}</span></span> : null}</div>
            {step?.event && <div>Event: <span className="font-mono">{step.event}</span>{step.event === 'relaxed-improved' ? <span className="text-[var(--accent)]"> — shorter path found (new dist {step.newDist})</span> : null}</div>}
            {step?.distance != null && <div>Tentative distance: <span className="font-mono">{step.distance}</span></div>}
            {step?.candidateDist != null && <div>Candidate: <span className="font-mono">{step.candidateDist}</span> vs best <span className="font-mono">{step.bestDist}</span></div>}
            <div className="text-[var(--muted)]">Visited ({visited.length}): <span className="font-mono">{visited.slice(0, 12).map(shortAddr).join(', ')}{visited.length > 12 ? '…' : ''}</span></div>
          </div>
          {meta && (
            <div className="text-[11px] text-[var(--muted)]">{meta.found ? <>Final path ({meta.path?.length ?? 0} nodes){meta.cost != null && meta.cost >= 0 ? ` · total cost ${meta.cost}` : ''}{meta.hops != null && meta.hops >= 0 ? ` · ${meta.hops} hops` : ''}: <span className="font-mono text-[var(--fg)]">{(meta.path ?? []).map(shortAddr).join(' → ')}</span></> : 'No path found within constraints.'}</div>
          )}
        </>
      )}
    </div>
  );
}
