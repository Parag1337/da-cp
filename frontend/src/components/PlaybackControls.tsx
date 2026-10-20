import type { FlowStatus } from './TransactionFlowOverlay';
import { Term } from './Help';

export default function PlaybackControls({ playing, setPlaying, speed, setSpeed, intensity, setIntensity, show, setShow, status, onStop, onReplay }: {
  playing: boolean; setPlaying: (v: boolean | ((p: boolean) => boolean)) => void;
  speed: number; setSpeed: (v: number) => void;
  intensity: number; setIntensity: (v: number) => void;
  show: boolean; setShow: (v: boolean) => void;
  status: FlowStatus | null; onStop: () => void; onReplay: () => void;
}) {
  const fmt = (t: number | null) => (t == null ? '—' : new Date(t * 1000).toLocaleDateString());
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button onClick={() => setPlaying(true)} disabled={playing} className="px-3 py-1.5 bg-[var(--accent)] text-black rounded font-medium disabled:opacity-40">Play transaction flow</button>
        <button onClick={() => setPlaying(false)} disabled={!playing} className="px-3 py-1.5 bg-[var(--panel-2)] rounded disabled:opacity-40">Pause</button>
        <button onClick={() => { setPlaying((p: boolean) => !p); }} className="px-3 py-1.5 bg-[var(--panel-2)] rounded">Resume</button>
        <button onClick={onStop} className="px-3 py-1.5 bg-[var(--panel-2)] rounded">Stop</button>
        <button onClick={onReplay} className="px-3 py-1.5 bg-[var(--panel-2)] rounded">Replay</button>
        <label className="flex items-center gap-1">Speed
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-[var(--panel-2)] rounded px-1 py-1">
            <option value={0.5}>0.5x</option><option value={1}>1x</option><option value={2}>2x</option>
          </select>
        </label>
        <label className="flex items-center gap-1">Density
          <select value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="bg-[var(--panel-2)] rounded px-1 py-1">
            <option value={0}>Low</option><option value={1}>Medium</option><option value={2}>High</option><option value={3}>Max</option>
          </select>
        </label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show particles</label>
        <span className="ml-auto px-2 py-0.5 rounded bg-amber-900/40 text-amber-300">HISTORICAL REPLAY</span>
      </div>
      <div className="h-1.5 rounded bg-[var(--panel-2)] overflow-hidden">
        <div className="h-full bg-[var(--accent)] transition-none" style={{ width: `${((status?.progress ?? 0) * 100).toFixed(1)}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span>Status: {status?.playing ? `Replaying (${status.activeParticles} transfers in flight)` : 'Paused'}</span>
        <span>Window: {fmt(status?.startTime ?? null)} → {fmt(status?.endTime ?? null)}</span>
        {status?.currentTime != null && <span>Replay cursor: {new Date(status.currentTime * 1000).toLocaleString()}</span>}
      </div>
      <p className="text-[11px] text-[var(--muted)]">Animated dots represent recorded transfers. They move from the <Term name="Edge">sending address to the receiving address</Term>. Playback visualizes stored data; it does not initiate cryptocurrency transactions.</p>
      <div className="grid grid-cols-2 gap-1 text-[11px] text-[var(--muted)]">
        <span><i className="inline-block w-2 h-2 rounded-full bg-[#f5a623] mr-1" />Moving dot: a recorded transfer being replayed</span>
        <span>Arrow direction: sender → recipient</span>
        <span><i className="inline-block w-2 h-2 rounded-full bg-[#3ddc84] mr-1" />Highlighted node: selection or algorithm focus</span>
        <span><i className="inline-block w-4 h-0.5 bg-[#c792ea] mr-1" />Highlighted route: the path being examined</span>
      </div>
    </div>
  );
}
