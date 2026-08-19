import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ShieldAlert, Shield, ShieldCheck, Search, TrendingUp, Clock, Zap, Globe } from 'lucide-react'
import { statsAPI, scanAPI, exportAPI, resultsAPI } from '../api/client'
import StatCard from '../components/StatCard'
import VerdictBadge from '../components/VerdictBadge'
import { useState } from 'react'
import toast from 'react-hot-toast'

const PIE_COLORS = {
  phishing: '#ef4444',
  suspicious: '#f97316',
  safe: '#22c55e',
  unknown: '#64748b',
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-dark-700 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const [autoScanning, setAutoScanning] = useState(false)

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery(
    'stats', statsAPI.overview, { refetchInterval: 30000 },
  )
  const { data: timeline } = useQuery(
    ['timeline', 7], () => statsAPI.timeline(7), { refetchInterval: 60000 },
  )
  const { data: recentResults } = useQuery(
    ['recentResults'], () => resultsAPI.list({ per_page: 8, page: 1 }), { refetchInterval: 30000 },
  )

  const handleAutoScan = async () => {
    setAutoScanning(true)
    try {
      const result = await scanAPI.autoScan()
      toast.success(`Auto-scan complete: ${result.data?.phishing_found || 0} phishing domains found`)
      refetchStats()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setAutoScanning(false)
    }
  }

  const scoreDistData = stats?.score_distribution
    ? Object.entries(stats.score_distribution).map(([range, count]) => ({ range, count }))
    : []

  const pieData = stats
    ? [
        { name: 'Phishing', value: stats.phishing_count, color: PIE_COLORS.phishing },
        { name: 'Suspicious', value: stats.suspicious_count, color: PIE_COLORS.suspicious },
        { name: 'Safe', value: stats.safe_count, color: PIE_COLORS.safe },
      ].filter(d => d.value > 0)
    : []

  const scoreColor = (s) => s >= 0.7 ? 'text-red-400' : s >= 0.45 ? 'text-orange-400' : 'text-emerald-400'

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Demo <span className="text-gradient">Report</span>
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Aggregated analysis of all scanned domains
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportAPI.download('pdf')} className="btn-secondary text-xs">
            Export All (PDF)
          </button>
          <button onClick={handleAutoScan} disabled={autoScanning} className="btn-primary">
            <Zap className="w-4 h-4" />
            {autoScanning ? 'Scanning…' : 'Run Auto-Scan'}
          </button>
        </div>
      </div>

      {/* Recently scanned URLs */}
      {recentResults?.items?.length > 0 && (
        <div className="card p-4">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" /> Recently Scanned URLs
          </h3>
          <div className="space-y-2">
            {recentResults.items.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-1.5 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-slate-300 text-xs font-mono truncate block">{r.url}</span>
                </div>
                <span className={`text-xs font-mono font-bold flex-shrink-0 ${scoreColor(r.overall_score)}`}>
                  {Math.round(r.overall_score * 100)}%
                </span>
                <VerdictBadge verdict={r.verdict} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Scanned"
          value={statsLoading ? '—' : (stats?.total_scanned ?? 0).toLocaleString()}
          subtitle="All time"
          icon={Search}
          color="brand"
        />
        <StatCard
          title="Phishing Detected"
          value={statsLoading ? '—' : (stats?.phishing_count ?? 0).toLocaleString()}
          subtitle={`${stats?.detection_rate ?? 0}% detection rate`}
          icon={ShieldAlert}
          color="red"
        />
        <StatCard
          title="Suspicious"
          value={statsLoading ? '—' : (stats?.suspicious_count ?? 0).toLocaleString()}
          subtitle="Needs review"
          icon={Shield}
          color="orange"
        />
        <StatCard
          title="Safe Domains"
          value={statsLoading ? '—' : (stats?.safe_count ?? 0).toLocaleString()}
          subtitle="Verified clean"
          icon={ShieldCheck}
          color="green"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20
                          flex items-center justify-center">
            <Clock className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs">Last 24 hours</p>
            <p className="text-white font-bold text-xl tabular-nums">
              {stats?.last_24h ?? 0}
            </p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20
                          flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-slate-400 text-xs">Last 7 days</p>
            <p className="text-white font-bold text-xl tabular-nums">
              {stats?.last_7d ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Timeline chart */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-white font-semibold mb-4">Scan Activity (7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline || []}>
              <defs>
                <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2}
                fill="url(#scanGrad)" name="Scans"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <h3 className="text-white font-semibold mb-4">Verdict Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
              No data yet — run a scan to start
            </div>
          )}
        </div>
      </div>

      {/* Score distribution + Top brands */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Score distribution */}
        <div className="card p-5">
          <h3 className="text-white font-semibold mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreDistData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Domains" radius={[4, 4, 0, 0]}>
                {scoreDistData.map((entry, i) => {
                  const colors = ['#22c55e', '#86efac', '#fbbf24', '#f97316', '#ef4444']
                  return <Cell key={i} fill={colors[i] || '#6366f1'} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top targeted brands */}
        <div className="card p-5">
          <h3 className="text-white font-semibold mb-4">Top Impersonated Brands</h3>
          {stats?.top_targeted_brands?.length > 0 ? (
            <div className="space-y-3">
              {stats.top_targeted_brands.slice(0, 6).map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20
                                  flex items-center justify-center text-xs font-bold text-red-400">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-300 text-sm font-medium truncate">{item.brand}</span>
                      <span className="text-red-400 text-xs font-mono ml-2">{item.count}</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill bg-red-500"
                        style={{
                          width: `${(item.count / (stats.top_targeted_brands[0]?.count || 1)) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No phishing data yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
