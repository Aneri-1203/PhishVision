import { motion } from 'framer-motion'
import clsx from 'clsx'

function getColor(score) {
  if (score >= 0.7) return 'bg-red-500'
  if (score >= 0.45) return 'bg-orange-500'
  return 'bg-emerald-500'
}

export default function ScoreBar({ label, score = 0, delay = 0 }) {
  const pct = Math.round(score * 100)
  const color = getColor(score)

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-slate-400 text-xs font-medium">{label}</span>
        <span className={clsx(
          'text-xs font-mono font-semibold',
          score >= 0.7 ? 'text-red-400' : score >= 0.45 ? 'text-orange-400' : 'text-emerald-400',
        )}>
          {pct}%
        </span>
      </div>
      <div className="progress-bar">
        <motion.div
          className={clsx('progress-fill', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}
