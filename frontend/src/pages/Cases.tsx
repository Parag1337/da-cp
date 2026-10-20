import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { shortAddr } from '../utils/format';
import { motion } from 'framer-motion';

export default function Cases() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const list = useQuery({ queryKey: ['investigations'], queryFn: () => api('/investigations') });
  const create = useMutation({
    mutationFn: (n: string) => api('/investigations', { method: 'POST', body: JSON.stringify({ name: n }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investigations'] }); setName(''); },
  });
  const detail = useQuery({ queryKey: ['investigation', selected], queryFn: () => api(`/investigations/${selected}`), enabled: selected !== null });
  const [addrToAdd, setAddrToAdd] = useState('');
  const addAddr = useMutation({
    mutationFn: (a: string) => api(`/investigations/${selected}/addresses`, { method: 'POST', body: JSON.stringify({ address: a }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investigation', selected] }); setAddrToAdd(''); },
  });
  const addNote = useMutation({
    mutationFn: (b: string) => api(`/investigations/${selected}/notes`, { method: 'POST', body: JSON.stringify({ body: b }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['investigation', selected] }); setNote(''); },
  });
  const genReport = useMutation({
    mutationFn: () => api('/reports/generate', { method: 'POST', body: JSON.stringify({ investigationId: selected }) }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Investigations & Reports</h1>
        <p className="text-sm text-[var(--muted)] mt-1">An investigation collects addresses, transaction evidence, observations, and analysis results in one place.</p>
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="new investigation name" className="flex-1 bg-[var(--panel)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
        <button onClick={() => name && create.mutate(name)} disabled={!name} className="px-4 py-2 bg-[var(--accent)] text-black rounded text-sm disabled:opacity-50">Create case</button>
      </div>

      {(!list.data || list.data.length === 0) && (
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-8 text-center text-[var(--muted)]">
          No cases yet. Create your first investigation to collect evidence and notes.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[var(--panel)] border border-[var(--border)] rounded p-3">
          <h2 className="font-semibold mb-2 text-sm">Saved cases</h2>
          <ul className="space-y-1 text-xs">
            {(list.data ?? []).map((inv: any) => (
              <li key={inv.id} onClick={() => setSelected(inv.id)} className={`cursor-pointer p-2 rounded ${selected === inv.id ? 'bg-[var(--panel-2)]' : 'hover:bg-[var(--panel-2)]'}`}>
                <div className="font-semibold">{inv.name}</div>
                <div className="text-[var(--muted)]">{inv.status} · {new Date(inv.created_at * 1000).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2 bg-[var(--panel)] border border-[var(--border)] rounded p-4">
          {detail.data ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-sm">
              <div className="font-semibold text-lg">{detail.data.name}</div>
              <div className="text-xs text-[var(--muted)]">Status: {detail.data.status ?? 'open'} · Updated {new Date(detail.data.updated_at * 1000).toLocaleString()}</div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-1">Addresses</div>
                <div className="flex flex-wrap gap-1">
                  {(detail.data.addresses ?? []).map((a: string) => <span key={a} className="font-mono text-xs bg-[var(--panel-2)] rounded px-2 py-0.5">{shortAddr(a)}</span>)}
                  {(detail.data.addresses ?? []).length === 0 && <span className="text-xs text-[var(--muted)]">None yet</span>}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={addrToAdd} onChange={e => setAddrToAdd(e.target.value)} placeholder="address to add" className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs" />
                  <button onClick={() => addrToAdd && addAddr.mutate(addrToAdd)} className="px-2 py-1 bg-[var(--accent)] text-black rounded text-xs">Add</button>
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted)] mb-1">Notes</div>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {(detail.data.notes ?? []).map((n: any) => (
                    <div key={n.id} className="bg-[var(--panel-2)] rounded p-2 text-xs">{n.body} <span className="text-[var(--muted)]">· {new Date(n.created_at * 1000).toLocaleString()}</span></div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="add note" className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs" />
                  <button onClick={() => note && addNote.mutate(note)} className="px-2 py-1 bg-[var(--accent)] text-black rounded text-xs">Add note</button>
                </div>
              </div>
              <button onClick={() => genReport.mutate()} className="px-3 py-1 bg-[var(--cyan)] text-black rounded text-xs">Generate report</button>
              {genReport.data && <pre className="mt-2 overflow-auto max-h-60 text-xs bg-[var(--bg)] p-2 rounded">{JSON.stringify(genReport.data, null, 2)}</pre>}
            </motion.div>
          ) : <div className="text-[var(--muted)]">Select a case to view details.</div>}
        </div>
      </div>
    </div>
  );
}