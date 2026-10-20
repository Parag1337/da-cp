import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import Address from './pages/Address';
import Trace from './pages/Trace';
import Patterns from './pages/Patterns';
import Cases from './pages/Cases';

const qc = new QueryClient();

function Shell({ children }: { children: React.ReactNode }) {
  const nav = [
    ['Dashboard', '/dashboard'],
    ['Explorer', '/explorer'],
    ['Trace', '/trace'],
    ['Patterns', '/patterns'],
    ['Cases', '/cases'],
  ];
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-[var(--border)] bg-[var(--panel)] p-4 flex flex-col gap-2">
        <div className="text-lg font-bold text-[var(--accent)] mb-4">ChainScope</div>
        {nav.map(([l, p]) => (
          <NavLink key={p} to={p} className={({ isActive }) => `px-3 py-2 rounded text-sm ${isActive ? 'bg-[var(--panel-2)] text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}>
            {l}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
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