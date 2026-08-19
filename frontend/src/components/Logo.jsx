/**
 * PhishVision Logo — Shield with an eye iris inside.
 * Shield = protection, Eye = vision/detection. Together = PhishVision.
 *
 * Props:
 *   size  — pixel size (width = height), default 32
 *   mono  — if true, renders in a single brand color (for dark backgrounds)
 */
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="PhishVision logo"
    >
      {/* ── Shield body ─────────────────────────────────────── */}
      {/* Outer gradient shield */}
      <defs>
        <linearGradient id="shieldGrad" x1="20" y1="2" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="eyeGrad" x1="12" y1="20" x2="28" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#a5b4fc" />
        </linearGradient>
        <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#312e81" />
        </radialGradient>
        {/* Glow filter */}
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Shield path — classic heraldic shape */}
      <path
        d="M20 2L4 8.5V20C4 28.5 11 35.5 20 38C29 35.5 36 28.5 36 20V8.5L20 2Z"
        fill="url(#shieldGrad)"
        filter="url(#logoGlow)"
      />

      {/* Shield inner highlight (top rim) */}
      <path
        d="M20 5L7 10.5V20C7 27 13 33 20 35.2C27 33 33 27 33 20V10.5L20 5Z"
        fill="#4338ca"
        opacity="0.5"
      />

      {/* ── Eye shape ───────────────────────────────────────── */}
      {/* Eye whites — almond shape */}
      <path
        d="M12 20C12 20 15.5 14.5 20 14.5C24.5 14.5 28 20 28 20C28 20 24.5 25.5 20 25.5C15.5 25.5 12 20 12 20Z"
        fill="url(#eyeGrad)"
        filter="url(#logoGlow)"
      />

      {/* Iris circle */}
      <circle cx="20" cy="20" r="4.2" fill="url(#irisGrad)" />

      {/* Pupil */}
      <circle cx="20" cy="20" r="2" fill="#6366f1" />

      {/* Pupil shine */}
      <circle cx="21.2" cy="18.8" r="0.8" fill="white" opacity="0.9" />

      {/* ── Scan line across eye (detection motif) ──────────── */}
      <line
        x1="12" y1="20" x2="28" y2="20"
        stroke="#c7d2fe" strokeWidth="0.5" opacity="0.4"
        strokeDasharray="1.5 1.5"
      />
    </svg>
  )
}
