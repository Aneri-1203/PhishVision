import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, X, Play, Download, AlertCircle } from 'lucide-react'
import { scanAPI, exportAPI } from '../api/client'
import toast from 'react-hot-toast'
import VerdictBadge from '../components/VerdictBadge'
import clsx from 'clsx'

export default function BulkScan() {
  const [urls, setUrls] = useState([])
  const [rawText, setRawText] = useState('')
  const [inputMode, setInputMode] = useState('text') // 'text' | 'file'
  const [scanning, setScanning] = useState(false)
  const [jobId, setJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null)
  const [results, setResults] = useState([])

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target.result
        const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean)
        setUrls(prev => [...new Set([...prev, ...lines])].slice(0, 500))
        toast.success(`Loaded ${lines.length} URLs from ${file.name}`)
      }
      reader.readAsText(file)
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt', '.csv'] },
    maxFiles: 5,
  })

  const parseTextInput = () => {
    const lines = rawText.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean)
    setUrls([...new Set(lines)].slice(0, 500))
  }

  const handleScan = async () => {
    const list = urls.length > 0 ? urls : rawText.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean)
    if (list.length === 0) { toast.error('No URLs to scan'); return }

    setScanning(true)
    setResults([])
    try {
      const res = await scanAPI.bulk(list, false)
      setJobId(res.job_id)
      toast.success(`Bulk scan started: ${list.length} domains queued`)
    } catch (err) {
      toast.error(err.message)
      setScanning(false)
    }
  }

  // Poll job status
  useEffect(() => {
    if (!jobId) return
    const interval = setInterval(async () => {
      try {
        const status = await scanAPI.getJob(jobId)
        setJobStatus(status)
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval)
          setScanning(false)
          if (status.status === 'completed') {
            toast.success(`Scan complete! ${status.phishing_found} phishing domains found`)
          }
        }
      } catch (err) {
        clearInterval(interval)
        setScanning(false)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [jobId])

  const removeUrl = (i) => setUrls(prev => prev.filter((_, idx) => idx !== i))

  const urlList = urls.length > 0 ? urls : rawText.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-white">
          Bulk <span className="text-gradient">Domain Scanner</span>
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Scan up to 500 domains at once — paste, type, or upload a file
        </p>
      </div>

      {/* Input Mode Toggle */}
      <div className="card p-6 space-y-4">
        <div className="flex gap-2">
          {['text', 'file'].map(mode => (
            <button
              key={mode}
              onClick={() => setInputMode(mode)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                inputMode === mode
                  ? 'bg-brand-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:text-white',
              )}
            >
              {mode === 'text' ? '✏️ Paste URLs' : '📁 Upload File'}
            </button>
          ))}
        </div>

        {inputMode === 'text' ? (
          <div className="space-y-2">
            <label className="text-slate-400 text-sm">
              Enter URLs (one per line, or comma/semicolon separated)
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={'secure-paypal-verify.com\namazon-order-confirm.net\ngoogle-account-secure.xyz'}
              rows={8}
              className="input resize-none font-mono text-xs"
              disabled={scanning}
            />
            <div className="flex items-center gap-3">
              <button onClick={parseTextInput} className="btn-secondary text-xs">
                <FileText className="w-3.5 h-3.5" />
                Parse URLs
              </button>
              {urlList.length > 0 && (
                <span className="text-slate-500 text-xs">
                  {urlList.length} URL{urlList.length !== 1 ? 's' : ''} ready
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              isDragActive ? 'border-brand-500 bg-brand-500/5' : 'border-white/10 hover:border-white/20',
            )}
          >
            <input {...getInputProps()} />
            <Upload className={clsx('w-8 h-8 mx-auto mb-3', isDragActive ? 'text-brand-400' : 'text-slate-500')} />
            <p className="text-slate-400 text-sm">
              {isDragActive ? 'Drop files here' : 'Drag & drop .txt or .csv files, or click to browse'}
            </p>
            <p className="text-slate-600 text-xs mt-1">One domain per line or comma-separated</p>
          </div>
        )}

        {/* URL Preview */}
        {urls.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm font-medium">{urls.length} URLs queued</span>
              <button onClick={() => setUrls([])} className="text-slate-600 hover:text-slate-400 text-xs">
                Clear all
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-dark-800 rounded-xl">
              {urls.slice(0, 20).map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <code className="flex-1 text-slate-400 font-mono truncate">{u}</code>
                  <button onClick={() => removeUrl(i)} className="text-slate-600 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {urls.length > 20 && (
                <p className="text-slate-600 text-xs text-center py-1">
                  + {urls.length - 20} more
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-white/5">
          <button
            onClick={handleScan}
            disabled={scanning || urlList.length === 0}
            className="btn-primary"
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning…
              </span>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Scan ({urlList.length} URLs)
              </>
            )}
          </button>
          {jobStatus?.status === 'completed' && (
            <button
              onClick={() => exportAPI.download('csv')}
              className="btn-secondary text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <AnimatePresence>
        {jobId && jobStatus && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Scan Progress</h3>
              <span className={clsx(
                'text-xs font-medium px-2.5 py-1 rounded-full',
                jobStatus.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                jobStatus.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                'bg-brand-500/15 text-brand-400',
              )}>
                {jobStatus.status}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>{jobStatus.scanned_domains} / {jobStatus.total_domains} scanned</span>
                <span>{jobStatus.progress_pct}%</span>
              </div>
              <div className="progress-bar h-3">
                <motion.div
                  className="progress-fill bg-brand-500"
                  animate={{ width: `${jobStatus.progress_pct}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {jobStatus.phishing_found > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-red-400 font-semibold">{jobStatus.phishing_found} phishing domains detected</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
