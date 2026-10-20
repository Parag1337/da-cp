import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { formatAmount } from '../utils/format';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import HelpTooltip from '../components/HelpTooltip';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/dashboard') });
  if (isLoading) return <div className="animate-pulse text-[var(--muted)]">Loading dashboard…</div>;
  if (error) return <div className="text-[var(--danger)]">{String(error)}</div>;

  // build volume over time from recent
  const byHour: Record<string, number> = {};
  for (const t of data.recent ?? []) {
    const h = new Date(t.timestamp * 1000).toISOString().slice(0, 13) + ':00';
    byHour[h] = (byHour[h] ?? 0) + 1;
  }
  const volumeData = Object.entries(byHour).map(([k, v]) => ({ time: k.slice(11), count: v }));

  const topData = (data.topAddresses ?? []).map((t: any) => ({ addr: t.addr.slice(0, 8), count: t.c }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview Dashboard</h1>
        <p className="text-sm text-[var(--muted)] mt-1">ChainScope helps you explore how cryptocurrency transfers connect different addresses. This view summarizes the currently loaded dataset.</p>
      </div>
      <div className="text-xs text-[var(--muted)] flex items-center gap-2">
        Network: <span className="font-mono text-[var(--fg)]">{data.network}</span> · Provider: demo-synthetic ·
        <span className="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300">DEMO DATA</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Transactions', data.txCount, 'Number of recorded transfers in the current dataset.'],
          ['Unique addresses', data.uniqueAddresses, 'Number of distinct addresses observed.'],
          ['Total transferred value', formatAmount(data.totalValueRaw), 'Sum of recorded transfer amounts (raw integer units, 18 decimals).'],
          ['Top active addresses', data.topAddresses?.length ?? 0, 'Addresses with highest activity.'],
        ].map(([k, v, tip]) => (
          <motion.div key={String(k)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
            <div className="text-xs text-[var(--muted)] flex items-center gap-1">{k} <HelpTooltip text={String(tip)} /></div>
            <div className="text-xl font-mono mt-1 break-all">{String(v)}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
          <h2 className="font-semibold mb-2 text-sm">Transaction activity (recent)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={volumeData}>
              <CartesianGrid stroke="#23302b" />
              <XAxis dataKey="time" stroke="#8fa39a" fontSize={10} />
              <YAxis stroke="#8fa39a" fontSize={10} />
              <Tooltip contentStyle={{ background: '#121816', border: '1px solid #23302b' }} />
              <Line type="monotone" dataKey="count" stroke="#3ddc84" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
          <h2 className="font-semibold mb-2 text-sm">Most active addresses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topData}>
              <CartesianGrid stroke="#23302b" />
              <XAxis dataKey="addr" stroke="#8fa39a" fontSize={10} />
              <YAxis stroke="#8fa39a" fontSize={10} />
              <Tooltip contentStyle={{ background: '#121816', border: '1px solid #23302b' }} />
              <Bar dataKey="count" fill="#4dd0e1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
          <h2 className="font-semibold mb-2 text-sm">Recent transfers</h2>
          <div className="text-xs space-y-1 max-h-48 overflow-auto">
            {(data.recent ?? []).map((r: any) => (
              <div key={r.id} className="font-mono flex justify-between gap-2">
                <span>{r.from_address.slice(0, 8)}… → {r.to_address.slice(0, 8)}…</span>
                <span className="text-[var(--muted)]">{formatAmount(r.value_raw)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
          <h2 className="font-semibold mb-2 text-sm">Quick start</h2>
          <ul className="text-sm space-y-2 text-[var(--muted)]">
            <li>→ Open <a href="/explorer" className="text-[var(--accent)]">Explorer</a> to visualize a transaction graph.</li>
            <li>→ Use <a href="/trace" className="text-[var(--accent)]">Trace</a> to find paths between addresses.</li>
            <li>→ Run <a href="/patterns" className="text-[var(--accent)]">Pattern Detection</a> to review flagged structures.</li>
            <li>→ Create a <a href="/cases" className="text-[var(--accent)]">Case</a> to save evidence.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}