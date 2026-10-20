import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export default function Cases() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const list = useQuery({ queryKey: ['investigations'], queryFn: () => api('/investigations') });
  const create = useMutation({
    mutationFn: (n: string) => api('/investigations', { method: 'POST', body: JSON.stringify({ name: n }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investigations'] }); setName(''); },
  });
  const [selected, setSelected] = useState<number | null>(null);
  const detail = useQuery({ queryKey: ['investigation', selected], queryFn: () => api(`/investigations/${selected}`), enabled: selected !== null });
  const [addrToAdd, setAddrToAdd] = useState('');
  const addAddr = useMutation({
    mutationFn: (a: string) => api(`/investigations/${selected}/addresses`, { method: 'POST', body: JSON.stringify({ address: a }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investigation', selected] }); setAddrToAdd(''); },
  });
  const genReport = useMutation({
    mutationFn: () => api('/reports/generate', { method: 'POST', body: JSON.stringify({ investigationId: selected }) }),
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Investigations & Reports</h1>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="new investigation name" className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <button onClick={() => create.mutate(name)} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm">Create</button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-3">
          <h2 className="font-semibold mb-2 text-sm">Cases</h2>
          <ul className="space-y-1 text-xs">
            {(list.data ?? []).map((inv: any) => (
              <li key={inv.id} onClick={() => setSelected(inv.id)} className={`cursor-pointer p-1 rounded ${selected === inv.id ? 'bg-[var(--panel-2)]' : ''}`}>{inv.name}</li>
            ))}
          </ul>
        </div>
        <div className="col-span-2 bg-[var(--panel)] border border-[var(--border)] rounded p-3">
          {detail.data ? (
            <div className="space-y-2 text-xs">
              <div className="font-semibold">{detail.data.name}</div>
              <div>Addresses: {detail.data.addresses.join(', ') || '—'}</div>
              <div className="flex gap-2">
                <input value={addrToAdd} onChange={e => setAddrToAdd(e.target.value)} placeholder="address to add" className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1" />
                <button onClick={() => addAddr.mutate(addrToAdd)} className="px-2 py-1 bg-[var(--accent)] text-black rounded">Add</button>
              </div>
              <button onClick={() => genReport.mutate()} className="px-3 py-1 bg-[var(--cyan)] text-black rounded">Generate report</button>
              {genReport.data && <pre className="mt-2 overflow-auto max-h-60">{JSON.stringify(genReport.data, null, 2)}</pre>}
            </div>
          ) : <div className="text-[var(--muted)]">Select a case</div>}
        </div>
      </div>
    </div>
  );
}