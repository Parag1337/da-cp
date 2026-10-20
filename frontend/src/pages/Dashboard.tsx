import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { formatAmount, shortAddr } from '../utils/format';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, AreaChart, Area } from 'recharts';
import { motion } from 'framer-motion';
import { useDatasets } from '../components/DatasetDialog';
import DatasetDialog from '../components/DatasetDialog';
import { FirstUse, Term } from '../components/Help';

export default function Dashboard() {
  const [slug, setSlug] = useState('ethereum-demo');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard', slug], queryFn: () => api(`/dashboard?network=${encodeURIComponent(slug)}`) });
  const datasets = useDatasets();
  const scenarios = useQuery({ queryKey: ['scenarios', slug], queryFn: () => api(`/scenarios?network=${encodeURIComponent(slug)}`) });
  const alerts = useQuery({ queryKey: ['alerts', slug], queryFn: () => api(`/alerts?network=${encodeURIComponent(slug)}`) });
  if (isLoading) return <div className="animate-pulse text-[var(--muted)]">Loading dashboard…</div>;
  if (error) return <div className="text-[var(--danger)]">{String(error)}</div>;
  const activity = (data.activity ?? []).slice(-30);
  const volumeData = activity.map((a: any) => ({ date: a.date.slice(5), count: a.count }));
  const valueData = activity.map((a: any) => ({ date: a.date.slice(5), value: Number(BigInt(a.volume) / 10n ** 18n) }));
  const topData = (data.topAddresses ?? []).map((t: any) => ({ addr: shortAddr(t.addr), count: t.c }));
  const bySev: Record<string, number> = {};
  for (const a of alerts.data ?? []) bySev[a.severity] = (bySev[a.severity] ?? 0) + 1;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Overview Dashboard</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Live metrics from the selected dataset — every card, chart and list below queries the same data.</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className="bg-[var(--panel)] border border-[var(--border)] rounded px-2 py-1.5">
            {(datasets.data ?? []).map((d: any) => <option key={d.slug} value={d.slug}>{d.name} ({d.transfer_count})</option>)}
          </select>
          <button onClick={() => setDialogOpen(true)} className="px-3 py-1.5 bg-[var(--accent)] text-black rounded font-medium">Import Dataset</button>
        </div>
      </div>
      <FirstUse id="dashboard" title="All numbers come from stored data">Switching datasets recomputes every metric. Synthetic datasets are labeled and never presented as real blockchain evidence.</FirstUse>
      <div className="text-xs text-[var(--muted)] flex items-center gap-2 flex-wrap">
        <span>Dataset: <span className="font-mono text-[var(--fg)]">{data.datasetName}</span></span>
        <span>Network: <span className="font-mono text-[var(--fg)]">{data.network}</span></span>
        <span>Source: {data.provider}</span>
        {data.synthetic ? <span className="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300">SYNTHETIC DATA</span> : <span className="px-2 py-0.5 rounded bg-green-900/40 text-green-300">USER DATA</span>}
        <span>Asset: {data.asset}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Transfers', String(data.txCount), 'Recorded transfers in this dataset.'],
          ['Unique addresses', String(data.uniqueAddresses), 'Distinct addresses observed.'],
          ['Total volume', formatAmount(data.totalValueRaw, data.asset), 'Sum of amounts (raw integer units shown exactly).'],
          ['Pattern alerts', String(alerts.data?.length ?? 0) + ` (${Object.entries(bySev).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'})`, 'Open findings by severity.'],
        ].map(([k, v, tip]) => (
          <motion.div key={String(k)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
            <div className="text-xs text-[var(--muted)]">{k} <Term name="Pattern alert">ⓘ</Term><span className="sr-only">{tip}</span></div>
            <div className="text-lg font-mono mt-1 break-all">{String(v)}</div>
          </motion.div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm">Transaction activity (daily, last 30d)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={volumeData}><CartesianGrid stroke="#23302b" /><XAxis dataKey="date" stroke="#8fa39a" fontSize={10} interval={6} /><YAxis stroke="#8fa39a" fontSize={10} /><Tooltip contentStyle={{ background: '#121816', border: '1px solid #23302b' }} /><Area type="monotone" dataKey="count" stroke="#3ddc84" fill="#3ddc8433" /></AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm">Transfer volume (native units/day)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={valueData}><CartesianGrid stroke="#23302b" /><XAxis dataKey="date" stroke="#8fa39a" fontSize={10} interval={6} /><YAxis stroke="#8fa39a" fontSize={10} /><Tooltip contentStyle={{ background: '#121816', border: '1px solid #23302b' }} /><Line type="monotone" dataKey="value" stroke="#4dd0e1" strokeWidth={2} dot={false} /></LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm">Most active addresses <Term name="High-degree address">(?)</Term></h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topData} layout="vertical"><CartesianGrid stroke="#23302b" /><XAxis type="number" stroke="#8fa39a" fontSize={10} /><YAxis type="category" dataKey="addr" stroke="#8fa39a" fontSize={10} width={90} /><Tooltip contentStyle={{ background: '#121816', border: '1px solid #23302b' }} /><Bar dataKey="count" fill="#4dd0e1" /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm">Recent transfers</h2>
          <div className="text-xs space-y-1 max-h-52 overflow-auto">
            {(data.recent ?? []).map((r: any) => (
              <div key={r.id} className="font-mono flex justify-between gap-2 border-b border-[var(--border)] pb-1">
                <span>{shortAddr(r.from_address)} → {shortAddr(r.to_address)}</span>
                <span className="text-[var(--muted)]">{formatAmount(r.value_raw, r.asset)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm">Quick-start scenarios</h2>
          <div className="space-y-2 text-xs">
            {(scenarios.data?.scenarios ?? []).map((s: any) => (
              <a key={s.id} href={`/explorer`} className="block px-2 py-1.5 bg-[var(--panel-2)] rounded hover:border hover:border-[var(--accent)]">● {s.label}<span className="block text-[var(--muted)]">{s.description}</span></a>
            ))}
          </div>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
          <h2 className="font-semibold mb-2 text-sm">Pattern-alert summary</h2>
          {(alerts.data ?? []).length === 0 ? <p className="text-xs text-[var(--muted)]">No alerts yet — run a scan on the Patterns page.</p> : (
            <ul className="text-xs space-y-1 max-h-52 overflow-auto">
              {(alerts.data ?? []).slice(0, 12).map((a: any) => (
                <li key={a.id} className="flex justify-between gap-2 border-b border-[var(--border)] pb-1"><span>{a.rule}</span><span className={a.severity === 'high' ? 'text-red-300' : 'text-amber-300'}>{a.severity}</span></li>
              ))}
            </ul>
          )}
          <a href="/patterns" className="text-xs text-[var(--accent)] mt-2 inline-block">Open Pattern Detection →</a>
        </div>
      </div>
      <DatasetDialog open={dialogOpen} onClose={() => setDialogOpen(false)} activeSlug={slug} onSelect={(s) => setSlug(s)} />
    </div>
  );
}
