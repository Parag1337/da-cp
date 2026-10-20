import { useEffect, useRef } from 'react';
import { useSigma } from '@react-sigma/core';

export interface FlowEdge { from: string; to: string; id?: string; timestamp?: number; amountRaw?: string; amount?: number; txHash?: string; }
interface Particle { edgeIndex: number; speed: number; size: number; lane: number; startAt: number; color: string; }
export interface FlowStatus { mode: 'historical-replay'; playing: boolean; progress: number; currentTime: number | null; startTime: number | null; endTime: number | null; activeParticles: number; }
const PALETTE = ['#f5a623','#4dd0e1','#3ddc84','#c792ea','#ff6b6b','#ffd166'];
const REPLAY_MS = 12000; const FLIGHT_MS = 2200;

export default function TransactionFlowOverlay({ playing, speed, intensity, show, edges, onStatus }: { playing: boolean; speed: number; intensity: number; show: boolean; edges: FlowEdge[]; onStatus?: (s: FlowStatus) => void; }) {
  const sigma = useSigma();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stRef = useRef({ raf: 0, particles: [] as Particle[], lastTick: 0, clock: 0, reduced: false });
  const propsRef = useRef({ playing, speed, intensity, show, onStatus });
  propsRef.current = { playing, speed, intensity, show, onStatus };
  const edgesKey = edges.map((e) => `${e.from}>${e.to}@${e.timestamp ?? 0}#${e.id ?? e.txHash ?? ''}`).join('|');

  useEffect(() => {
    const st = stRef.current;
    const sorted = [...edges].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    const times = sorted.map((e) => e.timestamp ?? 0).filter((t) => t > 0);
    const t0 = times.length ? Math.min(...times) : 0; const t1 = times.length ? Math.max(...times) : 1;
    const span = Math.max(1, t1 - t0);
    const laneCount = new Map<string, number>();
    const dens = [0.4, 0.8, 1.4, 2.2][Math.max(0, Math.min(3, Math.round(propsRef.current.intensity)))] ?? 1;
    const target = Math.max(8, Math.min(220, Math.round(sorted.length * dens)));
    const stride = Math.max(1, Math.floor(sorted.length / target));
    const picked = sorted.filter((_, i) => i % stride === 0).slice(0, 220);
    st.particles = picked.map((e, i) => {
      const idx = edges.indexOf(e);
      const pair = e.from < e.to ? e.from + '|' + e.to : e.to + '|' + e.from;
      const lane = laneCount.get(pair) ?? 0; laneCount.set(pair, lane + 1);
      return { edgeIndex: idx, speed: 1, size: 2.2 + ((String(e.amountRaw ?? e.amount ?? '').length + i) % 4) * 0.7, lane: (lane % 3) - 1, startAt: ((e.timestamp ?? t0) - t0) / span * REPLAY_MS, color: PALETTE[i % PALETTE.length] };
    });
    st.clock = 0;
  }, [edgesKey]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const st = stRef.current;
    try { st.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { st.reduced = false; }
    const resize = () => {
      const parent = canvas.parentElement; if (!parent) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = parent.clientWidth, h = parent.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const arrivals = new Map<string, number>();
    const range = (): [number | null, number | null] => {
      if (!edges.length) return [null, null];
      const ts = edges.map((e) => e.timestamp ?? 0).filter((t) => t > 0);
      if (!ts.length) return [null, null];
      return [Math.min(...ts), Math.max(...ts)];
    };
    const loop = (now: number) => {
      st.raf = requestAnimationFrame(loop);
      const pr = propsRef.current;
      const dt = Math.min(100, now - (st.lastTick || now)); st.lastTick = now;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const [t0, t1] = range();
      const prog = Math.max(0, Math.min(1, st.clock / REPLAY_MS));
      const cur = t0 != null && t1 != null ? Math.round(t0 + (t1 - t0) * prog) : null;
      if (!pr.show || st.reduced) {
        const now3 = performance.now();
        if (now3 - ((st as any).__lastStatus ?? 0) > 500) { (st as any).__lastStatus = now3; pr.onStatus?.({ mode: 'historical-replay', playing: false, progress: prog, currentTime: cur, startTime: t0, endTime: t1, activeParticles: 0 }); }
        return;
      }
      if (pr.playing) { st.clock += dt * pr.speed; if (st.clock > REPLAY_MS + 2500) st.clock = 0; }
      let active = 0;
      for (const p of st.particles) {
        const e = edges[p.edgeIndex]; if (!e) continue;
        let t: number;
        if (pr.playing || st.clock > 0) { t = (st.clock - p.startAt) / FLIGHT_MS; } else { t = (p.edgeIndex % 17) / 17; }
        if (t < 0 || t > 1) continue;
        active++;
        let sx = 0, sy = 0, dx = 0, dy = 0, ok = false;
        try {
          const s = sigma.getNodeDisplayData(e.from) as { x: number; y: number } | undefined;
          const d = sigma.getNodeDisplayData(e.to) as { x: number; y: number } | undefined;
          if (s && d) { const vs = sigma.graphToViewport({ x: s.x, y: s.y }); const vd = sigma.graphToViewport({ x: d.x, y: d.y }); sx = vs.x; sy = vs.y; dx = vd.x; dy = vd.y; ok = true; }
        } catch { ok = false; }
        if (!ok) continue;
        const ex = dx - sx, ey = dy - sy; const len = Math.hypot(ex, ey) || 1;
        const nx = (-ey / len) * p.lane * 4, ny = (ex / len) * p.lane * 4;
        const bow = Math.sin(t * Math.PI);
        const x = sx + ex * t + nx * bow, y = sy + ey * t + ny * bow;
        const g = ctx.createRadialGradient(x, y, 0, x, y, p.size * 3.2);
        g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.size * 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0b0f0e'; ctx.beginPath(); ctx.arc(x, y, p.size + 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2); ctx.fill();
        if (t > 0.94) arrivals.set(e.to, now);
      }
      for (const [node, at] of [...arrivals]) {
        const age = now - at;
        if (age > 700) { arrivals.delete(node); continue; }
        try {
          const d = sigma.getNodeDisplayData(node) as { x: number; y: number } | undefined;
          if (!d) continue;
          const v = sigma.graphToViewport({ x: d.x, y: d.y });
          ctx.beginPath(); ctx.arc(v.x, v.y, 8 + age / 40, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(245,166,35,${Math.max(0, 0.7 - age / 1000)})`; ctx.lineWidth = 2; ctx.stroke();
        } catch { /* ignore */ }
      }
      const now2 = performance.now();
      const last = (st as any).__lastStatus ?? 0;
      const key = `${pr.playing}|${Math.round(prog * 100)}|${active}|${cur}`;
      if (now2 - last > 250 || (st as any).__lastKey !== key) {
        (st as any).__lastStatus = now2; (st as any).__lastKey = key;
        pr.onStatus?.({ mode: 'historical-replay', playing: pr.playing, progress: prog, currentTime: cur, startTime: t0, endTime: t1, activeParticles: active });
      }
    };
    st.lastTick = performance.now();
    st.raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(st.raf); ro.disconnect(); };
  }, [sigma, edges]);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }} />;
}
