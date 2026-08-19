import axios from 'axios'

// ── Anonymous browser identity ─────────────────────────────────────────────
// No login needed — each browser gets a persistent random ID stored in
// localStorage. All scans are tagged with this ID so users only see their own.
function getClientId() {
  let id = localStorage.getItem('pv_client_id')
  if (!id) {
    id = 'pv_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('pv_client_id', id)
  }
  return id
}

export const CLIENT_ID = getClientId()

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach client ID to every request
api.interceptors.request.use((config) => {
  config.headers['X-Client-ID'] = CLIENT_ID
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(message))
  }
)

export const scanAPI = {
  single: (url, enableScreenshot = true) =>
    api.post('/scan', { url, enable_screenshot: enableScreenshot }),
  bulk: (urls, enableScreenshot = false) =>
    api.post('/scan/bulk', { urls, enable_screenshot: enableScreenshot }),
  getJob: (jobId) => api.get(`/scan/job/${jobId}`),
  autoScan: () => api.post('/scan/auto'),
}

export const resultsAPI = {
  // Always filter by this browser's client ID
  list: (params = {}) =>
    api.get('/results', { params: { ...params, client_id: CLIENT_ID } }),
  get: (id) => api.get(`/results/${id}`),
  delete: (id) => api.delete(`/results/${id}`),
}

export const statsAPI = {
  overview: () => api.get('/stats'),
  timeline: (days = 7) => api.get('/stats/timeline', { params: { days } }),
}

export const targetsAPI = {
  list: () => api.get('/targets'),
  create: (data) => api.post('/targets', data),
  delete: (id) => api.delete(`/targets/${id}`),
}

export const exportAPI = {
  download: (format, params = {}) => {
    const searchParams = new URLSearchParams({
      format,
      client_id: CLIENT_ID,
      ...params,
    })
    window.open(`/api/export?${searchParams}`, '_blank')
  },
  downloadSingleReport: (resultId, domain) => {
    const safe = (domain || resultId).toString().replace(/\./g, '_')
    const a = document.createElement('a')
    a.href = `/api/results/${resultId}/report`
    a.download = `phishvision_${safe}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  },
}

export const healthAPI = {
  check: () => api.get('/health'),
}

export default api
