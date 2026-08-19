import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Camera, AlertTriangle, ExternalLink, Download,
  ShieldAlert, Shield, ShieldCheck, TrendingUp, Clock,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { scanAPI, exportAPI } from '../api/client'
import ScoreGauge from '../components/ScoreGauge'
import ScoreBar from '../components/ScoreBar'
import VerdictBadge from '../components/VerdictBadge'
import StatCard from '../components/StatCard'
import clsx from 'clsx'

const PIE_COLORS = ['#ef4444', '#f97316', '#22c55e', '#64748b']

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-dark-700 border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }} className="font-medium">
            {p.name}: {typeof p.value === 'number' ? `${Math.round(p.value * 100)}%` : p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function Scanner() {
  const navigate = useNavigate()

  // ── Persist last result across navigation via sessionStorage ──────────
  const [url, setUrl] = useState(() => sessionStorage.getItem('scanner_url') || '')
  const [screenshot, setScreenshot] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(() => {
    try {
      const saved = sessionStorage.getItem('scanner_result')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [activeTab, setActiveTab] = useState('overview')

  const handleScan = async (e) => {
    e?.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) { toast.error('Please enter a URL'); return }
    setScanning(true)
    setResult(null)
    sessionStorage.removeItem('scanner_result')
    try {
      const res = await scanAPI.single(trimmed, screenshot)
      setResult(res.data)
      sessionStorage.setItem('scanner_result', JSON.stringify(res.data))
      sessionStorage.setItem('scanner_url', trimmed)
      if (res.data.verdict === 'phishing') {
        toast.error(`⚠️ Phishing detected! Score: ${Math.round(res.data.overall_score * 100)}%`)
      } else if (res.data.verdict === 'suspicious') {
        toast(`⚠️ Suspicious domain detected`, { icon: '⚠️' })
      } else {
        toast.success('Domain appears safe')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setScanning(false)
    }
  }

  // Keep url in sync with sessionStorage
  const handleUrlChange = (e) => {
    setUrl(e.target.value)
    sessionStorage.setItem('scanner_url', e.target.value)
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'url', label: 'URL Analysis' },
    { id: 'whois', label: 'WHOIS / DNS' },
    { id: 'content', label: 'Content' },
    { id: 'visual', label: 'Visual' },
  ]

  // Build radar data from result scores
  const radarData = result ? [
    { subject: 'URL', score: result.url_score },
    { subject: 'WHOIS', score: result.whois_score },
    { subject: 'Content', score: result.content_score },
    { subject: 'Visual', score: result.visual_score },
    { subject: 'DNS', score: result.dns_score },
  ] : []

  const pieData = result ? [
    { name: 'Phishing Risk', value: result.overall_score },
    { name: 'Safe Zone', value: Math.max(0, 1 - result.overall_score) },
  ] : []

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white">
          Live <span className="text-gradient">Domain Scanner</span>
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Enter any domain or URL to run a full AI-powered phishing analysis
        </p>
      </div>

      {/* Scan Input */}
      <div className="card p-6">
        <form onSubmit={handleScan} className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={url}
                onChange={handleUrlChange}
                placeholder="Enter domain or full URL to scan…"
                className="input pl-10"
                disabled={scanning}
              />
            </div>
            <button type="submit" disabled={scanning || !url.trim()} className="btn-primary min-w-[120px]">
              {scanning ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Scanning…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Scan
                </span>
              )}
            </button>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400 hover:text-white w-fit">
            <input
              type="checkbox"
              checked={screenshot}
              onChange={(e) => setScreenshot(e.target.checked)}
              className="rounded border-white/20 bg-dark-800 text-brand-500 focus:ring-brand-500/30"
            />
            <Camera className="w-3.5 h-3.5" />
            Capture screenshot for visual analysis
          </label>
        </form>

        <AnimatePresence>
          {scanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-white/5"
            >
              <ScanProgress />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* ── Scanned URL banner ── */}
            <div className="card px-5 py-3 flex items-center gap-3 border border-white/10">
              <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-slate-500 text-xs mr-2">Scanned URL</span>
                <span className="text-slate-200 text-sm font-mono truncate">{result.url}</span>
              </div>
              <VerdictBadge verdict={result.verdict} />
            </div>

            {/* ── Top stat cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Phishing Score"
                value={`${Math.round(result.overall_score * 100)}%`}
                subtitle={`Confidence: ${result.confidence}`}
                icon={ShieldAlert}
                color={result.overall_score >= 0.65 ? 'red' : result.overall_score >= 0.35 ? 'orange' : 'green'}
              />
              <StatCard title="URL Risk" value={`${Math.round(result.url_score * 100)}%`}
                subtitle="Pattern analysis" icon={Search}
                color={result.url_score >= 0.65 ? 'red' : result.url_score >= 0.35 ? 'orange' : 'green'} />
              <StatCard title="WHOIS Risk" value={`${Math.round(result.whois_score * 100)}%`}
                subtitle="Domain intelligence" icon={Clock}
                color={result.whois_score >= 0.65 ? 'red' : result.whois_score >= 0.35 ? 'orange' : 'green'} />
              <StatCard title="Content Risk" value={`${Math.round(result.content_score * 100)}%`}
                subtitle="Page analysis" icon={Shield}
                color={result.content_score >= 0.65 ? 'red' : result.content_score >= 0.35 ? 'orange' : 'green'} />
            </div>

            {/* ── Gauge + Charts row ── */}
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Gauge */}
              <div className={clsx(
                'card p-6 flex flex-col items-center justify-center gap-4 border',
                result.verdict === 'phishing' && 'border-red-500/30 bg-red-500/5',
                result.verdict === 'suspicious' && 'border-orange-500/30 bg-orange-500/5',
                result.verdict === 'safe' && 'border-emerald-500/30 bg-emerald-500/5',
              )}>
                <ScoreGauge score={result.overall_score} verdict={result.verdict} size={170} />
                {result.target_brand && (
                  <div className="flex items-center gap-2 text-sm bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2 w-full justify-center">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    <span className="text-orange-400 text-xs font-medium">Impersonating {result.target_brand}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>⏱ {result.scan_duration_ms}ms</span>
                  <span>·</span>
                  <span className="capitalize">{result.confidence} confidence</span>
                </div>
              </div>

              {/* Radar chart */}
              <div className="card p-5">
                <h3 className="text-white font-semibold text-sm mb-3">Risk Radar</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.06)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Radar
                      name="Risk Score" dataKey="score"
                      stroke={result.overall_score >= 0.65 ? '#ef4444' : result.overall_score >= 0.35 ? '#f97316' : '#22c55e'}
                      fill={result.overall_score >= 0.65 ? '#ef4444' : result.overall_score >= 0.35 ? '#f97316' : '#22c55e'}
                      fillOpacity={0.25} strokeWidth={2}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie chart */}
              <div className="card p-5">
                <h3 className="text-white font-semibold text-sm mb-3">Risk vs Safe Zone</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75}
                      paddingAngle={3} dataKey="value"
                    >
                      <Cell fill={result.overall_score >= 0.65 ? '#ef4444' : result.overall_score >= 0.35 ? '#f97316' : '#22c55e'} />
                      <Cell fill="rgba(255,255,255,0.06)" />
                    </Pie>
                    <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                    <Legend formatter={(val) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Score bars ── */}
            <div className="card p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Score Breakdown by Engine</h3>
              <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
                <ScoreBar label="URL Pattern Analysis" score={result.url_score} delay={0.1} />
                <ScoreBar label="WHOIS / DNS Intelligence" score={result.whois_score} delay={0.2} />
                <ScoreBar label="Page Content Analysis" score={result.content_score} delay={0.3} />
                <ScoreBar label="Visual Similarity" score={result.visual_score} delay={0.4} />
              </div>
            </div>

            {/* ── Action buttons ── */}
            <div className="flex flex-wrap items-center gap-3">
              {result.id && (
                <button
                  onClick={() => { exportAPI.downloadSingleReport(result.id, result.domain); toast.success('Downloading…') }}
                  className="btn-primary text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF Report
                </button>
              )}
              {result.id && (
                <button
                  onClick={() => navigate(`/results`)}
                  className="btn-secondary text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View in Results History
                </button>
              )}
            </div>

            {/* ── Detail Tabs ── */}
            <div className="card overflow-hidden">
              <div className="flex border-b border-white/5 overflow-x-auto">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                      activeTab === tab.id ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-300',
                    )}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-5">
                <TabContent tab={activeTab} result={result} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ScanProgress() {
  const steps = [
    'Extracting URL features',
    'WHOIS & DNS lookup',
    'Fetching page content',
    'Analyzing HTML structure',
    'Capturing screenshot',
    'Computing ML scores',
  ]
  const [step] = useState(Math.floor(Math.random() * steps.length))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-brand-500/40 border-t-brand-500 rounded-full animate-spin" />
        <span className="text-brand-400 text-sm font-medium animate-pulse">{steps[step]}…</span>
      </div>
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className={clsx(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i <= step ? 'bg-brand-500' : 'bg-white/5',
            )}
          />
        ))}
      </div>
    </div>
  )
}

function TabContent({ tab, result }) {
  if (tab === 'overview') {
    const features = result.url_features || {}
    const whois = result.whois_data || {}
    const items = [
      { label: 'Domain Age', value: whois.domain_age_days != null ? `${whois.domain_age_days} days` : 'Unknown' },
      { label: 'Registrar', value: whois.registrar || 'Unknown' },
      { label: 'Registration Country', value: whois.registrant_country || 'Unknown' },
      { label: 'Uses HTTPS', value: features.uses_https ? 'Yes' : 'No' },
      { label: 'URL Length', value: features.url_length || '—' },
      { label: 'Subdomain Depth', value: features.subdomain_count || 0 },
      { label: 'Suspicious Keywords', value: features.suspicious_keyword_count || 0 },
      { label: 'Homoglyphs Found', value: features.homoglyph_count || 0 },
      { label: 'Suspicious TLD', value: features.is_suspicious_tld ? 'Yes ⚠️' : 'No' },
      { label: 'IP as Domain', value: features.is_ip_domain ? 'Yes ⚠️' : 'No' },
    ]
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-2 border-b border-white/5">
            <span className="text-slate-500 text-sm">{label}</span>
            <span className="text-slate-200 text-sm font-medium">{String(value)}</span>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'url') {
    const f = result.url_features || {}
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['URL Length', f.url_length],
            ['Domain Length', f.domain_length],
            ['Subdomain Count', f.subdomain_count],
            ['Dots in URL', f.dots_in_url],
            ['Hyphens', f.hyphens_in_domain],
            ['Special Chars (@)', f.at_signs],
            ['Percent Encoded', f.percent_signs],
            ['Domain Entropy', f.domain_entropy],
            ['Digit Ratio', f.digit_ratio_in_domain],
            ['Suspicious Keywords', f.suspicious_keyword_count],
            ['Homoglyphs', f.homoglyph_count],
            ['Brand Edit Distance', f.min_brand_edit_distance === -1 ? 'N/A' : f.min_brand_edit_distance],
          ].map(([k, v]) => (
            <div key={k} className="bg-dark-800 rounded-xl p-3">
              <div className="text-slate-500 text-xs mb-1">{k}</div>
              <div className="text-white font-mono font-semibold">{v ?? '—'}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {f.is_suspicious_tld && <Flag label="Suspicious TLD" color="red" />}
          {f.is_ip_domain && <Flag label="IP as Domain" color="red" />}
          {f.has_login_keyword && <Flag label="Login Keyword" color="orange" />}
          {f.has_url_shortener && <Flag label="URL Shortener" color="orange" />}
          {f.has_redirect && <Flag label="Redirect" color="orange" />}
          {f.homoglyph_count > 0 && <Flag label="Homoglyphs Detected" color="red" />}
          {f.uses_https ? <Flag label="HTTPS" color="green" /> : <Flag label="No HTTPS" color="red" />}
        </div>
      </div>
    )
  }

  if (tab === 'whois') {
    const w = result.whois_data || {}
    const d = result.dns_data || {}
    return (
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-white font-semibold text-sm uppercase tracking-wide">WHOIS</h4>
          {[
            ['Registrar', w.registrar],
            ['Created', w.creation_date ? new Date(w.creation_date).toLocaleDateString() : null],
            ['Expires', w.expiration_date ? new Date(w.expiration_date).toLocaleDateString() : null],
            ['Updated', w.updated_date ? new Date(w.updated_date).toLocaleDateString() : null],
            ['Age', w.domain_age_days != null ? `${w.domain_age_days} days` : null],
            ['Days Until Expiry', w.days_until_expiry != null ? `${w.days_until_expiry} days` : null],
            ['Country', w.registrant_country],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-white/5 text-sm">
              <span className="text-slate-500">{k}</span>
              <span className={clsx('font-medium', v ? 'text-slate-200' : 'text-slate-600')}>
                {v || 'N/A'}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <h4 className="text-white font-semibold text-sm uppercase tracking-wide">DNS</h4>
          <Flag label={d.resolves ? 'Resolves' : 'Does Not Resolve'} color={d.resolves ? 'green' : 'red'} />
          <Flag label={d.has_spf ? 'SPF Record' : 'No SPF'} color={d.has_spf ? 'green' : 'orange'} />
          <Flag label={d.has_dmarc ? 'DMARC Record' : 'No DMARC'} color={d.has_dmarc ? 'green' : 'orange'} />
          {d.a_records?.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-1">IP Addresses</p>
              {d.a_records.map(ip => (
                <code key={ip} className="block text-slate-300 text-xs font-mono bg-dark-800 px-2 py-1 rounded mb-1">{ip}</code>
              ))}
            </div>
          )}
          {d.ns_records?.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs mb-1">Name Servers</p>
              {d.ns_records.slice(0, 4).map(ns => (
                <code key={ns} className="block text-slate-300 text-xs font-mono bg-dark-800 px-2 py-1 rounded mb-1">{ns}</code>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (tab === 'content') {
    const c = result.content_features || {}
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {c.has_login_form && <Flag label="Login Form" color="orange" />}
          {c.has_password_field && <Flag label="Password Field" color="red" />}
          {c.form_action_external && <Flag label="External Form Action ⚠️" color="red" />}
          {c.obfuscated_js && <Flag label="Obfuscated JS" color="red" />}
          {c.meta_redirect && <Flag label="Meta Redirect" color="orange" />}
          {c.has_hidden_fields && <Flag label="Hidden Fields" color="orange" />}
          {c.has_captcha && <Flag label="CAPTCHA Present" color="green" />}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ['Title', c.title || 'N/A'],
            ['Word Count', c.word_count ?? '—'],
            ['Scripts', c.script_count ?? '—'],
            ['iFrames', c.iframe_count ?? '—'],
            ['Images', c.image_count ?? '—'],
            ['External Links', c.external_links_count ?? '—'],
            ['Target Similarity', c.target_similarity != null ? `${Math.round(c.target_similarity * 100)}%` : 'N/A'],
          ].map(([k, v]) => (
            <div key={k} className="bg-dark-800 rounded-xl p-3">
              <div className="text-slate-500 text-xs mb-1">{k}</div>
              <div className="text-white font-medium text-sm truncate">{String(v)}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tab === 'visual') {
    const v = result.visual_features || {}
    const b64 = result.screenshot_b64
    return (
      <div className="space-y-4">
        {v.similarity_score != null && (
          <div className="bg-dark-800 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400 text-sm">Visual Similarity Score</span>
              <span className={clsx(
                'font-bold font-mono',
                v.similarity_score > 0.7 ? 'text-red-400' : v.similarity_score > 0.4 ? 'text-orange-400' : 'text-emerald-400'
              )}>
                {Math.round(v.similarity_score * 100)}%
              </span>
            </div>
            <ScoreBar label="pHash Similarity" score={v.similarity_score} />
            {v.phash_distance != null && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                {[
                  ['pHash Distance', v.phash_distance],
                  ['aHash Distance', v.ahash_distance],
                  ['dHash Distance', v.dhash_distance],
                ].map(([k, val]) => (
                  <div key={k} className="text-center">
                    <div className="text-slate-500 text-xs">{k}</div>
                    <div className="text-white font-mono">{val ?? '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {b64 ? (
          <img src={b64} alt="Page Screenshot" className="rounded-xl border border-white/10 w-full max-h-96 object-contain" />
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-500 text-sm bg-dark-800 rounded-xl">
            {v.error || v.note || 'No screenshot available'}
          </div>
        )}
      </div>
    )
  }

  return null
}

function Flag({ label, color }) {
  const colors = {
    red: 'bg-red-500/10 border-red-500/25 text-red-400',
    orange: 'bg-orange-500/10 border-orange-500/25 text-orange-400',
    green: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
    slate: 'bg-slate-500/10 border-slate-500/25 text-slate-400',
  }
  return (
    <span className={clsx('px-2.5 py-1 rounded-lg border text-xs font-medium', colors[color] || colors.slate)}>
      {label}
    </span>
  )
}
