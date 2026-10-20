import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: () => api('/dashboard') });
  if (isLoading) return <div className="text-[var(--muted)]">Loading…</div>;
  if (error) return <div className="text-[var(--danger)]">{String(error)}</div>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview Dashboard</h1>
      <p className="text-sm text-[var(--muted)]">Demo dataset (synthetic) · Network: {data.network}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Transactions', data.txCount],
          ['Unique addresses', data.uniqueAddresses],
          ['Total value (raw)', data.totalValueRaw],
          ['Top addresses', data.topAddresses?.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
            <div className="text-xs text-[var(--muted)]">{k}</div>
            <div className="text-xl font-mono mt-1">{String(v)}</div>
          </div>
        ))}
      </div>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
        <h2 className="font-semibold mb-2">Most active addresses</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-[var(--muted)]"><th className="text-left">Address</th><th>Count</th></tr></thead>
          <tbody>
            {data.topAddresses?.map((t: any) => (
              <tr key={t.addr} className="border-t border-[var(--border)]">
                <td className="font-mono text-xs py-1">{t.addr}</td>
                <td className="text-center">{t.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
        <h2 className="font-semibold mb-2">Recent transfers</h2>
        <div className="text-xs space-y-1">
          {data.recent?.map((r: any) => (
            <div key={r.id} className="font-mono">{r.from_address.slice(0, 10)}… → {r.to_address.slice(0, 10)}… {r.value_raw}</div>
          ))}
        </div>
      </div>
    </div>
  );
}