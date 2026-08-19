import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  Zap, ShieldAlert, Search, BarChart3, Globe, FileText,
  Clock, Brain, Eye, ChevronRight, ArrowRight,
  Mail, Github, Linkedin, Twitter, Phone, MapPin,
  CheckCircle, AlertTriangle, Shield, Lock, Cpu,
  TrendingUp, Database, Layers, LayoutDashboard,
} from 'lucide-react'
import Logo from '../components/Logo'

/* ── tiny helpers ─────────────────────────────────────────────── */
function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function GlowOrb({ className }) {
  return (
    <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />
  )
}

/* ── NAVBAR ───────────────────────────────────────────────────── */
function Navbar() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-dark-900/90 backdrop-blur-md border-b border-white/5 shadow-xl' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <span className="text-white font-bold text-lg tracking-tight">
            PhishVision<span className="text-brand-400"> AI</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-6">
          {[['Features','features'],['How It Works','howitworks'],['Stats','stats'],['Contact','contact']].map(([label,id]) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors">
              {label}
            </button>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10
                       hover:border-brand-500/40 text-slate-300 hover:text-white
                       text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => navigate('/scanner')}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white
                       text-sm font-semibold px-4 py-2 rounded-xl transition-all duration-200
                       shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40"
          >
            <Search className="w-4 h-4" />
            Scan a Domain
          </button>
        </div>
      </div>
    </header>
  )
}

/* ── HERO ─────────────────────────────────────────────────────── */
function Hero() {
  const navigate = useNavigate()

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background orbs */}
      <GlowOrb className="w-[600px] h-[600px] bg-brand-600/15 -top-32 -left-32" />
      <GlowOrb className="w-[500px] h-[500px] bg-violet-600/10 top-1/2 -right-48" />
      <GlowOrb className="w-[300px] h-[300px] bg-brand-500/10 bottom-0 left-1/2" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/25
                     text-brand-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-6"
        >
          <Zap className="w-3.5 h-3.5" fill="currentColor" />
          AI-Powered Phishing Detection Platform
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-5"
        >
          Detect Phishing Domains
          <br />
          <span className="bg-gradient-to-r from-brand-400 via-violet-400 to-brand-300
                           bg-clip-text text-transparent">
            Before They Strike
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          PhishVision AI automatically scans newly registered domains using machine learning,
          WHOIS intelligence, content analysis, and visual similarity to catch phishing sites
          with a probability score — before users fall victim.
        </motion.p>

        {/* CTA button — goes directly to scanner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex justify-center mb-8"
        >
          <button
            onClick={() => navigate('/scanner')}
            className="group flex items-center gap-3 bg-brand-600 hover:bg-brand-500
                       text-white font-bold text-base px-10 py-4 rounded-2xl
                       transition-all duration-200 shadow-2xl shadow-brand-500/40
                       hover:shadow-brand-500/60 hover:scale-105"
          >
            <Search className="w-5 h-5" />
            Click Here to Scan a Domain
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500"
        >
          {['Free to use','No signup required','Real-time results','PDF reports'].map(t => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              {t}
            </span>
          ))}
        </motion.div>

        {/* Floating score preview cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
        >
          {[
            { domain: 'secure-paypal-verify.xyz', score: 94, verdict: 'phishing', brand: 'PayPal' },
            { domain: 'amazon-order-confirm.net', score: 81, verdict: 'phishing', brand: 'Amazon' },
            { domain: 'github.com', score: 3, verdict: 'safe', brand: null },
          ].map((item) => (
            <div key={item.domain}
              className={`card p-4 text-left border ${
                item.verdict === 'phishing' ? 'border-red-500/25 bg-red-500/5' :
                'border-emerald-500/25 bg-emerald-500/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  item.verdict === 'phishing'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {item.verdict.toUpperCase()}
                </span>
                <span className={`text-xl font-bold font-mono ${
                  item.score > 60 ? 'text-red-400' : 'text-emerald-400'
                }`}>{item.score}%</span>
              </div>
              <p className="text-slate-300 text-xs font-mono truncate">{item.domain}</p>
              {item.brand && (
                <p className="text-orange-400 text-xs mt-1">⚠ Impersonating {item.brand}</p>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ── FEATURES ─────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Brain,
    color: 'brand',
    title: 'AI/ML Ensemble Scoring',
    desc: 'Random Forest and heuristic models combine URL features, domain entropy, homoglyph detection, and brand edit-distance into a single probability score (0–100%).',
  },
  {
    icon: Globe,
    color: 'violet',
    title: 'WHOIS Intelligence',
    desc: 'Newly registered domains, throwaway registrars, missing SPF/DMARC records, and short expiry windows are all red flags. We analyze all of them automatically.',
  },
  {
    icon: Layers,
    color: 'blue',
    title: 'Content Analysis',
    desc: 'Detects login forms, external form actions (credential harvesting), obfuscated JavaScript, meta redirects, and structural similarity to known legitimate pages.',
  },
  {
    icon: Eye,
    color: 'purple',
    title: 'Visual Similarity',
    desc: 'Screenshots compared using perceptual hashing (pHash, aHash, dHash) and SSIM. A PayPal clone that looks pixel-perfect is flagged even if the HTML differs.',
  },
  {
    icon: Clock,
    color: 'emerald',
    title: 'Auto-Scanner',
    desc: 'Every 6 hours, newly registered domains are pulled from certificate transparency logs and scanned automatically — catching threats before they reach users.',
  },
  {
    icon: FileText,
    color: 'orange',
    title: 'Flexible Reports',
    desc: 'Download per-domain PDF reports with full score breakdowns, risk summaries, and forensic details. Bulk export in JSON or CSV for SIEM integration.',
  },
  {
    icon: Database,
    color: 'cyan',
    title: 'Bulk Scanning',
    desc: 'Upload a .txt or .csv with up to 500 domains. Background job processing with live progress tracking — ideal for SOC teams and threat researchers.',
  },
  {
    icon: Shield,
    color: 'pink',
    title: '20+ Brand Targets',
    desc: 'Pre-loaded with PayPal, Google, Microsoft, Apple, Amazon, banking and crypto brands. Add custom brands with keywords for tailored monitoring.',
  },
]

const COLOR_MAP = {
  brand:   { bg: 'bg-brand-500/10',   border: 'border-brand-500/20',   icon: 'text-brand-400'   },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  icon: 'text-violet-400'  },
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    icon: 'text-blue-400'    },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  icon: 'text-purple-400'  },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  icon: 'text-orange-400'  },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    icon: 'text-cyan-400'    },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/20',    icon: 'text-pink-400'    },
}

function Features() {
  return (
    <section id="features" className="py-24 relative">
      <GlowOrb className="w-[400px] h-[400px] bg-violet-600/8 top-0 right-0" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-14">
          <span className="text-brand-400 text-xs font-semibold uppercase tracking-widest">
            Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 mb-3">
            Everything you need to <span className="text-gradient">stop phishing</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-base">
            Four independent analysis engines combine into one definitive verdict,
            so nothing slips through.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => {
            const c = COLOR_MAP[f.color]
            const Icon = f.icon
            return (
              <FadeIn key={f.title} delay={i * 0.05}
                className={`card-hover p-5 border ${c.border} rounded-2xl group`}>
                <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border}
                                flex items-center justify-center mb-4
                                group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`w-5 h-5 ${c.icon}`} />
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </FadeIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ── HOW IT WORKS ─────────────────────────────────────────────── */
const STEPS = [
  {
    num: '01', icon: Globe, color: 'text-brand-400',
    title: 'Domain Input',
    desc: 'Enter any domain or URL manually, upload a CSV list, or let the auto-scanner pull newly registered domains from certificate transparency logs every 6 hours.',
  },
  {
    num: '02', icon: Cpu, color: 'text-violet-400',
    title: 'Multi-Engine Analysis',
    desc: 'Four engines run in parallel: URL feature extraction (25+ signals), WHOIS/DNS intelligence, HTML content analysis, and visual screenshot comparison.',
  },
  {
    num: '03', icon: Brain, color: 'text-blue-400',
    title: 'AI Ensemble Scoring',
    desc: 'Scores from each engine are weighted (URL 35%, WHOIS 25%, Content 30%, Visual 10%) and combined into a final phishing probability score.',
  },
  {
    num: '04', icon: ShieldAlert, color: 'text-red-400',
    title: 'Verdict & Report',
    desc: 'Domains are classified as Safe / Suspicious / Phishing with High/Medium/Low confidence. Download a forensic PDF report or export bulk results.',
  },
]

function HowItWorks() {
  return (
    <section id="howitworks" className="py-24 relative bg-dark-800/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-14">
          <span className="text-brand-400 text-xs font-semibold uppercase tracking-widest">
            Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 mb-3">
            How PhishVision <span className="text-gradient">works</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-base">
            From domain input to actionable verdict in seconds.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px
                          bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <FadeIn key={s.num} delay={i * 0.1}>
                <div className="card p-6 relative text-center">
                  {/* Step number */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2
                                  bg-dark-700 border border-white/10 text-brand-400
                                  text-xs font-bold px-3 py-0.5 rounded-full">
                    {s.num}
                  </div>
                  <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10
                                  flex items-center justify-center mx-auto mb-4 mt-2`}>
                    <Icon className={`w-6 h-6 ${s.color}`} />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                </div>
              </FadeIn>
            )
          })}
        </div>

        {/* Score explanation */}
        <FadeIn delay={0.2} className="mt-12">
          <div className="card p-6 max-w-2xl mx-auto">
            <h4 className="text-white font-semibold mb-4 text-center">Score Thresholds</h4>
            <div className="space-y-3">
              {[
                { label: 'Safe',                  range: '0 – 35%',   color: 'bg-emerald-500', text: 'text-emerald-400', w: '35%',  desc: 'No significant indicators' },
                { label: 'Suspicious (low)',       range: '35 – 50%',  color: 'bg-yellow-500',  text: 'text-yellow-400',  w: '50%',  desc: 'Minor signals, review recommended' },
                { label: 'Suspicious (medium)',    range: '50 – 65%',  color: 'bg-orange-500',  text: 'text-orange-400',  w: '65%',  desc: 'Multiple signals, investigate' },
                { label: 'Phishing (medium conf)', range: '65 – 80%',  color: 'bg-red-400',     text: 'text-red-400',     w: '80%',  desc: 'Strong indicators, likely malicious' },
                { label: 'Phishing (high conf)',   range: '80 – 100%', color: 'bg-red-600',     text: 'text-red-500',     w: '100%', desc: 'Near-certain phishing site' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0">
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className={`h-full ${row.color} rounded-full`} style={{ width: row.w }} />
                    </div>
                  </div>
                  <span className={`text-xs font-mono font-bold w-20 flex-shrink-0 ${row.text}`}>
                    {row.range}
                  </span>
                  <span className="text-slate-400 text-xs truncate">{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ── STATS ────────────────────────────────────────────────────── */
function AnimatedNumber({ target, suffix = '' }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / 60
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setVal(target); clearInterval(timer) }
      else setVal(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target])

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

const STAT_ITEMS = [
  { value: 20,  suffix: '+',  label: 'Brand Targets Monitored',  icon: Shield,     color: 'text-brand-400'   },
  { value: 25,  suffix: '+',  label: 'URL Features Analyzed',    icon: Search,     color: 'text-violet-400'  },
  { value: 4,   suffix: '',   label: 'Analysis Engines',         icon: Cpu,        color: 'text-blue-400'    },
  { value: 6,   suffix: 'h',  label: 'Auto-Scan Interval',       icon: Clock,      color: 'text-emerald-400' },
  { value: 500, suffix: '',   label: 'Max Bulk Domains',         icon: Database,   color: 'text-orange-400'  },
  { value: 3,   suffix: '',   label: 'Export Formats (PDF/CSV/JSON)', icon: FileText, color: 'text-pink-400' },
]

function Stats() {
  return (
    <section id="stats" className="py-24 relative">
      <GlowOrb className="w-[500px] h-[500px] bg-brand-600/8 bottom-0 left-0" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-14">
          <span className="text-brand-400 text-xs font-semibold uppercase tracking-widest">
            By the numbers
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 mb-3">
            Built for <span className="text-gradient">serious detection</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {STAT_ITEMS.map((s, i) => {
            const Icon = s.icon
            return (
              <FadeIn key={s.label} delay={i * 0.07}
                className="card p-5 text-center hover:border-white/10 transition-colors">
                <Icon className={`w-6 h-6 mx-auto mb-2 ${s.color}`} />
                <div className={`text-2xl font-extrabold font-mono mb-1 ${s.color}`}>
                  <AnimatedNumber target={s.value} suffix={s.suffix} />
                </div>
                <p className="text-slate-500 text-xs leading-tight">{s.label}</p>
              </FadeIn>
            )
          })}
        </div>

        {/* Technique comparison */}
        <FadeIn delay={0.2} className="mt-12 card p-6">
          <h3 className="text-white font-semibold mb-5 text-center">Detection Techniques Overview</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: 'URL Analysis',
                items: ['Domain entropy', 'Homoglyph detection', 'Brand edit distance', 'Suspicious TLD', 'Special char counts', 'Subdomain depth'],
                color: 'border-brand-500/30',
                badge: 'bg-brand-500/10 text-brand-400',
              },
              {
                title: 'WHOIS / DNS',
                items: ['Domain age', 'Registrar reputation', 'Days until expiry', 'SPF record check', 'DMARC analysis', 'IP resolution'],
                color: 'border-violet-500/30',
                badge: 'bg-violet-500/10 text-violet-400',
              },
              {
                title: 'Content',
                items: ['Login form detection', 'External form action', 'Obfuscated JS', 'Meta redirects', 'Structure hash', 'Target similarity'],
                color: 'border-blue-500/30',
                badge: 'bg-blue-500/10 text-blue-400',
              },
              {
                title: 'Visual',
                items: ['Playwright screenshots', 'pHash comparison', 'aHash comparison', 'dHash comparison', 'SSIM scoring', '1-hour cache'],
                color: 'border-purple-500/30',
                badge: 'bg-purple-500/10 text-purple-400',
              },
            ].map(col => (
              <div key={col.title} className={`border ${col.color} rounded-xl p-4`}>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${col.badge} mb-3 inline-block`}>
                  {col.title}
                </span>
                <ul className="space-y-1.5">
                  {col.items.map(item => (
                    <li key={item} className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ── CTA BANNER ───────────────────────────────────────────────── */
function CTABanner() {
  const navigate = useNavigate()
  return (
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 via-violet-600/10 to-transparent" />
      <GlowOrb className="w-[400px] h-[400px] bg-brand-500/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <FadeIn>
          <div className="flex items-center justify-center mx-auto mb-6">
            <Logo size={72} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to protect your users?
          </h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Start scanning domains immediately — no signup, no API keys, no setup required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/scanner')}
              className="bg-brand-600 hover:bg-brand-500 text-white font-semibold px-8 py-3.5
                         rounded-xl flex items-center justify-center gap-2 transition-all
                         shadow-lg shadow-brand-500/30 text-sm"
            >
              <Search className="w-4 h-4" /> Scan a Domain
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20
                         text-slate-300 hover:text-white font-semibold px-8 py-3.5 rounded-xl
                         flex items-center justify-center gap-2 transition-all text-sm"
            >
              <BarChart3 className="w-4 h-4" /> View Dashboard
            </button>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ── CONTACT ──────────────────────────────────────────────────── */
function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    // In a real deployment this would POST to a backend
    setSent(true)
    setTimeout(() => setSent(false), 4000)
    setForm({ name: '', email: '', subject: '', message: '' })
  }

  return (
    <section id="contact" className="py-24 bg-dark-800/30 relative">
      <GlowOrb className="w-[400px] h-[400px] bg-violet-600/8 top-0 right-0" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-14">
          <span className="text-brand-400 text-xs font-semibold uppercase tracking-widest">
            Get in Touch
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2 mb-3">
            Contact <span className="text-gradient">Us</span>
          </h2>
          <p className="text-slate-400 max-w-lg mx-auto text-base">
            Questions about PhishVision, enterprise deployment, or want to report a false positive?
            We're here to help.
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Contact info */}
          <FadeIn className="space-y-6">
            <div className="card p-6 space-y-5">
              <h3 className="text-white font-semibold text-lg">Contact Information</h3>

              {[
                {
                  icon: Mail, color: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
                  label: 'Email', value: 'security@phishvision.ai',
                  sub: 'Response within 24 hours',
                },
                {
                  icon: Phone, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  label: 'Support', value: '+1 (555) 0199',
                  sub: 'Mon–Fri, 9am–6pm EST',
                },
                {
                  icon: MapPin, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                  label: 'Location', value: 'San Francisco, CA',
                  sub: 'United States',
                },
              ].map(({ icon: Icon, color, label, value, sub }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-medium">{label}</p>
                    <p className="text-white text-sm font-semibold">{value}</p>
                    <p className="text-slate-500 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Social links */}
            <div className="card p-5">
              <h4 className="text-white font-semibold mb-4 text-sm">Follow &amp; Collaborate</h4>
              <div className="flex items-center gap-3">
                {[
                  { icon: Github,   label: 'GitHub',   href: '#', color: 'hover:border-white/30 hover:text-white' },
                  { icon: Twitter,  label: 'Twitter',  href: '#', color: 'hover:border-blue-500/40 hover:text-blue-400' },
                  { icon: Linkedin, label: 'LinkedIn', href: '#', color: 'hover:border-blue-600/40 hover:text-blue-500' },
                  { icon: Mail,     label: 'Newsletter',href: '#', color: 'hover:border-brand-500/40 hover:text-brand-400' },
                ].map(({ icon: Icon, label, href, color }) => (
                  <a key={label} href={href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10
                                text-slate-400 text-xs font-medium transition-all duration-200 ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Quick info box */}
            <div className="card p-5 border border-brand-500/20 bg-brand-500/5">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-brand-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Security Researchers</p>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    PhishVision is designed for legitimate security research.
                    All scan data is stored locally and never shared.
                    If you discover a real phishing site, please also report it to
                    Google Safe Browsing and the relevant brand's abuse team.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Contact form */}
          <FadeIn delay={0.1}>
            <div className="card p-6">
              <h3 className="text-white font-semibold text-lg mb-5">Send a Message</h3>
              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30
                                  flex items-center justify-center mb-4">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-white font-semibold text-lg mb-1">Message sent!</p>
                  <p className="text-slate-500 text-sm">We'll get back to you within 24 hours.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 text-xs font-medium">Full Name</label>
                      <input
                        required
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="John Smith"
                        className="input py-2.5 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-slate-400 text-xs font-medium">Email Address</label>
                      <input
                        required type="email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="john@example.com"
                        className="input py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-xs font-medium">Subject</label>
                    <select
                      value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      className="input py-2.5 text-sm"
                    >
                      <option value="">Select a topic…</option>
                      <option>General Inquiry</option>
                      <option>False Positive Report</option>
                      <option>Enterprise Deployment</option>
                      <option>Bug Report</option>
                      <option>Feature Request</option>
                      <option>Security Research Collaboration</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-slate-400 text-xs font-medium">Message</label>
                    <textarea
                      required rows={5}
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Tell us how we can help…"
                      className="input py-2.5 text-sm resize-none"
                    />
                  </div>
                  <button type="submit"
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold
                               py-3 rounded-xl flex items-center justify-center gap-2
                               transition-all duration-200 shadow-lg shadow-brand-500/20 text-sm">
                    <Mail className="w-4 h-4" />
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

/* ── FOOTER ───────────────────────────────────────────────────── */
function Footer() {
  const navigate = useNavigate()
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  return (
    <footer className="border-t border-white/5 bg-dark-800/50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <Logo size={30} />
              <span className="text-white font-bold text-lg tracking-tight">
                PhishVision<span className="text-brand-400"> AI</span>
              </span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              An automated, AI-powered phishing domain detection platform for security
              researchers, SOC analysts, and developers who need actionable threat intelligence.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-white font-semibold text-sm mb-3">Platform</p>
            <ul className="space-y-2">
              {[
                ['Dashboard', () => navigate('/dashboard')],
                ['Live Scanner', () => navigate('/scanner')],
                ['Bulk Scan', () => navigate('/bulk')],
                ['Results', () => navigate('/results')],
                ['Target Brands', () => navigate('/targets')],
              ].map(([label, fn]) => (
                <li key={label}>
                  <button onClick={fn}
                    className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white font-semibold text-sm mb-3">Information</p>
            <ul className="space-y-2">
              {[
                ['Features', 'features'],
                ['How It Works', 'howitworks'],
                ['Statistics', 'stats'],
                ['Contact', 'contact'],
              ].map(([label, id]) => (
                <li key={label}>
                  <button onClick={() => scrollTo(id)}
                    className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row
                        items-center justify-between gap-3">
          <p className="text-slate-600 text-xs">
            © 2026 PhishVision AI. Built for security research purposes.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ── PAGE ─────────────────────────────────────────────────────── */
export default function Home() {
  return (
    <div className="bg-dark-900 min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Stats />
      <CTABanner />
      <Contact />
      <Footer />
    </div>
  )
}
