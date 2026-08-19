import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function StatCard({ title, value, subtitle, icon: Icon, color = 'brand', trend }) {
  const colorMap = {
    brand: 'from-brand-500/20 to-brand-600/5 border-brand-500/20 text-brand-400',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-400',
    orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/20 text-orange-400',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    slate: 'from-slate-500/20 to-slate-600/5 border-slate-500/20 text-slate-400',
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className={clsx(
        'stat-card bg-gradient-to-br border',
        colorMap[color] || colorMap.brand,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{title}</p>
          <p className="text-white text-2xl font-bold mt-1 tabular-nums">{value}</p>
          {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            'bg-white/5 border border-white/10',
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={clsx(
          'text-xs font-medium mt-1',
          trend > 0 ? 'text-red-400' : 'text-emerald-400',
        )}>
          {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last period
        </div>
      )}
    </motion.div>
  )
}
