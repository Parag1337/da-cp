import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { formatAmount, shortAddr } from '../utils/format';
import { FirstUse, Term } from '../components/Help';

export default function Address() {
  const { address } = useParams();
  const [sp] = useSearchParams();
  const slug = sp.get('network') ?? 'ethereum-demo';
  const [caseId, setCaseId] = useState('');
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['address', slug, address], queryFn: () => api(`/addresses/${address}?network=${encodeURIComponent(slug)}`) });
  const hist = useQuery({ queryKey: ['history', slug, address], queryFn: () => api(`/addresses/${address}/history?network=${encodeURIComponent(slug)}&page=1&pageSize=20`) });
  const cases = useQuery({ queryKey: ['investigations'], queryFn: () => api('/investigations') });
  const save = useMutation({
    mutationFn: (id: string) => api(`/investigations/${id}/addresses`, { method: 'POST', body: JSON.stringify({ address }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investigation'] }),
  });
  if (isLoading) return <div>Loading…</div>;
  if (error) return <div className="text-[var(--danger)]">{String(error)}</div>;
  return (
    <div className="space-y-4">
      <FirstUse id="address" title="Reading this profile">Incoming = transfers received; outgoing = transfers sent. Totals use exact raw units. High activity alone means nothing suspicious.</FirstUse>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-mono break-all">{data.address}</h1>
        <button onClick={() => navigator.clipboard.writeText(data.address)} className="text-xs px-2 py-1 bg-[var(--panel-2)] rounded">Copy</button>
        <a href="/explorer" className="text-xs text-[var(--accent)]">Explorer</a>
        <a href={`/trace?src=${data.address}`} className="text-xs text-[var(--accent)]">Trace from here</a>
        <span className="text-xs text-[var(--muted)]">Dataset: {slug}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        {[
          ['Incoming transfers', data.incomingCount, 'Transfers received by this address.'],
          ['Outgoing transfers', data.outgoingCount, 'Transfers sent by this address.'],
          ['Unique senders', data.uniqueIncomingCounterparties, 'Distinct addresses that sent to it.'],
          ['Unique recipients', data.uniqueOutgoingCounterparties, 'Distinct addresses it sent to.'],
          ['Incoming total', formatAmount(data.incomingTotal), 'Sum received (exact raw units).'],
          ['Outgoing total', formatAmount(data.outgoingTotal), 'Sum sent (exact raw units).'],
          ['First seen', data.firstSeen ? new Date(data.firstSeen * 1000).toLocaleString() : '—', 'Earliest recorded transfer.'],
          ['Last seen', data.lastSeen ? new Date(data.lastSeen * 1000).toLocaleString() : '—', 'Most recent recorded transfer.'],
        ].map(([k, v, tip]) => (
          <div key={String(k)} className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-3">
            <div className="text-xs text-[var(--muted)]">{k} <Term name="Pattern alert">ⓘ</Term></div>
            <div className="sr-only">{tip}</div>
            <div className="font-mono mt-1 break-all">{String(v ?? '—')}</div>
          </div>
        ))}
      </div>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
        <h2 className="font-semibold mb-2 text-sm">Save to case</h2>
        <div className="flex gap-2 text-xs">
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5">
            <option value="">Select a case…</option>
            {(cases.data ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button disabled={!caseId || save.isPending} onClick={() => caseId && save.mutate(caseId)} className="px-3 py-1.5 bg-[var(--accent)] text-black rounded disabled:opacity-50">Add address to case</button>
        </div>
        {save.isSuccess && <div className="text-xs text-[var(--accent)] mt-1">Saved to case.</div>}
      </div>
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded-lg p-4">
        <h2 className="font-semibold mb-2 text-sm">Transfer history (latest 20)</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-[var(--muted)] text-left"><th>Time</th><th>From</th><th>To</th><th>Value</th><th>Hash</th></tr></thead>
          <tbody>
            {hist.data?.rows?.map((r: any) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td>{new Date(r.timestamp * 1000).toLocaleString()}</td>
                <td className="font-mono">{shortAddr(r.from_address)}</td>
                <td className="font-mono">{shortAddr(r.to_address)}</td>
                <td className="font-mono">{formatAmount(r.value_raw, r.asset)}</td>
                <td className="font-mono">{r.tx_hash.slice(0, 10)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
