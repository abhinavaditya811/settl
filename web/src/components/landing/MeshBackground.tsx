"use client";

// A living canvas background: large soft drifting gradient blobs (Stripe-style
// mesh) + a sparse field of slowly-rising particles for depth. Indigo family, low
// opacity, additive — gives the hero motion without a heavy WebGL/3D dependency.

import { useEffect, useRef } from "react";

const BLOBS = [
  { hue: "109,94,246", x: 0.28, y: 0.32, r: 0.54, sx: 0.7, sy: 0.5, a: 0.24 },
  { hue: "139,124,255", x: 0.72, y: 0.28, r: 0.48, sx: -0.6, sy: 0.6, a: 0.2 },
  { hue: "70,110,230", x: 0.5, y: 0.6, r: 0.6, sx: 0.45, sy: -0.55, a: 0.17 },
  { hue: "150,110,255", x: 0.86, y: 0.62, r: 0.42, sx: -0.4, sy: -0.4, a: 0.15 },
];

export default function MeshBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, w = 0, h = 0;
    let parts: { x: number; y: number; r: number; s: number; a: number }[] = [];

    const seed = () => {
      const n = Math.round((w * h) / 26000);
      parts = Array.from({ length: Math.min(n, 90) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.6 + Math.random() * 1.4, s: 0.12 + Math.random() * 0.4, a: 0.1 + Math.random() * 0.35,
      }));
    };
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of BLOBS) {
        const cx = (b.x + Math.sin(t * 0.00012 * b.sx) * 0.08) * w;
        const cy = (b.y + Math.cos(t * 0.00012 * b.sy) * 0.08) * h;
        const rad = b.r * Math.max(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, `rgba(${b.hue},${b.a})`);
        g.addColorStop(1, `rgba(${b.hue},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      for (const p of parts) {
        p.y -= p.s;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,170,255,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}
