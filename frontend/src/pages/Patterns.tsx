import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { shortAddr } from '../utils/format';
import { motion } from 'framer-motion';
import { FirstUse, Term } from '../components/Help';
import { useDatasets } from '../components/DatasetDialog';

export default function Patterns() {
  const [slug, setSlug] = useState('ethereum-demo');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();
  const datasets = useDatasets();
  const [scanRes, setScanRes] = useState<any>(null);
  const mut = useMutation({
    mutationFn: () => api(`/patterns/scan?network=${encodeURIComponent(slug)}`, { method: 'POST', body: '{}' }),
    onSuccess: (d) => { setScanRes(d); qc.invalidateQueries({ queryKey: ['alerts', slug] }); },
  });
  const alerts = useQuery({ queryKey: ['alerts', slug], queryFn: () => api(`/alerts?network=${encodeURIComponent(slug)}`) });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => api(`/alerts/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', slug] }),
  });
  const list = (alerts.data ?? []).filter((a: any) => {
    if (filter !== 'all' && a.rule !== filter) return false;
    if (search && !a.addresses.join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const bySeverity: Record<string, number> = {};
  for (const a of alerts.data ?? []) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Pattern Detection</h1>
          <p className="text-sm text-[var(--muted)] mt-1"><Term name="Pattern alert">Alerts</Term> flag structures worth a look — <Term name="Directed cycle">cycles</Term>, <Term name="High-degree address">hubs</Term>, fan-outs. They are not proof of wrongdoing.</p>
        </div>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="ml-auto bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5 text-xs">
          {(datasets.data ?? []).map((d: any) => <option key={d.slug} value={d.slug}>{d.name}</option>)}
        </select>
      </div>
      <FirstUse id="patterns" title="How to read an alert">Each card shows the rule, the evidence, the threshold that triggered it, and its limits. Dismiss false positives; add real leads to a case.</FirstUse>
      <div className="flex gap-2 flex-wrap items-center bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3">
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm font-medium disabled:opacity-50">{mut.isPending ? 'Scanning…' : 'Run scan'}</button>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm"><option value="all">All types</option><option value="high-degree">High degree</option><option value="directed-cycle">Directed cycle</option><option value="fan-out">Fan-out</option></select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search addresses" className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <span className="text-xs text-[var(--muted)]">Severity: {Object.entries(bySeverity).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}</span>
      </div>
      {scanRes && <div className="text-sm text-[var(--accent)]">Scan complete: {scanRes.count} findings (stored for this dataset only)</div>}
      <div className="space-y-3">
        {list.map((a: any) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm">{a.rule.replace(/-/g, ' ')} <span className="text-[var(--muted)] font-normal">· {a.status}</span></div>
              <span className={`text-xs px-2 py-0.5 rounded ${a.severity === 'high' ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/40 text-amber-300'}`}>{a.severity}</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">Addresses: {a.addresses.map(shortAddr).join(', ')}</div>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {Object.entries(a.evidence ?? {}).map(([k, v]) => (
                <div key={k} className="bg-[var(--panel-2)] rounded px-2 py-1"><span className="text-[var(--muted)]">{k.replace(/([A-Z])/g, ' $1').trim()}: </span><span className="font-mono">{Array.isArray(v) ? v.join(', ') : String(v)}</span></div>
              ))}
            </div>
            <div className="text-xs text-[var(--muted)] mt-2">Threshold: {a.evidence?.threshold ?? 'structural condition (no numeric threshold)'}</div>
            <div className="text-xs text-[var(--muted)] mt-1">Why flagged: structural pattern detected in the stored graph. Limits: may have benign explanations; graph data may be partial.</div>
            <div className="mt-2 flex gap-3 text-xs">
              <a href={`/explorer`} className="text-[var(--accent)]">View in Explorer</a>
              <a href={`/addresses/${a.addresses[0]}?network=${slug}`} className="text-[var(--accent)]">Open address</a>
              <button onClick={() => statusMut.mutate({ id: a.id, status: 'reviewed' })} className="text-[var(--muted)] hover:text-[var(--fg)]">Mark reviewed</button>
              <button onClick={() => statusMut.mutate({ id: a.id, status: 'dismissed' })} className="text-[var(--muted)] hover:text-[var(--fg)]">Dismiss</button>
            </div>
          </motion.div>
        ))}
        {list.length === 0 && <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-8 text-center text-[var(--muted)] text-sm">No alerts. Run a scan to generate findings for this dataset.</div>}
      </div>
    </div>
  );
}
