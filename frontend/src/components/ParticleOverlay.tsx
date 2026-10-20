import { useEffect, useRef } from 'react';
import { useSigma } from '@react-sigma/core';

export default function ParticleOverlay({
  playing, speed, intensity, show, edges,
}: { playing: boolean; speed: number; intensity: number; show: boolean; edges: any[] }) {
  const sigma = useSigma();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // init particles
    if (particlesRef.current.length === 0 && edges.length) {
      particlesRef.current = edges.slice(0, Math.min(edges.length, 60)).map((e) => ({
        edge: e, t: Math.random(), speed: 0.002 + Math.random() * 0.003,
      }));
    }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (!show) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const displayEdges = particlesRef.current;
      for (const p of displayEdges) {
        if (playing) p.t += p.speed * speed;
        if (p.t > 1) { p.t = 0; }
        const src = sigma.getNodeDisplayData(p.edge.from);
        const dst = sigma.getNodeDisplayData(p.edge.to);
        if (!src || !dst) continue;
        const x = src.x + (dst.x - src.x) * p.t;
        const y = src.y + (dst.y - src.y) * p.t;
        ctx.beginPath();
        ctx.arc(x, y, 3 + intensity, 0, Math.PI * 2);
        ctx.fillStyle = '#f5a623';
        ctx.fill();
        // arrival highlight
        if (p.t > 0.92) {
          ctx.beginPath();
          ctx.arc(dst.x, dst.y, 12, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245,166,35,0.6)';
          ctx.stroke();
        }
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [sigma, playing, speed, intensity, show, edges]);

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }} />;
}