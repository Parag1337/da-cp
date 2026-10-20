import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { shortAddr } from '../utils/format';
import { motion } from 'framer-motion';
import HelpTooltip from '../components/HelpTooltip';

export default function Patterns() {
  const [scanRes, setScanRes] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const mut = useMutation({
    mutationFn: () => api('/patterns/scan', { method: 'POST', body: '{}' }),
    onSuccess: setScanRes,
  });
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api('/alerts') });

  const list = (alerts.data ?? []).filter((a: any) => {
    if (filter !== 'all' && a.rule !== filter) return false;
    if (search && !a.addresses.join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const bySeverity: Record<string, number> = {};
  for (const a of alerts.data ?? []) bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pattern Detection</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Alerts identify patterns that may warrant review. They are not proof of wrongdoing and may have benign explanations. <HelpTooltip text="Each alert shows the rule, evidence, threshold, and limitations." />
        </p>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm disabled:opacity-50">
          {mut.isPending ? 'Scanning…' : 'Run scan'}
        </button>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm">
          <option value="all">All types</option>
          <option value="high-degree">High degree</option>
          <option value="directed-cycle">Directed cycle</option>
          <option value="fan-out">Fan-out</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="search addresses" className="bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <span className="text-xs text-[var(--muted)]">Severity: {Object.entries(bySeverity).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}</span>
      </div>
      {scanRes && <div className="text-sm text-[var(--accent)]">Scan complete: {scanRes.count} findings</div>}

      <div className="space-y-3">
        {list.map((a: any) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">{a.rule.replace(/-/g, ' ')}</div>
              <span className={`text-xs px-2 py-0.5 rounded ${a.severity === 'high' ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/40 text-amber-300'}`}>{a.severity}</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">Addresses: {a.addresses.map(shortAddr).join(', ')}</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              {Object.entries(a.evidence ?? {}).map(([k, v]) => (
                <div key={k} className="bg-[var(--panel-2)] rounded px-2 py-1">
                  <span className="text-[var(--muted)]">{k.replace(/([A-Z])/g, ' $1').trim()}: </span>
                  <span className="font-mono">{Array.isArray(v) ? v.join(', ') : String(v)}</span>
                </div>
              ))}
            </div>
            <div className="text-xs text-[var(--muted)] mt-2">Threshold: {a.evidence?.threshold ?? 'structural condition (no numeric threshold)'}</div>
            <div className="text-xs text-[var(--muted)] mt-1">Why flagged: structural pattern detected in the available graph. Limitations: may have benign explanations; graph data may be partial.</div>
            <div className="mt-2 flex gap-2">
              <a href={`/explorer`} className="text-xs text-[var(--accent)]">View in Explorer</a>
              <a href={`/addresses/${a.addresses[0]}`} className="text-xs text-[var(--accent)]">Open address</a>
            </div>
          </motion.div>
        ))}
        {list.length === 0 && <div className="text-[var(--muted)] text-sm">No alerts. Run a scan to generate findings.</div>}
      </div>
    </div>
  );
}