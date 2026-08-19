import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, ExternalLink, Clock, Globe } from 'lucide-react'
import { resultsAPI, exportAPI } from '../api/client'
import ScoreGauge from '../components/ScoreGauge'
import ScoreBar from '../components/ScoreBar'
import VerdictBadge from '../components/VerdictBadge'
import clsx from 'clsx'

export default function ResultDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: result, isLoading, error } = useQuery(
    ['result', id],
    () => resultsAPI.get(id),
    { staleTime: 60000 },
  )

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-4">{error?.message || 'Result not found'}</p>
        <button onClick={() => navigate('/results')} className="btn-secondary">← Back to Results</button>
      </div>
    )
  }

  const whois = result.whois_data || {}
  const dns = result.dns_data || {}
  const content = result.content_features || {}
  const visual = result.visual_features || {}
  const urlF = result.url_features || {}

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back + Export */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/results')} className="btn-secondary text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Results
        </button>
        <button
          onClick={() => {
            exportAPI.downloadSingleReport(result.id, result.domain)
          }}
          className="btn-primary text-xs"
        >
          <Download className="w-3.5 h-3.5" /> Download Report
        </button>
      </div>

      {/* Hero card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={clsx(
          'card p-6 border',
          result.verdict === 'phishing' && 'border-red-500/25',
          result.verdict === 'suspicious' && 'border-orange-500/25',
          result.verdict === 'safe' && 'border-emerald-500/25',
        )}
      >
        <div className="flex flex-col md:flex-row gap-8">
          <ScoreGauge score={result.overall_score} verdict={result.verdict} size={180} />

          <div className="flex-1 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h2 className="text-white text-xl font-bold font-mono">{result.domain}</h2>
                <VerdictBadge verdict={result.verdict} size="lg" />
              </div>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 text-sm hover:text-brand-400 flex items-center gap-1 font-mono"
              >
                {result.url} <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {result.target_brand && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                <p className="text-orange-400 font-semibold text-sm">
                  ⚠️ Impersonating: {result.target_brand}
                </p>
                <p className="text-orange-300/60 text-xs mt-0.5">
                  This domain appears to be mimicking a legitimate brand
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
              <ScoreBar label="URL Analysis" score={result.url_score} delay={0} />
              <ScoreBar label="WHOIS / DNS" score={result.whois_score} delay={0.1} />
              <ScoreBar label="Content Analysis" score={result.content_score} delay={0.2} />
              <ScoreBar label="Visual Similarity" score={result.visual_score} delay={0.3} />
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {result.scan_duration_ms}ms scan time
              </span>
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {new Date(result.scanned_at).toLocaleString()}
              </span>
              <span>Confidence: <strong className="text-slate-300">{result.confidence}</strong></span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Detail sections */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* URL Features */}
        <Section title="URL Analysis" score={result.url_score}>
          <Grid items={[
            ['URL Length', urlF.url_length],
            ['Domain Entropy', urlF.domain_entropy],
            ['Subdomain Count', urlF.subdomain_count],
            ['Hyphens in Domain', urlF.hyphens_in_domain],
            ['Suspicious Keywords', urlF.suspicious_keyword_count],
            ['Homoglyphs', urlF.homoglyph_count],
            ['TLD', urlF.tld],
            ['Brand Edit Distance', urlF.min_brand_edit_distance === -1 ? 'N/A' : urlF.min_brand_edit_distance],
          ]} />
          <div className="flex flex-wrap gap-2 mt-3">
            <FlagBit label="HTTPS" on={!!urlF.uses_https} goodOn />
            <FlagBit label="IP Domain" on={!!urlF.is_ip_domain} goodOn={false} />
            <FlagBit label="Suspicious TLD" on={!!urlF.is_suspicious_tld} goodOn={false} />
            <FlagBit label="URL Shortener" on={!!urlF.has_url_shortener} goodOn={false} />
            <FlagBit label="Login Keyword" on={!!urlF.has_login_keyword} goodOn={false} />
          </div>
        </Section>

        {/* WHOIS */}
        <Section title="WHOIS Intelligence" score={result.whois_score}>
          <Grid items={[
            ['Registrar', whois.registrar],
            ['Domain Age', whois.domain_age_days != null ? `${whois.domain_age_days} days` : null],
            ['Created', whois.creation_date ? new Date(whois.creation_date).toLocaleDateString() : null],
            ['Expires', whois.expiration_date ? new Date(whois.expiration_date).toLocaleDateString() : null],
            ['Days Until Expiry', whois.days_until_expiry != null ? `${whois.days_until_expiry} days` : null],
            ['Country', whois.registrant_country],
            ['Resolves', dns.resolves ? 'Yes' : 'No'],
            ['IP Address', dns.a_records?.[0]],
          ]} />
          <div className="flex flex-wrap gap-2 mt-3">
            <FlagBit label="SPF Record" on={!!dns.has_spf} goodOn />
            <FlagBit label="DMARC Record" on={!!dns.has_dmarc} goodOn />
            <FlagBit label="Resolves" on={!!dns.resolves} goodOn />
          </div>
        </Section>

        {/* Content */}
        <Section title="Content Analysis" score={result.content_score}>
          <Grid items={[
            ['Page Title', content.title],
            ['Word Count', content.word_count],
            ['Scripts', content.script_count],
            ['iFrames', content.iframe_count],
            ['Images', content.image_count],
            ['External Links', content.external_links_count],
            ['Target Similarity', content.target_similarity != null ? `${Math.round(content.target_similarity * 100)}%` : null],
          ]} />
          <div className="flex flex-wrap gap-2 mt-3">
            <FlagBit label="Login Form" on={!!content.has_login_form} goodOn={false} />
            <FlagBit label="Password Field" on={!!content.has_password_field} goodOn={false} />
            <FlagBit label="Ext. Form Action" on={!!content.form_action_external} goodOn={false} />
            <FlagBit label="Obfuscated JS" on={!!content.obfuscated_js} goodOn={false} />
            <FlagBit label="Meta Redirect" on={!!content.meta_redirect} goodOn={false} />
          </div>
        </Section>

        {/* Visual */}
        <Section title="Visual Analysis" score={result.visual_score}>
          {visual.similarity_score != null ? (
            <div className="space-y-2">
              <ScoreBar label="Visual Similarity to Target" score={visual.similarity_score} />
              <Grid items={[
                ['Method', visual.method],
                ['pHash Distance', visual.phash_distance],
                ['aHash Distance', visual.ahash_distance],
                ['dHash Distance', visual.dhash_distance],
              ]} />
            </div>
          ) : (
            <p className="text-slate-500 text-sm">{visual.error || visual.note || 'No visual data available'}</p>
          )}
          {result.screenshot_b64 && (
            <img
              src={result.screenshot_b64}
              alt="Page Screenshot"
              className="rounded-xl border border-white/10 w-full max-h-52 object-contain mt-3"
            />
          )}
        </Section>
      </div>

      {result.error_message && (
        <div className="card p-4 border border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm font-medium mb-1">Partial Scan Warnings</p>
          <p className="text-yellow-300/70 text-xs font-mono">{result.error_message}</p>
        </div>
      )}
    </div>
  )
}

function Section({ title, score, children }) {
  const scoreColor = score >= 0.7 ? 'text-red-400' : score >= 0.45 ? 'text-orange-400' : 'text-emerald-400'
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        {score > 0 && (
          <span className={clsx('text-xs font-mono font-bold', scoreColor)}>
            {Math.round(score * 100)}%
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Grid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between items-center py-1.5 border-b border-white/5">
          <span className="text-slate-500 text-xs">{k}</span>
          <span className="text-slate-200 text-xs font-medium truncate ml-2 max-w-[120px]">
            {v != null ? String(v) : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function FlagBit({ label, on, goodOn }) {
  const isGood = on === goodOn
  return (
    <span className={clsx(
      'px-2.5 py-1 rounded-lg border text-xs font-medium',
      isGood
        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
        : on
          ? 'bg-red-500/10 border-red-500/25 text-red-400'
          : 'bg-slate-500/10 border-slate-500/20 text-slate-500',
    )}>
      {on ? '✓' : '✗'} {label}
    </span>
  )
}
