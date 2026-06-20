"use client";

export function Logo({ height = 52 }: { height?: number }) {
  const scale  = height / 52;
  const totalW = Math.round(268 * scale);

  return (
    <svg
      width={totalW}
      height={height}
      viewBox="0 0 268 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SpokAdmin logo"
    >
      <defs>
        <linearGradient id="sa-icon" x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0%"  stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#06b6d4"/>
        </linearGradient>
        <linearGradient id="sa-text" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#a78bfa"/>
          <stop offset="100%" stopColor="#67e8f9"/>
        </linearGradient>
        <filter id="sa-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* ── Clădire spate ── */}
      <rect x="0" y="18" width="16" height="30" rx="2.5" fill="url(#sa-icon)" opacity="0.5"/>
      <rect x="2"  y="21.5" width="5" height="3.5" rx="1" fill="white" opacity="0.7"/>
      <rect x="9"  y="21.5" width="5" height="3.5" rx="1" fill="white" opacity="0.45"/>
      <rect x="2"  y="28.5" width="5" height="3.5" rx="1" fill="white" opacity="0.85"/>
      <rect x="9"  y="28.5" width="5" height="3.5" rx="1" fill="white" opacity="0.6"/>
      <rect x="2"  y="35.5" width="5" height="3.5" rx="1" fill="white" opacity="0.5"/>
      <rect x="9"  y="35.5" width="5" height="3.5" rx="1" fill="white" opacity="0.75"/>

      {/* ── Clădire față ── */}
      <rect x="14" y="3" width="26" height="45" rx="3.5" fill="url(#sa-icon)" filter="url(#sa-glow)"/>
      <rect x="14" y="3" width="26" height="2.5" rx="3.5" fill="white" opacity="0.25"/>
      <rect x="17.5" y="8"  width="8" height="5" rx="1.5" fill="white" opacity="0.85"/>
      <rect x="29"   y="8"  width="8" height="5" rx="1.5" fill="white" opacity="0.55"/>
      <rect x="17.5" y="17" width="8" height="5" rx="1.5" fill="white" opacity="0.5"/>
      <rect x="29"   y="17" width="8" height="5" rx="1.5" fill="white" opacity="0.9"/>
      <rect x="17.5" y="26" width="8" height="5" rx="1.5" fill="white" opacity="0.75"/>
      <rect x="29"   y="26" width="8" height="5" rx="1.5" fill="white" opacity="0.45"/>
      <rect x="17.5" y="35" width="8" height="5" rx="1.5" fill="white" opacity="0.9"/>
      <rect x="29"   y="35" width="8" height="5" rx="1.5" fill="white" opacity="0.65"/>
      <rect x="22"   y="41" width="10" height="7" rx="2" fill="rgba(0,0,0,0.35)"/>
      <circle cx="27" cy="5.5" r="1.5" fill="white" opacity="0.6"/>

      {/* ── Linie bază ── */}
      <line x1="0" y1="50.5" x2="42" y2="50.5" stroke="url(#sa-icon)" strokeWidth="0.5" opacity="0.35"/>

      {/* ── Text: "Spok" alb ── */}
      <text x="52" y="38"
        fontFamily="'DM Sans', sans-serif"
        fontWeight="800" fontSize="34" letterSpacing="-1.5"
        fill="white">Spok</text>

      {/* ── Text: "Admin" gradient ── */}
      <text x="138" y="38"
        fontFamily="'DM Sans', sans-serif"
        fontWeight="800" fontSize="34" letterSpacing="-1.5"
        fill="url(#sa-text)">Admin</text>

      {/* ── Tagline ── */}
      <line x1="52" y1="43.5" x2="266" y2="43.5" stroke="rgba(124,58,237,0.2)" strokeWidth="0.5"/>
      <text x="52" y="51"
        fontFamily="'DM Sans', sans-serif"
        fontWeight="300" fontSize="7" letterSpacing="3"
        fill="#6b7280">PROPERTY MANAGEMENT</text>
    </svg>
  );
}
