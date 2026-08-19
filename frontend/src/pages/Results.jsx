import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, Download, Trash2, Eye, EyeOff,
  RefreshCw, ChevronLeft, ChevronRight, X,
  AlertTriangle, Clock, Shield,
} from 'lucide-react'
import { resultsAPI, exportAPI } from '../api/client'
import VerdictBadge from '../components/VerdictBadge'
import ScoreGauge from '../components/ScoreGauge'
import ScoreBar from '../components/ScoreBar'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const VERDICTS = ['', 'phishing', 'suspicious', 'safe', 'unknown']

/* ── Pill badge helper ───────────────────────────────────────── */
function Pill({ label, color }) {
  const c = {
    red:    'bg-red-500/10 border-red-500/25 text-red-400',
    orange: 'bg-orange-500/10 border-orange-500/25 text-orange-400',
    green:  'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  }
  return (
    <span className={clsx('px-2.5 py-0.5 rounded-lg border text-xs font-medium inline-block', c[color] || c.orange)}>
      {label}
    </span>
  )
}

/* ── Inline detail panel ─────────────────────────────────────── */
function DetailPanel({ result, loading, onClose }) {
  const [tab, setTab] = useState('overview')

  if (loading || !result) {
    return (
      <div className="bg-dark-800/60 p-8 flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Loading report…</span>
      </div>
    )
  }

  const whois   = result.whois_data || {}
  const dns     = result.dns_data || {}
  const content = result.content_features || {}
  const urlF    = result.url_features || {}
  const visual  = result.visual_features || {}

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'url',      label: 'URL Analysis' },
    { id: 'whois',    label: 'WHOIS / DNS' },
    { id: 'content',  label: 'Content' },
    { id: 'visual',   label: 'Visual' },
  ]

  const borderColor =
    result.verdict === 'phishing'   ? 'border-red-500/50' :
    result.verdict === 'suspicious' ? 'border-orange-500/50' :
    result.verdict === 'safe'       ? 'border-emerald-500/50' :
                                      'border-slate-500/30'

  return (
    <div className={clsx('bg-dark-800/80 border-t-2', borderColor)}>
      {/* Panel header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 border-b border-white/5">
        <div className="flex-shrink-0">
          <ScoreGauge score={result.overall_score} verdict={result.verdict} size={120} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-white font-bold font-mono text-base">{result.domain}</span>
            <VerdictBadge verdict={result.verdict} />
            <span className="text-xs px-2 py-0.5 rounded-full border bg-white/5 border-white/15 text-slate-400">
              {result.confidence} confidence
            </span>
          </div>

          <p className="text-slate-500 text-xs font-mono truncate mb-3">{result.url}</p>

          {result.target_brand && (
            <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20
                            rounded-lg px-3 py-1.5 mb-3 w-fit">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-orange-400 text-xs font-semibold">
                Impersonating {result.target_brand}
              </span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
            <ScoreBar label="URL Analysis"      score={result.url_score}     delay={0}    />
            <ScoreBar label="WHOIS / DNS"        score={result.whois_score}   delay={0.05} />
            <ScoreBar label="Content Analysis"  score={result.content_score} delay={0.1}  />
            <ScoreBar label="Visual Similarity" score={result.visual_score}  delay={0.15} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
          <div className="text-right space-y-0.5">
            <div className="text-slate-600 text-xs flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3" /> {result.scan_duration_ms}ms
            </div>
            <div className="text-slate-600 text-xs">
              {new Date(result.scanned_at).toLocaleString()}
            </div>
          </div>
          {result.id && (
            <button
              onClick={() => {
                exportAPI.downloadSingleReport(result.id, result.domain)
                toast.success('Downloading PDF…')
              }}
              className="btn-primary text-xs py-1.5"
            >
              <Download className="w-3 h-3" /> PDF Report
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors',
              tab === t.id ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-300',
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {tab === 'overview' && (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {[
              ['Domain Age',          whois.domain_age_days != null ? `${whois.domain_age_days} days` : 'Unknown'],
              ['Registrar',           whois.registrar || 'Unknown'],
              ['Country',             whois.registrant_country || 'Unknown'],
              ['HTTPS',               urlF.uses_https ? 'Yes ✓' : 'No ✗'],
              ['URL Length',          urlF.url_length ?? '—'],
              ['Subdomain Depth',     urlF.subdomain_count ?? 0],
              ['Suspicious Keywords', urlF.suspicious_keyword_count ?? 0],
              ['Homoglyphs',          urlF.homoglyph_count ?? 0],
              ['Suspicious TLD',      urlF.is_suspicious_tld ? 'Yes ⚠️' : 'No'],
              ['IP as Domain',        urlF.is_ip_domain ? 'Yes ⚠️' : 'No'],
              ['Login Form',          content.has_login_form ? 'Detected ⚠️' : 'No'],
              ['Obfuscated JS',       content.obfuscated_js ? 'Detected ⚠️' : 'No'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-500 text-xs">{k}</span>
                <span className="text-slate-200 text-xs font-medium">{String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'url' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['URL Length',     urlF.url_length],
                ['Entropy',        urlF.domain_entropy],
                ['Subdomains',     urlF.subdomain_count],
                ['Hyphens',        urlF.hyphens_in_domain],
                ['Digit Ratio',    urlF.digit_ratio_in_domain],
                ['Homoglyphs',     urlF.homoglyph_count],
                ['Keywords',       urlF.suspicious_keyword_count],
                ['Brand Dist.',    urlF.min_brand_edit_distance === -1 ? 'N/A' : urlF.min_brand_edit_distance],
              ].map(([k, v]) => (
                <div key={k} className="bg-dark-900 rounded-xl p-2.5">
                  <div className="text-slate-600 text-xs mb-0.5">{k}</div>
                  <div className="text-white text-sm font-mono font-semibold">{v ?? '—'}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {urlF.is_suspicious_tld   && <Pill label="Suspicious TLD"  color="red"    />}
              {urlF.is_ip_domain        && <Pill label="IP as Domain"     color="red"    />}
              {urlF.homoglyph_count > 0 && <Pill label="Homoglyphs"       color="red"    />}
              {urlF.has_login_keyword   && <Pill label="Login Keyword"    color="orange" />}
              {urlF.has_url_shortener   && <Pill label="URL Shortener"    color="orange" />}
              {urlF.uses_https
                ? <Pill label="HTTPS ✓" color="green" />
                : <Pill label="No HTTPS" color="red" />}
            </div>
          </div>
        )}

        {tab === 'whois' && (
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">WHOIS</p>
              <div className="space-y-1">
                {[
                  ['Registrar',    whois.registrar],
                  ['Created',      whois.creation_date ? new Date(whois.creation_date).toLocaleDateString() : null],
                  ['Expires',      whois.expiration_date ? new Date(whois.expiration_date).toLocaleDateString() : null],
                  ['Domain Age',   whois.domain_age_days != null ? `${whois.domain_age_days} days` : null],
                  ['Until Expiry', whois.days_until_expiry != null ? `${whois.days_until_expiry} days` : null],
                  ['Country',      whois.registrant_country],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-white/5 text-xs">
                    <span className="text-slate-500">{k}</span>
                    <span className={v ? 'text-slate-200 font-medium' : 'text-slate-600'}>{v || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">DNS</p>
              <div className="space-y-1.5">
                <Pill label={dns.resolves ? 'Resolves ✓' : 'Not Resolving'} color={dns.resolves ? 'green' : 'red'} />
                <Pill label={dns.has_spf ? 'SPF Present ✓' : 'No SPF'} color={dns.has_spf ? 'green' : 'orange'} />
                <Pill label={dns.has_dmarc ? 'DMARC Present ✓' : 'No DMARC'} color={dns.has_dmarc ? 'green' : 'orange'} />
                {dns.a_records?.[0] && (
                  <code className="block text-slate-400 text-xs font-mono bg-dark-900 px-2 py-1 rounded mt-1">
                    IP: {dns.a_records[0]}
                  </code>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'content' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {content.has_login_form       && <Pill label="Login Form ⚠"       color="orange" />}
              {content.has_password_field   && <Pill label="Password Field ⚠"   color="red"    />}
              {content.form_action_external && <Pill label="Ext. Form Action ⚠" color="red"    />}
              {content.obfuscated_js        && <Pill label="Obfuscated JS ⚠"    color="red"    />}
              {content.meta_redirect        && <Pill label="Meta Redirect"       color="orange" />}
              {content.has_captcha          && <Pill label="CAPTCHA ✓"           color="green"  />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Title',      content.title || 'N/A'],
                ['Words',      content.word_count],
                ['Scripts',    content.script_count],
                ['iFrames',    content.iframe_count],
                ['Images',     content.image_count],
                ['Ext Links',  content.external_links_count],
                ['Target Sim', content.target_similarity != null
                  ? `${Math.round(content.target_similarity * 100)}%` : 'N/A'],
              ].map(([k, v]) => (
                <div key={k} className="bg-dark-900 rounded-xl p-2.5">
                  <div className="text-slate-600 text-xs mb-0.5">{k}</div>
                  <div className="text-white text-sm font-medium truncate">{String(v ?? '—')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'visual' && (
          <div className="space-y-3">
            {visual.similarity_score != null ? (
              <>
                <ScoreBar
                  label={`Visual similarity to ${result.target_brand || 'target brand'}`}
                  score={visual.similarity_score}
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[
                    ['pHash Dist.', visual.phash_distance],
                    ['aHash Dist.', visual.ahash_distance],
                    ['dHash Dist.', visual.dhash_distance],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-dark-900 rounded-xl p-2.5 text-center">
                      <div className="text-slate-600 text-xs mb-0.5">{k}</div>
                      <div className="text-white font-mono">{v ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500 text-sm">
                {visual.error || visual.note || 'No visual analysis data available'}
              </p>
            )}
            {result.screenshot_b64 && (
              <img
                src={result.screenshot_b64}
                alt="Screenshot"
                className="rounded-xl border border-white/10 w-full max-h-64 object-contain mt-2"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Results page ───────────────────────────────────────── */
export default function Results() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [verdict, setVerdict] = useState('')
  const [minScore, setMinScore] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const { data, isLoading, refetch } = useQuery(
    ['results', page, search, verdict, minScore],
    () => resultsAPI.list({
      page,
      per_page: 20,
      search: search || undefined,
      verdict: verdict || undefined,
      min_score: minScore ? parseFloat(minScore) / 100 : undefined,
    }),
    { keepPreviousData: true },
  )

  const deleteMutation = useMutation(resultsAPI.delete, {
    onSuccess: () => {
      toast.success('Result deleted')
      setExpandedId(null)
      qc.invalidateQueries('results')
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: detailData, isLoading: detailLoading } = useQuery(
    ['result_detail', expandedId],
    () => resultsAPI.get(expandedId),
    { enabled: !!expandedId, staleTime: 60000 },
  )

  const scoreColor = (score) =>
    score >= 0.7 ? 'text-red-400' : score >= 0.45 ? 'text-orange-400' : 'text-emerald-400'

  const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">
            My Scan <span className="text-gradient">Results</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {data?.total ?? '—'} scans from this browser
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportAPI.download('json')} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
          <button onClick={() => exportAPI.download('csv')} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportAPI.download('pdf')} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => refetch()} className="btn-secondary text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search your scanned domains…"
              className="input pl-10 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary text-xs', showFilters && 'bg-brand-600/20 border-brand-500/30 text-brand-400')}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-3 pt-2 border-t border-white/5 overflow-hidden"
            >
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs">Verdict</label>
                <select
                  value={verdict}
                  onChange={(e) => { setVerdict(e.target.value); setPage(1) }}
                  className="input py-1.5 text-sm w-40"
                >
                  {VERDICTS.map(v => (
                    <option key={v} value={v}>{v || 'All Verdicts'}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-500 text-xs">Min Score (%)</label>
                <input
                  type="number" min={0} max={100}
                  value={minScore}
                  onChange={(e) => { setMinScore(e.target.value); setPage(1) }}
                  placeholder="0"
                  className="input py-1.5 text-sm w-24"
                />
              </div>
              <button
                onClick={() => { setVerdict(''); setMinScore(''); setSearch(''); setPage(1) }}
                className="btn-secondary text-xs self-end"
              >
                Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                {['Domain', 'Target Brand', 'Score', 'Verdict', 'Confidence', 'Scanned', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                      <Shield className="w-10 h-10 opacity-20" />
                      <p className="text-sm">No scans found for this browser.</p>
                      <p className="text-xs text-slate-600">
                        Go to the Live Scanner and scan a domain — it will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.items?.map((r) => (
                  <tbody key={r.id}>
                    {/* ── Data row ── */}
                    <tr className={clsx(
                      'border-b border-white/5 transition-colors',
                      expandedId === r.id ? 'bg-brand-500/5' : 'hover:bg-white/[0.02]',
                    )}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-slate-200 text-xs font-medium truncate max-w-[180px]">
                          {r.domain}
                        </div>
                        <div className="text-slate-600 text-xs truncate max-w-[180px]">{r.url}</div>
                      </td>
                      <td className="px-4 py-3">
                        {r.target_brand
                          ? <span className="text-orange-400 text-xs font-medium">{r.target_brand}</span>
                          : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('font-mono font-bold text-sm', scoreColor(r.overall_score))}>
                          {Math.round(r.overall_score * 100)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <VerdictBadge verdict={r.verdict} />
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs capitalize', r.confidence === 'high' ? 'text-white' : 'text-slate-400')}>
                          {r.confidence}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(r.scanned_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Eye button — shows inline full report */}
                          <button
                            onClick={() => toggleExpand(r.id)}
                            title={expandedId === r.id ? 'Collapse report' : 'View full report'}
                            className={clsx(
                              'p-1.5 rounded-lg transition-colors',
                              expandedId === r.id
                                ? 'text-brand-400 bg-brand-500/15'
                                : 'text-slate-500 hover:text-brand-400 hover:bg-white/5',
                            )}
                          >
                            {expandedId === r.id
                              ? <EyeOff className="w-3.5 h-3.5" />
                              : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete scan for ${r.domain}?`)) {
                                deleteMutation.mutate(r.id)
                              }
                            }}
                            title="Delete this result"
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Inline detail panel row ── */}
                    {expandedId === r.id && (
                      <tr>
                        <td colSpan={7} className="p-0 border-b border-white/5">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                          >
                            <DetailPanel
                              result={detailData}
                              loading={detailLoading}
                              onClose={() => setExpandedId(null)}
                            />
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-slate-500 text-xs">Page {data.page} of {data.pages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/5">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/5">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
