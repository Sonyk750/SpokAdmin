"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";

// Momente (ms)
const SHOW_AT = 1400;  // apar tagline + buton
const AUTO_AT = 4600;  // auto-dismiss
const EXIT_MS = 1100;  // durata animatiei de iesire

export default function SplashParticles({ onSkip }: { onSkip: () => void }) {
  const dissolvedRef = useRef(false);
  const [showSkip, setShowSkip] = useState(false);
  const [exiting, setExiting]   = useState(false);

  const startDissolve = useCallback(() => {
    if (dissolvedRef.current) return;
    dissolvedRef.current = true;
    setExiting(true);
    onSkip();
  }, [onSkip]);

  useEffect(() => {
    const t1 = setTimeout(() => setShowSkip(true), SHOW_AT);
    const t2 = setTimeout(() => startDissolve(), AUTO_AT);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [startDissolve]);

  // particule plutitoare (pozitii fixe, animate prin CSS)
  const dots = [
    { l: "12%", s: 5, d: 0,   dur: 7.5 }, { l: "22%", s: 3, d: 1.4, dur: 9 },
    { l: "34%", s: 6, d: 0.6, dur: 8 },   { l: "46%", s: 3, d: 2.1, dur: 10 },
    { l: "58%", s: 5, d: 0.3, dur: 7 },   { l: "68%", s: 4, d: 1.8, dur: 9.5 },
    { l: "79%", s: 6, d: 0.9, dur: 8.5 }, { l: "89%", s: 3, d: 2.6, dur: 7.8 },
  ];

  return (
    <div className={`spx-root${exiting ? " spx-root--exit" : ""}`} aria-hidden>
      <style>{CSS}</style>

      {/* glow-uri de fundal */}
      <div className="spx-blob spx-blob--v" />
      <div className="spx-blob spx-blob--c" />
      <div className="spx-grid" />

      {/* particule */}
      {dots.map((p, i) => (
        <span key={i} className="spx-dot" style={{
          left: p.l, width: p.s, height: p.s,
          animationDelay: `${p.d}s`, animationDuration: `${p.dur}s`,
        }} />
      ))}

      {/* scena logo */}
      <div className="spx-stage">
        <div className="spx-rings">
          <span className="spx-ring" />
          <span className="spx-ring" style={{ animationDelay: "0.8s" }} />
          <span className="spx-ring" style={{ animationDelay: "1.6s" }} />
        </div>
        <div className="spx-conic" />

        <div className="spx-logo">
          <Logo height={56} />
          <span className="spx-shine" />
        </div>

        <p className="spx-tagline">Administrare Asociații de Proprietari</p>
      </div>

      {/* controale jos */}
      {showSkip && (
        <div className="spx-controls">
          <div className="spx-bar"><span className="spx-bar__fill" /></div>
          <button className="spx-btn" onClick={startDissolve}>
            Intră în SpokAdmin <span className="spx-btn__arrow">↓</span>
          </button>
        </div>
      )}
    </div>
  );
}

const CSS = `
.spx-root{
  position:fixed; inset:0; z-index:200; overflow:hidden;
  background:radial-gradient(120% 100% at 50% 40%, #0a0f24 0%, #050814 60%, #03050f 100%);
  display:flex; align-items:center; justify-content:center;
  touch-action:none;
  transition:opacity ${EXIT_MS}ms ease, transform ${EXIT_MS}ms ease, filter ${EXIT_MS}ms ease;
}
.spx-root--exit{ opacity:0; transform:scale(1.08); filter:blur(10px); pointer-events:none; }

.spx-blob{ position:absolute; border-radius:50%; filter:blur(70px); opacity:.5; will-change:transform; }
.spx-blob--v{ width:60vmax; height:60vmax; left:-12vmax; top:-6vmax;
  background:radial-gradient(circle, rgba(124,58,237,.55), transparent 62%); animation:spxBlobV 14s ease-in-out infinite; }
.spx-blob--c{ width:54vmax; height:54vmax; right:-14vmax; bottom:-10vmax;
  background:radial-gradient(circle, rgba(6,182,212,.45), transparent 62%); animation:spxBlobC 17s ease-in-out infinite; }
@keyframes spxBlobV{ 0%,100%{ transform:translate(0,0) scale(1) } 50%{ transform:translate(6vmax,4vmax) scale(1.12) } }
@keyframes spxBlobC{ 0%,100%{ transform:translate(0,0) scale(1) } 50%{ transform:translate(-5vmax,-4vmax) scale(1.1) } }

.spx-grid{ position:absolute; inset:0; opacity:.05;
  background-image:linear-gradient(rgba(167,139,250,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,.6) 1px, transparent 1px);
  background-size:64px 64px; mask-image:radial-gradient(120% 90% at 50% 45%, #000 30%, transparent 75%);
  -webkit-mask-image:radial-gradient(120% 90% at 50% 45%, #000 30%, transparent 75%); }

.spx-dot{ position:absolute; bottom:-8px; border-radius:50%;
  background:radial-gradient(circle, #c4b5fd, rgba(103,232,249,.4));
  box-shadow:0 0 8px rgba(167,139,250,.6); opacity:0; animation-name:spxFloat; animation-timing-function:linear; animation-iteration-count:infinite; will-change:transform,opacity; }
@keyframes spxFloat{ 0%{ transform:translateY(0); opacity:0 } 12%{ opacity:.9 } 88%{ opacity:.6 } 100%{ transform:translateY(-102vh); opacity:0 } }

.spx-stage{ position:relative; display:flex; flex-direction:column; align-items:center; }

.spx-rings{ position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:1px; height:1px; }
.spx-ring{ position:absolute; top:50%; left:50%; width:clamp(220px,72vw,340px); height:clamp(220px,72vw,340px);
  margin:calc(clamp(220px,72vw,340px)/-2) 0 0 calc(clamp(220px,72vw,340px)/-2);
  border-radius:50%; border:1px solid rgba(167,139,250,.5);
  animation:spxRing 3.2s ease-out infinite; will-change:transform,opacity; }
@keyframes spxRing{ 0%{ transform:scale(.25); opacity:0 } 18%{ opacity:.55 } 100%{ transform:scale(1.25); opacity:0 } }

.spx-conic{ position:absolute; top:50%; left:50%; width:clamp(260px,82vw,420px); height:clamp(260px,82vw,420px);
  transform:translate(-50%,-50%); border-radius:50%;
  background:conic-gradient(from 0deg, transparent 0deg, rgba(124,58,237,.18) 70deg, transparent 150deg, rgba(6,182,212,.16) 230deg, transparent 320deg);
  filter:blur(14px); animation:spxSpin 9s linear infinite; will-change:transform; }
@keyframes spxSpin{ to{ transform:translate(-50%,-50%) rotate(360deg) } }

.spx-logo{ position:relative; overflow:hidden; padding:6px 10px; border-radius:14px;
  animation:spxPop 1.1s cubic-bezier(.2,.9,.25,1.2) both; }
.spx-logo svg{ width:clamp(228px,80vw,340px); height:auto; display:block;
  filter:drop-shadow(0 6px 26px rgba(124,58,237,.45)); }
@keyframes spxPop{ 0%{ opacity:0; transform:scale(.7) translateY(16px); filter:blur(8px) } 60%{ opacity:1; filter:blur(0) } 100%{ opacity:1; transform:none } }

.spx-shine{ position:absolute; top:0; left:0; width:60%; height:100%; pointer-events:none;
  background:linear-gradient(105deg, transparent 0%, rgba(255,255,255,.55) 50%, transparent 100%);
  transform:translateX(-160%) skewX(-18deg); animation:spxShine 2.6s ease-in-out .9s infinite; mix-blend-mode:screen; }
@keyframes spxShine{ 0%{ transform:translateX(-160%) skewX(-18deg) } 55%,100%{ transform:translateX(230%) skewX(-18deg) } }

.spx-tagline{ margin-top:22px; font-size:clamp(.62rem,2.6vw,.78rem); letter-spacing:.24em; text-transform:uppercase;
  color:rgba(167,139,250,.62); font-weight:500; text-align:center; padding:0 16px;
  opacity:0; animation:spxFadeUp .9s ease 1.2s both; }
@keyframes spxFadeUp{ from{ opacity:0; transform:translateY(12px) } to{ opacity:1; transform:translateY(0) } }

.spx-controls{ position:absolute; left:0; right:0; bottom:max(2.4rem, env(safe-area-inset-bottom));
  display:flex; flex-direction:column; align-items:center; gap:1rem; animation:spxFadeUp .7s ease both; padding:0 16px; }
.spx-bar{ width:10rem; height:2px; border-radius:9999px; background:rgba(255,255,255,.08); overflow:hidden; }
.spx-bar__fill{ display:block; height:100%; border-radius:9999px; background:linear-gradient(90deg,#7c3aed,#06b6d4);
  transform-origin:left; animation:spxBar ${(AUTO_AT - SHOW_AT) / 1000}s linear forwards; }
@keyframes spxBar{ from{ transform:scaleX(0) } to{ transform:scaleX(1) } }
.spx-btn{ display:inline-flex; align-items:center; gap:.5rem; padding:.8rem 2.1rem; border-radius:9999px;
  background:rgba(124,58,237,.14); border:1px solid rgba(124,58,237,.4); color:#c4b5fd; font:600 .9rem/1 inherit;
  letter-spacing:.02em; cursor:pointer; -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px); transition:all .2s; }
.spx-btn:hover,.spx-btn:active{ background:rgba(124,58,237,.26); border-color:rgba(167,139,250,.65); color:#ede9fe; transform:translateY(-1px); }
.spx-btn__arrow{ font-size:1.05rem; animation:spxBounce 1.6s ease-in-out infinite; }
@keyframes spxBounce{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(3px) } }

@media (prefers-reduced-motion: reduce){
  .spx-blob,.spx-conic,.spx-ring,.spx-dot,.spx-shine,.spx-btn__arrow{ animation:none !important; }
  .spx-logo{ animation-duration:.4s; }
}
`;
