import { motion } from 'framer-motion'

const SCORE_COLORS = {
  safe:       { stroke: '#22c55e', glow: 'rgba(34,197,94,0.4)',    text: '#22c55e' },
  suspicious: { stroke: '#f97316', glow: 'rgba(249,115,22,0.4)',   text: '#f97316' },
  phishing:   { stroke: '#ef4444', glow: 'rgba(239,68,68,0.4)',    text: '#ef4444' },
  unknown:    { stroke: '#64748b', glow: 'rgba(100,116,139,0.2)',  text: '#64748b' },
}

// Arc and number color is always based on the actual risk score value
// so even a "safe" verdict shows the risk level correctly via color
function getRiskColor(score) {
  if (score >= 0.65) return { stroke: '#ef4444', glow: 'rgba(239,68,68,0.4)',   text: '#ef4444' }
  if (score >= 0.35) return { stroke: '#f97316', glow: 'rgba(249,115,22,0.4)',  text: '#f97316' }
  return               { stroke: '#ef4444', glow: 'rgba(239,68,68,0.3)',   text: '#ef4444' }
  // Even low risk stays red — it IS a risk number
}

export default function ScoreGauge({ score = 0, verdict = 'unknown', size = 160 }) {
  const radius = 52
  const stroke = 8
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(Math.max(score, 0), 1)
  const dash = progress * circumference

  const colors = getRiskColor(progress)
  const pct = Math.round(progress * 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ width: size, height: size }} className="relative">
        <svg width={size} height={size} className="rotate-[-90deg]">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={stroke}
          />

          {/* Score arc */}
          <motion.circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            filter="url(#glow)"
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            style={{ color: colors.text }}
            className="text-3xl font-bold font-mono"
          >
            {pct}%
          </motion.span>
          <span className="text-slate-500 text-xs mt-0.5 font-medium">
            {verdict === 'safe'
              ? 'Phishing Risk'
              : verdict === 'phishing'
              ? 'Phishing'
              : verdict === 'suspicious'
              ? 'Suspicious'
              : 'Unknown'}
          </span>
        </div>
      </div>
    </div>
  )
}
