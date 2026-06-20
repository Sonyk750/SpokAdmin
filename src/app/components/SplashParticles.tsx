"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FLY_IN_MS   = 2600;
const HOLD_MS     = 4000;
const DISSOLVE_MS = 1400;

function easeOut(t: number) { return 1 - (1 - t) ** 3; }
function easeIn(t: number)  { return t * t; }

interface Particle {
  x: number; y: number;
  tx: number; ty: number;
  sx: number; sy: number;
  nx: number; ny: number;
  color: string;
  delay: number;
}

function buildTargets(
  logoW: number,
  logoH: number,
  step: number,
): Array<{ x: number; y: number; color: string }> {
  const cv = document.createElement("canvas");
  cv.width = logoW;
  cv.height = logoH;
  const ctx = cv.getContext("2d");
  if (!ctx) return [];

  const sc = logoH / 52; // scale from original SVG viewBox height

  // ── Building icon ─────────────────────────────────────────────────────────
  const iconGrad = ctx.createLinearGradient(0, logoH, 0, 0);
  iconGrad.addColorStop(0, "#7c3aed");
  iconGrad.addColorStop(1, "#06b6d4");

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = iconGrad;
  ctx.fillRect(0, 18 * sc, 16 * sc, 30 * sc);

  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#fff";
  for (const [x, y] of [[2, 21.5], [9, 21.5], [2, 28.5], [9, 28.5], [2, 35.5], [9, 35.5]] as [number, number][]) {
    ctx.fillRect(x * sc, y * sc, 5 * sc, 3.5 * sc);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = iconGrad;
  ctx.fillRect(14 * sc, 3 * sc, 26 * sc, 45 * sc);

  const mainWins = [[17.5, 8], [29, 8], [17.5, 17], [29, 17],
                    [17.5, 26], [29, 26], [17.5, 35], [29, 35]] as [number, number][];
  const winOpa   = [0.85, 0.55, 0.5, 0.9, 0.75, 0.45, 0.9, 0.65];
  ctx.fillStyle  = "#fff";
  mainWins.forEach(([x, y], i) => {
    ctx.globalAlpha = winOpa[i] ?? 0.7;
    ctx.fillRect(x * sc, y * sc, 8 * sc, 5 * sc);
  });

  // ── Text "DecoImob" ───────────────────────────────────────────────────────
  ctx.globalAlpha  = 1;
  const fs = 34 * sc;
  const tx = 52 * sc;
  const ty = 38 * sc;
  ctx.font         = `800 ${fs}px "DM Sans","Arial Black",Arial,sans-serif`;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#fff";
  ctx.fillText("Deco", tx, ty);
  const decoW = ctx.measureText("Deco").width;

  const imobW  = ctx.measureText("Imob").width;
  const textGr = ctx.createLinearGradient(tx + decoW, 0, tx + decoW + imobW, 0);
  textGr.addColorStop(0, "#a78bfa");
  textGr.addColorStop(1, "#67e8f9");
  ctx.fillStyle = textGr;
  ctx.fillText("Imob", tx + decoW, ty);

  // ── Sample non-transparent pixels ─────────────────────────────────────────
  const { data } = ctx.getImageData(0, 0, logoW, logoH);
  const out: Array<{ x: number; y: number; color: string }> = [];
  for (let py = 0; py < logoH; py += step) {
    for (let px = 0; px < logoW; px += step) {
      const idx = (py * logoW + px) * 4;
      if (data[idx + 3] > 40) {
        out.push({ x: px, y: py, color: `rgb(${data[idx]},${data[idx + 1]},${data[idx + 2]})` });
      }
    }
  }
  return out;
}

export default function SplashParticles({ onSkip }: { onSkip: () => void }) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const particles     = useRef<Particle[]>([]);
  const phaseRef      = useRef(0);   // 0=fly_in  1=hold  2=dissolve
  const phaseStartRef = useRef(0);
  const rafRef        = useRef(0);
  const dissolvedRef  = useRef(false);
  const [showSkip, setShowSkip] = useState(false);

  const startDissolve = useCallback(() => {
    if (dissolvedRef.current) return;
    dissolvedRef.current = true;
    phaseRef.current     = 2;
    phaseStartRef.current = performance.now();
    onSkip();
  }, [onSkip]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctxOrNull = cv.getContext("2d");
    if (!ctxOrNull) return;
    // Re-bind to non-nullable so TS is happy inside async closures
    const c: CanvasRenderingContext2D = ctxOrNull;

    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width  = W;
    cv.height = H;

    const logoW   = Math.min(600, W * 0.82);
    const logoH   = Math.round(logoW * 52 / 260);
    const step    = Math.max(3, Math.round(logoW / 155));
    const cubeS   = Math.max(2, step - 1);
    const offsetX = (W - logoW) / 2;
    const offsetY = (H - logoH) / 2;
    const diag    = Math.hypot(W, H);
    const logoCX  = offsetX + logoW / 2;
    const logoCY  = offsetY + logoH / 2;

    document.fonts.load(`800 ${Math.round(34 * (logoH / 52))}px "DM Sans"`).finally(() => {
      const raw = buildTargets(logoW, logoH, step);
      const MAX = 2400;
      const src = raw.length > MAX
        ? raw.filter((_, i) => i % Math.ceil(raw.length / MAX) === 0)
        : raw;

      particles.current = src.map(t => {
        const angle = Math.random() * Math.PI * 2;
        const dist  = diag * (0.5 + Math.random() * 0.65);
        const sx    = W / 2 + Math.cos(angle) * dist;
        const sy    = H / 2 + Math.sin(angle) * dist;
        const ptx   = offsetX + t.x;
        const pty   = offsetY + t.y;
        const dvx   = ptx - logoCX;
        const dvy   = pty - logoCY;
        const dvm   = Math.hypot(dvx, dvy) || 1;
        return {
          x: sx, y: sy,
          tx: ptx, ty: pty,
          sx, sy,
          nx: dvx / dvm, ny: dvy / dvm,
          color: t.color,
          delay: Math.random() * 0.45,
        };
      });

      phaseStartRef.current = performance.now();

      function frame(now: number) {
        const el = now - phaseStartRef.current;
        c.clearRect(0, 0, W, H);

        if (phaseRef.current === 0) {
          for (const p of particles.current) {
            const raw = (el / FLY_IN_MS - p.delay) / (1 - p.delay * 0.4);
            const t   = Math.min(1, Math.max(0, raw));
            const e   = easeOut(t);
            p.x = p.sx + (p.tx - p.sx) * e;
            p.y = p.sy + (p.ty - p.sy) * e;
            c.fillStyle = p.color;
            c.fillRect(p.x, p.y, cubeS, cubeS);
          }
          if (el >= FLY_IN_MS * 1.25) {
            phaseRef.current      = 1;
            phaseStartRef.current = now;
            setShowSkip(true);
          }

        } else if (phaseRef.current === 1) {
          for (const p of particles.current) {
            c.fillStyle = p.color;
            c.fillRect(p.tx, p.ty, cubeS, cubeS);
          }
          if (el >= HOLD_MS) startDissolve();

        } else {
          const t   = Math.min(1, el / DISSOLVE_MS);
          const e   = easeIn(t);
          const spd = diag * 0.32 * e;
          c.globalAlpha = 1 - t;
          for (const p of particles.current) {
            c.fillStyle = p.color;
            c.fillRect(p.tx + p.nx * spd, p.ty + p.ny * spd, cubeS, cubeS);
          }
          c.globalAlpha = 1;
        }

        rafRef.current = requestAnimationFrame(frame);
      }

      rafRef.current = requestAnimationFrame(frame);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [startDissolve]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#050814" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      {showSkip && (
        <div
          style={{
            position: "absolute",
            bottom: "3rem",
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            animation: "fadeInUp 0.6s ease both",
          }}
        >
          <div
            style={{
              width: "10rem",
              height: "2px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "9999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
                borderRadius: "9999px",
                animation: `holdProgress ${HOLD_MS / 1000}s linear forwards`,
              }}
            />
          </div>
          <button
            onClick={startDissolve}
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.4)",
              color: "#a78bfa",
              padding: "0.75rem 2rem",
              borderRadius: "9999px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              letterSpacing: "0.02em",
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.28)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.7)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,0.15)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,0.4)";
            }}
          >
            Intră în site <span style={{ fontSize: "1.1rem" }}>↓</span>
          </button>
        </div>
      )}
    </div>
  );
}
