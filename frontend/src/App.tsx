import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Network, Route as RouteIcon, ShieldAlert, FolderKanban } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import Address from './pages/Address';
import Trace from './pages/Trace';
import Patterns from './pages/Patterns';
import Cases from './pages/Cases';

const qc = new QueryClient();

const nav = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, desc: 'Overview and metrics' },
  { label: 'Explorer', path: '/explorer', icon: Network, desc: 'Interactive transaction graph' },
  { label: 'Trace', path: '/trace', icon: RouteIcon, desc: 'Find paths between addresses' },
  { label: 'Patterns', path: '/patterns', icon: ShieldAlert, desc: 'Explainable pattern alerts' },
  { label: 'Cases', path: '/cases', icon: FolderKanban, desc: 'Investigations and reports' },
];

function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-60 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--panel)] p-4 flex md:flex-col gap-2">
        <div className="text-lg font-bold text-[var(--accent)] mb-2 md:mb-4 flex items-center gap-2">
          <Network size={20} /> ChainScope
        </div>
        <div className="hidden md:block text-xs text-[var(--muted)] mb-2">Investigative workstation</div>
        <div className="flex md:flex-col gap-1 flex-1">
          {nav.map(n => {
            const Icon = n.icon;
            return (
              <NavLink key={n.path} to={n.path} className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded text-sm transition ${isActive ? 'bg-[var(--panel-2)] text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--panel-2)]'}`}>
                <Icon size={16} /> <span>{n.label}</span>
              </NavLink>
            );
          })}
        </div>
        <div className="hidden md:block mt-auto text-xs">
          <div className="px-3 py-2 rounded bg-[var(--panel-2)] border border-[var(--border)]">
            <div className="text-[var(--muted)]">Network</div>
            <div className="font-mono text-[var(--fg)]">ethereum-demo</div>
            <div className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[10px]">DEMO DATA</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/addresses/:address" element={<Address />} />
            <Route path="/trace" element={<Trace />} />
            <Route path="/patterns" element={<Patterns />} />
            <Route path="/cases" element={<Cases />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}