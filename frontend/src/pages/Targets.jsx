import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Shield, Globe, Tag, X } from 'lucide-react'
import { targetsAPI } from '../api/client'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const CATEGORY_COLORS = {
  Technology: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Finance: 'bg-green-500/10 text-green-400 border-green-500/20',
  Banking: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'E-Commerce': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Social Media': 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Entertainment: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Crypto: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Gaming: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Logistics: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
}

export default function Targets() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', domain: '', category: '', login_url: '', keywords: '',
  })

  const { data: brands = [], isLoading } = useQuery('targets', targetsAPI.list)

  const createMutation = useMutation(targetsAPI.create, {
    onSuccess: () => {
      toast.success('Brand target added')
      qc.invalidateQueries('targets')
      setShowForm(false)
      setForm({ name: '', domain: '', category: '', login_url: '', keywords: '' })
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation(targetsAPI.delete, {
    onSuccess: () => {
      toast.success('Brand removed')
      qc.invalidateQueries('targets')
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.domain) { toast.error('Name and domain are required'); return }
    createMutation.mutate({
      ...form,
      keywords: form.keywords ? form.keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
    })
  }

  const grouped = brands.reduce((acc, b) => {
    const cat = b.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(b)
    return acc
  }, {})

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Target <span className="text-gradient">Brands</span>
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {brands.length} brands monitored for impersonation
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Add Brand'}
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="card p-6">
              <h3 className="text-white font-semibold mb-4">Add New Brand Target</h3>
              <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 text-xs">Brand Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="PayPal"
                    className="input py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-xs">Domain *</label>
                  <input
                    value={form.domain}
                    onChange={e => setForm(f => ({ ...f, domain: e.target.value }))}
                    placeholder="paypal.com"
                    className="input py-2 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-xs">Category</label>
                  <input
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Finance"
                    className="input py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-xs">Login URL</label>
                  <input
                    value={form.login_url}
                    onChange={e => setForm(f => ({ ...f, login_url: e.target.value }))}
                    placeholder="https://www.paypal.com/signin"
                    className="input py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-slate-400 text-xs">Keywords (comma separated)</label>
                  <input
                    value={form.keywords}
                    onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                    placeholder="paypal, paypall, pay-pal"
                    className="input py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={createMutation.isLoading} className="btn-primary">
                    {createMutation.isLoading ? 'Adding…' : 'Add Brand'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brands by category */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 h-28 animate-pulse bg-white/3" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort().map(([category, items]) => (
            <div key={category}>
              <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">
                {category} ({items.length})
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((brand) => (
                  <motion.div
                    key={brand.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="card-hover p-4"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10
                                        flex items-center justify-center flex-shrink-0">
                          <Shield className="w-4 h-4 text-brand-400" />
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm">{brand.name}</div>
                          <a
                            href={`https://${brand.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 text-xs hover:text-brand-400 flex items-center gap-0.5"
                          >
                            <Globe className="w-2.5 h-2.5" />
                            {brand.domain}
                          </a>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${brand.name}?`)) deleteMutation.mutate(brand.id)
                        }}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {brand.category && (
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border mb-2',
                        CATEGORY_COLORS[brand.category] || 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                      )}>
                        <Tag className="w-2.5 h-2.5" />
                        {brand.category}
                      </span>
                    )}

                    {brand.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {brand.keywords.slice(0, 4).map(kw => (
                          <span key={kw} className="text-slate-600 text-xs bg-white/5 px-1.5 py-0.5 rounded font-mono">
                            {kw}
                          </span>
                        ))}
                        {brand.keywords.length > 4 && (
                          <span className="text-slate-600 text-xs">+{brand.keywords.length - 4}</span>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
