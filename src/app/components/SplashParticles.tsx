"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FLY_IN_MS   = 2400;
const HOLD_MS     = 4200;
const DISSOLVE_MS = 1200;

function easeOut(t: number) { return 1 - (1 - t) ** 4; }
function easeIn(t: number)  { return t * t * t; }

interface Particle {
  x: number; y: number;
  tx: number; ty: number;
  sx: number; sy: number;
  nx: number; ny: number;
  color: string;
  size: number;
  delay: number;
}

interface Ambient {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  alpha: number;
  color: string;
  pulse: number;
  pulseSpeed: number;
}

function buildTargets(logoW: number, logoH: number, step: number) {
  const cv = document.createElement("canvas");
  cv.width = logoW; cv.height = logoH;
  const ctx = cv.getContext("2d");
  if (!ctx) return [];

  const sc = logoH / 52;

  // ── Building icon ─────────────────────────────────────────────────
  const iconGrad = ctx.createLinearGradient(0, logoH, 0, 0);
  iconGrad.addColorStop(0, "#7c3aed");
  iconGrad.addColorStop(1, "#06b6d4");

  ctx.globalAlpha = 0.55; ctx.fillStyle = iconGrad;
  ctx.fillRect(0, 18 * sc, 16 * sc, 30 * sc);

  ctx.globalAlpha = 0.75; ctx.fillStyle = "#fff";
  for (const [x, y] of [[2,21.5],[9,21.5],[2,28.5],[9,28.5],[2,35.5],[9,35.5]] as [number,number][])
    ctx.fillRect(x*sc, y*sc, 5*sc, 3.5*sc);

  ctx.globalAlpha = 1; ctx.fillStyle = iconGrad;
  ctx.fillRect(14*sc, 3*sc, 26*sc, 45*sc);

  const wins = [[17.5,8],[29,8],[17.5,17],[29,17],[17.5,26],[29,26],[17.5,35],[29,35]] as [number,number][];
  const opas = [0.85,0.55,0.5,0.9,0.75,0.45,0.9,0.65];
  ctx.fillStyle = "#fff";
  wins.forEach(([x,y],i) => { ctx.globalAlpha = opas[i]??0.7; ctx.fillRect(x*sc,y*sc,8*sc,5*sc); });

  // ── Text "SpokAdmin" ─────────────────────────────────────────────
  ctx.globalAlpha = 1;
  const fs = 34 * sc;
  const tx = 52 * sc;
  const ty = 38 * sc;
  ctx.font = `800 ${fs}px "DM Sans","Arial Black",Arial,sans-serif`;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.fillText("Spok", tx, ty);
  const spokW = ctx.measureText("Spok").width;

  const adminW = ctx.measureText("Admin").width;
  const tg = ctx.createLinearGradient(tx + spokW, 0, tx + spokW + adminW, 0);
  tg.addColorStop(0, "#a78bfa");
  tg.addColorStop(1, "#67e8f9");
  ctx.fillStyle = tg;
  ctx.fillText("Admin", tx + spokW, ty);

  // ── Sample pixels ─────────────────────────────────────────────────
  const { data } = ctx.getImageData(0, 0, logoW, logoH);
  const out: Array<{ x: number; y: number; color: string }> = [];
  for (let py = 0; py < logoH; py += step)
    for (let px = 0; px < logoW; px += step) {
      const i = (py * logoW + px) * 4;
      if (data[i+3] > 40)
        out.push({ x: px, y: py, color: `rgb(${data[i]},${data[i+1]},${data[i+2]})` });
    }
  return out;
}

export default function SplashParticles({ onSkip }: { onSkip: () => void }) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const particles     = useRef<Particle[]>([]);
  const ambients      = useRef<Ambient[]>([]);
  const phaseRef      = useRef(0);
  const phaseStartRef = useRef(0);
  const rafRef        = useRef(0);
  const tick          = useRef(0);
  const dissolvedRef  = useRef(false);
  const [showSkip, setShowSkip] = useState(false);
  const [subtitleVisible, setSubtitleVisible] = useState(false);

  const startDissolve = useCallback(() => {
    if (dissolvedRef.current) return;
    dissolvedRef.current = true;
    phaseRef.current      = 2;
    phaseStartRef.current = performance.now();
    onSkip();
  }, [onSkip]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const c = ctx;

    // Cap DPR la 2 pentru claritate fara a supraincarca GPU-ul pe telefoane
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, small = false;

    function sizeCanvas() {
      W = cv!.clientWidth  || window.innerWidth;
      H = cv!.clientHeight || window.innerHeight;
      small = W < 640;
      cv!.width  = Math.max(1, Math.round(W * dpr));
      cv!.height = Math.max(1, Math.round(H * dpr));
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const COLS = ["#a78bfa","#67e8f9","#c4b5fd","#38bdf8","#818cf8"];

    function build() {
      if (dissolvedRef.current) return;
      cancelAnimationFrame(rafRef.current);
      sizeCanvas();
      ambients.current  = [];
      particles.current = [];
      phaseRef.current  = 0;
      tick.current      = 0;

      // Mai putine particule pe ecrane mici (performanta pe telefon)
      const ambientCount = small ? 42 : 110;
      for (let i = 0; i < ambientCount; i++) {
        ambients.current.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.25,
          vy: -(Math.random() * 0.6 + 0.15),
          r: Math.random() * 1.8 + 0.4,
          alpha: Math.random() * 0.35 + 0.08,
          color: COLS[Math.floor(Math.random() * COLS.length)],
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.02 + Math.random() * 0.03,
        });
      }

      const logoW   = Math.min(580, W * (small ? 0.92 : 0.82));
      const logoH   = Math.round(logoW * 52 / 260);
      const step    = Math.max(3, Math.round(logoW / 155));
      const cubeS   = Math.max(2, step - 1);
      const offX    = (W - logoW) / 2;
      const offY    = (H - logoH) / 2;
      const diag    = Math.hypot(W, H);
      const logoCX  = offX + logoW / 2;
      const logoCY  = offY + logoH / 2;

      document.fonts.load(`800 ${Math.round(34 * (logoH / 52))}px "DM Sans"`).finally(() => {
        if (dissolvedRef.current) return;
        const raw = buildTargets(logoW, logoH, step);
        const MAX = small ? 1100 : 2400;
        const src = raw.length > MAX
          ? raw.filter((_, i) => i % Math.ceil(raw.length / MAX) === 0)
          : raw;

        particles.current = src.map(t => {
          const angle = Math.random() * Math.PI * 2;
          const dist  = diag * (0.45 + Math.random() * 0.75);
          const sx    = W / 2 + Math.cos(angle) * dist;
          const sy    = H / 2 + Math.sin(angle) * dist;
          const ptx   = offX + t.x;
          const pty   = offY + t.y;
          const dvx   = ptx - logoCX;
          const dvy   = pty - logoCY;
          const dvm   = Math.hypot(dvx, dvy) || 1;
          return {
            x: sx, y: sy,
            tx: ptx, ty: pty,
            sx, sy,
            nx: dvx / dvm, ny: dvy / dvm,
            color: t.color,
            size: cubeS + (Math.random() > 0.88 ? 1 : 0),
            delay: Math.random() * 0.5,
          };
        });

        phaseStartRef.current = performance.now();

        function bg() {
          c.fillStyle = "#050814";
          c.fillRect(0, 0, W, H);

          const p1 = (Math.sin(tick.current * 0.018) * 0.12 + 0.22);
          const g1 = c.createRadialGradient(W * 0.28, H * 0.42, 0, W * 0.28, H * 0.42, W * 0.42);
          g1.addColorStop(0, `rgba(124,58,237,${p1})`);
          g1.addColorStop(1, "rgba(0,0,0,0)");
          c.fillStyle = g1; c.fillRect(0, 0, W, H);

          const p2 = (Math.sin(tick.current * 0.022 + 1.5) * 0.1 + 0.18);
          const g2 = c.createRadialGradient(W * 0.72, H * 0.58, 0, W * 0.72, H * 0.58, W * 0.38);
          g2.addColorStop(0, `rgba(6,182,212,${p2})`);
          g2.addColorStop(1, "rgba(0,0,0,0)");
          c.fillStyle = g2; c.fillRect(0, 0, W, H);

          // Grila subtila — doar pe ecrane mari (cost mare pe telefon)
          if (!small) {
            c.globalAlpha = 0.03;
            c.strokeStyle = "#a78bfa";
            c.lineWidth = 0.5;
            const gs = 60;
            for (let x = 0; x < W; x += gs) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); }
            for (let y = 0; y < H; y += gs) { c.beginPath(); c.moveTo(0,y); c.lineTo(W,y); c.stroke(); }
            c.globalAlpha = 1;
          }
        }

        function drawAmbients() {
          for (const a of ambients.current) {
            a.x += a.vx; a.y += a.vy; a.pulse += a.pulseSpeed;
            if (a.y < -4) { a.y = H + 4; a.x = Math.random() * W; }
            const alpha = a.alpha * (0.7 + Math.sin(a.pulse) * 0.3);
            c.globalAlpha = alpha;
            c.fillStyle = a.color;
            c.beginPath(); c.arc(a.x, a.y, a.r, 0, Math.PI * 2); c.fill();
          }
          c.globalAlpha = 1;
        }

        function frame(now: number) {
          tick.current++;
          const el = now - phaseStartRef.current;
          c.clearRect(0, 0, W, H);
          bg();
          drawAmbients();

          if (phaseRef.current === 0) {
            for (const p of particles.current) {
              const rawP = (el / FLY_IN_MS - p.delay) / (1 - p.delay * 0.4);
              const t   = Math.min(1, Math.max(0, rawP));
              const e   = easeOut(t);
              p.x = p.sx + (p.tx - p.sx) * e;
              p.y = p.sy + (p.ty - p.sy) * e;
              c.globalAlpha = Math.min(1, t * 2.2);
              c.fillStyle = p.color;
              c.fillRect(p.x, p.y, p.size, p.size);
            }
            c.globalAlpha = 1;
            if (el >= FLY_IN_MS * 1.2) {
              phaseRef.current = 1;
              phaseStartRef.current = now;
              setShowSkip(true);
              setTimeout(() => setSubtitleVisible(true), 300);
            }

          } else if (phaseRef.current === 1) {
            const glowA = 0.10 + Math.sin(tick.current * 0.04) * 0.04;
            const lg = c.createRadialGradient(logoCX, logoCY, 0, logoCX, logoCY, logoW * 0.55);
            lg.addColorStop(0, `rgba(167,139,250,${glowA})`);
            lg.addColorStop(0.5, `rgba(103,232,249,${glowA * 0.4})`);
            lg.addColorStop(1, "rgba(0,0,0,0)");
            c.fillStyle = lg; c.fillRect(0, 0, W, H);

            const breathe = 0.92 + Math.sin(tick.current * 0.05) * 0.08;
            for (const p of particles.current) {
              c.globalAlpha = breathe;
              c.fillStyle = p.color;
              c.fillRect(p.tx, p.ty, p.size, p.size);
            }
            c.globalAlpha = 1;
            if (el >= HOLD_MS) startDissolve();

          } else {
            const t   = Math.min(1, el / DISSOLVE_MS);
            const e   = easeIn(t);
            const spd = diag * 0.38 * e;
            c.globalAlpha = 1 - t;
            for (const p of particles.current) {
              c.fillStyle = p.color;
              c.fillRect(p.tx + p.nx * spd, p.ty + p.ny * spd, p.size, p.size);
            }
            c.globalAlpha = 1;
          }

          rafRef.current = requestAnimationFrame(frame);
        }

        rafRef.current = requestAnimationFrame(frame);
      });
    }

    build();

    // Rebuild la rotire / schimbare majora de viewport (ignora micro-resize de la bara de adrese)
    let rt = 0;
    let lastW = W, lastH = H;
    function onResize() {
      if (dissolvedRef.current) return;
      const nw = cv!.clientWidth || window.innerWidth;
      const nh = cv!.clientHeight || window.innerHeight;
      if (Math.abs(nw - lastW) < 64 && Math.abs(nh - lastH) < 120) return;
      lastW = nw; lastH = nh;
      clearTimeout(rt);
      rt = window.setTimeout(build, 180);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(rt);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [startDissolve]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#050814", overflow: "hidden", touchAction: "none" }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />

      {/* Subtitle */}
      {subtitleVisible && (
        <div style={{
          position: "absolute",
          top: "calc(50% + 56px)",
          left: 0, right: 0,
          textAlign: "center",
          animation: "fadeInUp 0.8s ease both",
          pointerEvents: "none",
        }}>
          <p style={{
            fontSize: "clamp(0.65rem, 1.4vw, 0.8rem)",
            color: "rgba(167,139,250,0.55)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}>
            Administrare Asociații de Proprietari
          </p>
        </div>
      )}

      {/* Skip area */}
      {showSkip && (
        <div style={{
          position: "absolute",
          bottom: "3rem",
          left: 0, right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          animation: "fadeInUp 0.7s ease 0.3s both",
        }}>
          <div style={{ width: "10rem", height: "2px", background: "rgba(255,255,255,0.07)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
              borderRadius: "9999px",
              animation: `holdProgress ${HOLD_MS / 1000}s linear forwards`,
            }} />
          </div>
          <button
            onClick={startDissolve}
            style={{
              background: "rgba(124,58,237,0.12)",
              border: "1px solid rgba(124,58,237,0.35)",
              color: "#a78bfa",
              padding: "0.75rem 2.25rem",
              borderRadius: "9999px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "0.875rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              letterSpacing: "0.03em",
              transition: "all 0.25s",
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={e => {
              Object.assign((e.currentTarget as HTMLButtonElement).style, {
                background: "rgba(124,58,237,0.25)",
                borderColor: "rgba(167,139,250,0.6)",
                color: "#c4b5fd",
              });
            }}
            onMouseLeave={e => {
              Object.assign((e.currentTarget as HTMLButtonElement).style, {
                background: "rgba(124,58,237,0.12)",
                borderColor: "rgba(124,58,237,0.35)",
                color: "#a78bfa",
              });
            }}
          >
            Intră în SpokAdmin <span style={{ fontSize: "1.1rem", marginTop: "1px" }}>↓</span>
          </button>
        </div>
      )}
    </div>
  );
}
