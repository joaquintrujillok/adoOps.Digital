"use client";

import { useEffect, useRef } from "react";

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    type Node = { x: number; y: number; bx: number; by: number; r: number; kind: string; ph: number; vx: number; vy: number };
    let nodes: Node[] = [];
    let edges: [number, number][] = [];
    let pulses: { e: number; p: number; sp: number }[] = [];
    let t = 0;
    let rafId = 0;

    const lerp = (a: number, b: number, n: number) => a + (b - a) * n;

    function lemniscate(p: number) {
      const k = p * Math.PI * 2;
      const d = 1 + Math.sin(k) * Math.sin(k);
      return { x: Math.cos(k) / d, y: (Math.sin(k) * Math.cos(k)) / d };
    }

    function build() {
      nodes = []; edges = []; pulses = [];
      const cx = W / 2, cy = H / 2;
      const scale = Math.min(W, H) * 0.36;
      const backbone = 16;
      for (let i = 0; i < backbone; i++) {
        const pt = lemniscate(i / backbone);
        const x = cx + pt.x * scale, y = cy + pt.y * scale * 0.95;
        nodes.push({ x, y, bx: x, by: y, r: i % 3 === 0 ? 4.5 : 3, kind: "bb", ph: Math.random() * 6.28, vx: 0, vy: 0 });
      }
      const extra = Math.max(8, Math.round(W * H / 26000));
      for (let i = 0; i < extra; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        nodes.push({ x, y, bx: x, by: y, r: Math.random() * 2 + 2, kind: "a", ph: Math.random() * 6.28, vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14 });
      }
      for (let i = 0; i < nodes.length; i++) {
        const dists: [number, number][] = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].bx - nodes[j].bx, dy = nodes[i].by - nodes[j].by;
          dists.push([dx * dx + dy * dy, j]);
        }
        dists.sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < 3; k++) {
          if (dists[k] && dists[k][0] < (scale * 1.15) * (scale * 1.15)) edges.push([i, dists[k][1]]);
        }
      }
      for (let i = 0; i < backbone; i++) edges.push([i, (i + 1) % backbone]);
      for (let i = 0; i < Math.min(11, edges.length); i++) {
        pulses.push({ e: Math.floor(Math.random() * edges.length), p: Math.random(), sp: 0.003 + Math.random() * 0.006 });
      }
    }

    function draw() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        if (n.kind === "a") {
          n.bx += n.vx; n.by += n.vy;
          if (n.bx < 0 || n.bx > W) n.vx = -n.vx;
          if (n.by < 0 || n.by > H) n.vy = -n.vy;
        }
        n.x = n.bx + Math.sin(t + n.ph) * 2;
        n.y = n.by + Math.cos(t + n.ph) * 2;
      }
      for (const [a, b] of edges) {
        const na = nodes[a], nb = nodes[b];
        if (!na || !nb) continue;
        const dx = na.x - nb.x, dy = na.y - nb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const al = Math.max(0, 0.18 - dist / Math.max(W, H) * 0.18);
        ctx.strokeStyle = `rgba(46,196,123,${0.05 + al})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
      }
      for (const pu of pulses) {
        const ed = edges[pu.e];
        if (!ed) { pu.e = Math.floor(Math.random() * edges.length); continue; }
        const na = nodes[ed[0]], nb = nodes[ed[1]];
        if (!na || !nb) continue;
        pu.p += pu.sp;
        if (pu.p > 1) { pu.p = 0; pu.e = Math.floor(Math.random() * edges.length); }
        const x = lerp(na.x, nb.x, pu.p), y = lerp(na.y, nb.y, pu.p);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
        g.addColorStop(0, "rgba(140,245,185,0.9)");
        g.addColorStop(1, "rgba(140,245,185,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.2832); ctx.fill();
      }
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + n.ph);
        if (n.kind === "bb") {
          ctx.fillStyle = "#2ED477";
          ctx.shadowColor = "rgba(46,212,119,0.7)";
          ctx.shadowBlur = 10 + pulse * 8;
        } else {
          ctx.fillStyle = `rgba(125,200,210,${0.5 + pulse * 0.4})`;
          ctx.shadowColor = "rgba(14,138,130,0.5)";
          ctx.shadowBlur = 6;
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.2832); ctx.fill();
        ctx.shadowBlur = 0;
      }
      rafId = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
      cancelAnimationFrame(rafId);
      draw();
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
