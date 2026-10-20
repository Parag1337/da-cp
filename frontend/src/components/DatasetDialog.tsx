import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { FirstUse } from './Help';

export function useDatasets() {
  return useQuery({ queryKey: ['datasets'], queryFn: () => api('/datasets') });
}

export default function DatasetDialog({ open, onClose, activeSlug, onSelect }: { open: boolean; onClose: () => void; activeSlug: string; onSelect: (slug: string) => void; }) {
  const qc = useQueryClient();
  const ds = useDatasets();
  const [tab, setTab] = useState<'sample' | 'csv' | 'json'>('sample');
  const [name, setName] = useState('');
  const [csv, setCsv] = useState('from_address,to_address,amount,asset,timestamp,transaction_hash\n');
  const [json, setJson] = useState('[\n  {"from_address": "0x", "to_address": "0x", "amount": "1000000000000000000", "asset": "ETH", "timestamp": 1700000000, "transaction_hash": "0x"}\n]');
  const [result, setResult] = useState<any>(null);
  const imp = useMutation({
    mutationFn: (body: any) => api('/datasets/import', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (d) => { setResult(d.summary ?? d); qc.invalidateQueries({ queryKey: ['datasets'] }); if (d.dataset?.slug) onSelect(d.dataset.slug); },
  });
  if (!open) return null;
  const previewCsv = csv.split('\n').slice(0, 6);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto bg-[var(--panel)] border border-[var(--border)] rounded-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Import dataset</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--fg)]">Close</button>
        </div>
        <FirstUse id="dataset-import" title="Datasets keep investigations separate">Each dataset is one network snapshot. Switching datasets never mixes records — dashboard, graph, traces and alerts always query the selected dataset.</FirstUse>
        <div className="text-xs">
          <div className="text-[var(--muted)] mb-1">Active dataset</div>
          <div className="flex flex-wrap gap-2">
            {(ds.data ?? []).map((d: any) => (
              <button key={d.slug} onClick={() => onSelect(d.slug)} className={`px-2 py-1 rounded border text-xs ${d.slug === activeSlug ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>
                {d.name} · {d.transfer_count} transfers {d.synthetic ? '(synthetic)' : '(imported)'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          {(['sample', 'csv', 'json'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded ${tab === t ? 'bg-[var(--accent)] text-black' : 'bg-[var(--panel-2)]'}`}>{t === 'sample' ? 'Built-in samples' : t.toUpperCase()}</button>
          ))}
        </div>
        {tab === 'sample' && (
          <div className="text-xs space-y-2">
            <p className="text-[var(--muted)]">The seeded synthetic investigation dataset (360 addresses, ~2,600 transfers, hubs, cycles, isolated components) is already loaded. Re-select it below if you switched away.</p>
            <button onClick={() => { onSelect('ethereum-demo'); onClose(); }} className="px-3 py-1.5 bg-[var(--accent)] text-black rounded">Load synthetic investigation dataset</button>
          </div>
        )}
        {tab === 'csv' && (
          <div className="space-y-2 text-xs">
            <p className="text-[var(--muted)]">Columns: <code>from_address, to_address, amount, asset, timestamp, transaction_hash</code> (asset optional). Amount is an integer in smallest units or a decimal string (max 18 decimals). Timestamp is unix seconds.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="dataset name" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5" />
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} className="w-full font-mono bg-[var(--bg)] border border-[var(--border)] rounded p-2" />
            <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-2 max-h-32 overflow-auto">
              <div className="text-[var(--muted)] mb-1">Preview (first rows)</div>
              {previewCsv.map((r, i) => <div key={i} className="font-mono truncate">{r}</div>)}
            </div>
            <button disabled={!name || imp.isPending} onClick={() => imp.mutate({ name, csv, format: 'csv' })} className="px-3 py-1.5 bg-[var(--accent)] text-black rounded disabled:opacity-50">{imp.isPending ? 'Importing…' : 'Validate & import CSV'}</button>
          </div>
        )}
        {tab === 'json' && (
          <div className="space-y-2 text-xs">
            <p className="text-[var(--muted)]">JSON array of objects with the same fields as CSV. Malformed rows are rejected with row-level errors — never silently ignored.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="dataset name" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5" />
            <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={8} className="w-full font-mono bg-[var(--bg)] border border-[var(--border)] rounded p-2" />
            <button disabled={!name || imp.isPending} onClick={() => { let records: any; try { records = JSON.parse(json); } catch (e: any) { setResult({ error: 'Invalid JSON: ' + e.message }); return; } imp.mutate({ name, records, format: 'json' }); }} className="px-3 py-1.5 bg-[var(--accent)] text-black rounded disabled:opacity-50">{imp.isPending ? 'Importing…' : 'Validate & import JSON'}</button>
          </div>
        )}
        {imp.isError && <div className="text-xs text-[var(--danger)]">{String(imp.error)}</div>}
        {result && (
          <div className="text-xs bg-[var(--bg)] border border-[var(--border)] rounded p-3 space-y-1">
            {result.error ? <div className="text-[var(--danger)]">{result.error}</div> : (
              <>
                <div>Total rows: {result.totalRows} · Valid: {result.validRows} · Inserted: {result.inserted} · Duplicates skipped: {result.duplicates} · Invalid: {result.invalidRows}</div>
                {(result.errors ?? []).map((e: string, i: number) => <div key={i} className="text-[var(--danger)]">{e}</div>)}
                {(!result.errors || result.errors.length === 0) && <div className="text-[var(--accent)]">Import succeeded — dataset is now active.</div>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
