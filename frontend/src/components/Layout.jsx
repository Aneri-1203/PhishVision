import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Search, List, Shield, Upload,
  Menu, X, Home,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import Logo from './Logo'

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/scanner',   icon: Search,          label: 'Live Scanner' },
  { path: '/bulk',      icon: Upload,          label: 'Bulk Scan' },
  { path: '/results',   icon: List,            label: 'Results' },
  { path: '/targets',   icon: Shield,          label: 'Target Brands' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 bg-dark-800 border-r border-white/5 flex flex-col',
        'transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
          <Logo size={36} />
          <div>
            <div className="text-white font-bold text-lg leading-none tracking-tight">
              PhishVision
            </div>
            <div className="text-brand-400 text-xs font-medium mt-0.5">AI Detection Platform</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-4 mb-2">
            Navigation
          </div>
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/5 space-y-2">
          <Link
            to="/home"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500
                       hover:text-slate-300 hover:bg-white/5 transition-all text-xs font-medium"
          >
            <Home className="w-3.5 h-3.5" />
            Back to Home
          </Link>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10
                          border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">System Online</span>
          </div>
          <div className="text-slate-600 text-xs text-center">
            PhishVision AI v1.0.0
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="bg-dark-800/80 backdrop-blur-sm border-b border-white/5 px-4 sm:px-6 py-4
                           flex items-center gap-4 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <h1 className="text-white font-semibold text-base">
              {NAV_ITEMS.find(n => location.pathname.startsWith(n.path))?.label || 'PhishVision'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                            bg-white/5 border border-white/10 text-xs text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
              Auto-scan active
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
