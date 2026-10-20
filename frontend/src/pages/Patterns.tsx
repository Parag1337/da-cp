import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';

export default function Patterns() {
  const [scanRes, setScanRes] = useState<any>(null);
  const mut = useMutation({
    mutationFn: () => api('/patterns/scan', { method: 'POST', body: '{}' }),
    onSuccess: setScanRes,
  });
  const alerts = useQuery({ queryKey: ['alerts'], queryFn: () => api('/alerts') });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pattern Detection</h1>
      <button onClick={() => mut.mutate()} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm">Run scan</button>
      {mut.isPending && <div>Scanning…</div>}
      {scanRes && <div className="text-sm">Found {scanRes.count} findings</div>}
      <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-4">
        <h2 className="font-semibold mb-2">Alerts</h2>
        <div className="space-y-2 text-xs">
          {(alerts.data ?? []).map((a: any) => (
            <div key={a.id} className="border border-[var(--border)] rounded p-2">
              <div className="font-semibold">{a.rule} <span className="text-[var(--muted)]">({a.severity})</span></div>
              <div>Addresses: {a.addresses.join(', ')}</div>
              <div className="text-[var(--muted)]">Evidence: {JSON.stringify(a.evidence)}</div>
              <div className="text-[var(--muted)]">Threshold: {a.evidence?.threshold}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}