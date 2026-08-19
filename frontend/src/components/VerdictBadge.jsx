import clsx from 'clsx'
import { AlertTriangle, ShieldCheck, ShieldAlert, HelpCircle } from 'lucide-react'

const VERDICT_CONFIG = {
  phishing: {
    className: 'badge-phishing',
    icon: ShieldAlert,
    label: 'Phishing',
  },
  suspicious: {
    className: 'badge-suspicious',
    icon: AlertTriangle,
    label: 'Suspicious',
  },
  safe: {
    className: 'badge-safe',
    icon: ShieldCheck,
    label: 'Safe',
  },
  unknown: {
    className: 'badge-unknown',
    icon: HelpCircle,
    label: 'Unknown',
  },
}

export default function VerdictBadge({ verdict = 'unknown', size = 'sm' }) {
  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.unknown
  const Icon = config.icon

  return (
    <span className={clsx(config.className, 'inline-flex items-center gap-1')}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      {config.label}
    </span>
  )
}
