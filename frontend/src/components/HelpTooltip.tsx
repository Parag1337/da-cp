import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export default function HelpTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} className="text-[var(--muted)] hover:text-[var(--accent)]" aria-label="help">
        <HelpCircle size={14} />
      </button>
      {open && (
        <span className="absolute z-50 left-6 top-0 w-64 p-2 rounded bg-[var(--panel-2)] border border-[var(--border)] text-xs text-[var(--fg)] shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}