import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export const GLOSSARY: Record<string, string> = {
  'Transaction graph': 'A map of cryptocurrency addresses and the transfers connecting them.',
  'Node': 'A circle representing a cryptocurrency address.',
  'Edge': 'A connection showing a recorded transfer from one address to another.',
  'Hop': 'One connection between two addresses. A route with three connections has three hops.',
  'BFS': 'Finds a route using the fewest connections, regardless of transfer amount.',
  'DFS': 'Explores as far as possible along each branch before backtracking; used here to surface cycles.',
  'Dijkstra': 'Finds the route with the lowest total value of the selected edge-cost metric.',
  'Directed cycle': 'A route through connected addresses that eventually returns to an address already visited.',
  'High-degree address': 'An address connected to many other addresses. High activity alone does not mean suspicious behavior.',
  'Pattern alert': 'A rule has identified a structure worth examining. The alert is not proof of fraud.',
};

export function Term({ name, children }: { name: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const def = GLOSSARY[name] ?? '';
  return (
    <span className="relative inline-flex items-center gap-1">
      <span className="underline decoration-dotted underline-offset-2 cursor-help">{children ?? name}</span>
      <button aria-label={`What is ${name}?`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen((v) => !v)} className="text-[var(--muted)] hover:text-[var(--accent)]">
        <HelpCircle size={13} />
      </button>
      {open && def && (
        <span className="absolute z-50 left-0 top-5 w-60 p-2 rounded bg-[var(--panel-2)] border border-[var(--border)] text-xs text-[var(--fg)] shadow-xl normal-case font-normal">{def}</span>
      )}
    </span>
  );
}

export function FirstUse({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const key = `chainscope-guide-${id}`;
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  if (dismissed) return null;
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs text-[var(--muted)] flex gap-2 items-start">
      <HelpCircle size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
      <div className="flex-1"><span className="font-semibold text-[var(--fg)]">{title}. </span>{children}</div>
      <button onClick={() => { try { localStorage.setItem(key, '1'); } catch {} setDismissed(true); }} className="text-[var(--muted)] hover:text-[var(--fg)]">Dismiss</button>
    </div>
  );
}
