import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Scanner from './pages/Scanner'
import Results from './pages/Results'
import ResultDetail from './pages/ResultDetail'
import Targets from './pages/Targets'
import BulkScan from './pages/BulkScan'

export default function App() {
  return (
    <Routes>
      {/* Landing page — full width, no sidebar */}
      <Route path="/home" element={<Home />} />

      {/* App shell with sidebar */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="scanner" element={<Scanner />} />
        <Route path="bulk" element={<BulkScan />} />
        <Route path="results" element={<Results />} />
        <Route path="results/:id" element={<ResultDetail />} />
        <Route path="targets" element={<Targets />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}
