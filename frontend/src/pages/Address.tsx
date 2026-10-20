import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export default function Address() {
  const { address } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['address', address], queryFn: () => api(`/addresses/${address}`) });
  const hist = useQuery({ queryKey: ['history', address], queryFn: () => api(`/addresses/${address}/history?page=1&pageSize=20`) });
  if (isLoading) return <div>Loading…</div>;
  if (error) return <div className="text-[var(--danger)]">{String(error)}</div>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-mono break-all">{data.address}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {[
          ['Incoming tx', data.incomingCount],
          ['Outgoing tx', data.outgoingCount],
          ['Unique in counterparties', data.uniqueIncomingCounterparties],
          ['Unique out counterparties', data.uniqueOutgoingCounterparties],
          ['Incoming total (raw)', data.incomingTotal],
          ['Outgoing total (raw)', data.outgoingTotal],
          ['First seen', data.firstSeen],
          ['Last seen', data.lastSeen],
        ].map(([k, v]) => (
          <div key={String(k)} className="bg-[var(--panel)] border border-[var(--border)] rounded p-3">
            <div className="text-xs text-[var(--muted)]">{k}</div>
            <div className="font-mono mt-1 break-all">{String(v ?? '—')}</div>
          </div>
        ))}
      </div>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
        <h2 className="font-semibold mb-2">History</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-[var(--muted)]"><th>Time</th><th>From</th><th>To</th><th>Value</th></tr></thead>
          <tbody>
            {hist.data?.rows?.map((r: any) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td>{r.timestamp}</td>
                <td className="font-mono">{r.from_address.slice(0, 8)}…</td>
                <td className="font-mono">{r.to_address.slice(0, 8)}…</td>
                <td className="font-mono">{r.value_raw}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}