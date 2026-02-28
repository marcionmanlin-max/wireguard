import { useState, useEffect } from 'react'
// ─── BlockToggle Component ──────────────────────────────
function BlockToggle({ domain, blocked }) {
  const [isBlocked, setIsBlocked] = useState(blocked)
  const [loading, setLoading] = useState(false)

  const toggleBlock = async () => {
    setLoading(true)
    try {
      const action = isBlocked ? 'unblock' : 'block'
      await api.addDomain(action === 'block' ? 'blacklist' : 'whitelist', { domain })
      setIsBlocked(!isBlocked)
    } catch (e) {
      alert('Failed to toggle block')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className={`ml-2 px-2 py-1 rounded text-xs font-bold ${isBlocked ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
      onClick={toggleBlock}
      disabled={loading}
      title={isBlocked ? 'Unblock domain' : 'Block domain'}
    >
      {loading ? '...' : isBlocked ? 'Unblock' : 'Block'}
    </button>
  )
}
import { api } from '../utils/api'
import { formatNumber } from '../utils/helpers'
import { 
  ScrollText, Search, RefreshCw, Ban, CheckCircle, Filter, X,
  TrendingUp, Globe, Users, BarChart3, ChevronDown,
  Monitor, Server, Wifi
} from 'lucide-react'

export default function QueryLog() {
  const [logs, setLogs] = useState({ logs: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ action: '', domain: '', client: '' })
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [error, setError] = useState(null)
  const [clientNames, setClientNames] = useState({})
  const [topStats, setTopStats] = useState(null)
  const [showTopStats, setShowTopStats] = useState(true)

  const fetchLogs = async (page = 1) => {
    try {
      const params = { page, limit: 100 }
      if (filter.action) params.action = filter.action
      if (filter.domain) params.domain = filter.domain
      if (filter.client) params.client = filter.client
      const data = await api.getQueryLog(params)
      setLogs(data)
      if (data.client_names) setClientNames(data.client_names)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchTopStats = async () => {
    try {
      const data = await api.getStats()
      setTopStats(data)
      if (data.client_names) setClientNames(prev => ({ ...prev, ...data.client_names }))
    } catch (e) { /* ignore */ }
  }

  useEffect(() => {
    fetchLogs()
    fetchTopStats()
    let interval
    if (autoRefresh) {
      interval = setInterval(() => fetchLogs(logs.page), 5000)
    }
    return () => clearInterval(interval)
  }, [autoRefresh, filter])

  const addToWhitelist = async (domain) => {
    try {
      await api.addDomain('whitelist', { domain })
      fetchLogs(logs.page)
    } catch (err) {
      setError(err.message)
    }
  }

  const addToBlacklist = async (domain) => {
    try {
      await api.addDomain('blacklist', { domain })
      fetchLogs(logs.page)
    } catch (err) {
      setError(err.message)
    }
  }

  const getClientType = (ip) => {
    if (ip === '127.0.0.1' || ip === '::1') return 'server'
    if (ip.startsWith('10.0.0.')) return 'wireguard'
    if (/^192\.168\.\d+\.(1|2)$/.test(ip)) return 'router'
    return 'lan'
  }

  const ClientIcon = ({ ip }) => {
    const type = getClientType(ip)
    if (type === 'wireguard') return <Globe className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" title="WireGuard VPN" />
    if (type === 'server') return <Server className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" title="Server" />
    if (type === 'router') return <Wifi className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" title="Router/Gateway" />
    return <Monitor className="w-3.5 h-3.5 text-green-400 flex-shrink-0" title="LAN" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Query Log</h2>
          <p className="text-dark-400 text-sm mt-1">{logs.total.toLocaleString()} total queries</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTopStats(!showTopStats)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              showTopStats
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/30'
                : 'bg-dark-800 text-dark-400 border border-dark-600'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Stats</span>
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              autoRefresh 
                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/30' 
                : 'bg-dark-800 text-dark-400 border border-dark-600'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
        </div>
      </div>

      {/* Top Stats */}
      {topStats && showTopStats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top Queried Domains */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-400" /> Top Queried
            </h4>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {(topStats.top_allowed || []).slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-dark-800/30 text-xs">
                  <span className="text-dark-200 font-mono truncate flex-1 mr-2">{item.domain}</span>
                  <span className="text-primary-400 font-mono flex-shrink-0">{formatNumber(parseInt(item.count))}</span>
                  <BlockToggle domain={item.domain} blocked={false} />
                </div>
              ))}
            </div>
          </div>

          {/* Top Blocked */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Ban className="w-4 h-4 text-danger-400" /> Top Blocked
            </h4>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {(topStats.top_blocked || []).slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-danger-400/5 text-xs">
                  <span className="text-dark-200 font-mono truncate flex-1 mr-2">{item.domain}</span>
                  <span className="text-danger-400 font-mono flex-shrink-0">{formatNumber(parseInt(item.count))}</span>
                  <BlockToggle domain={item.domain} blocked={true} />
                </div>
              ))}
            </div>
          </div>

          {/* Top Clients */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
            <h4 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-400" /> Top Clients
            </h4>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {(topStats.top_clients || []).slice(0, 8).map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 rounded bg-dark-800/30 text-xs cursor-pointer hover:bg-dark-800/60"
                  onClick={() => setFilter(prev => ({ ...prev, client: item.client_ip }))}>
                  <span className="text-dark-200 flex-1 mr-2">{clientNames[item.client_ip] || item.client_ip}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-primary-400 font-mono">{formatNumber(parseInt(item.total))}</span>
                    <span className="text-danger-400 font-mono text-[10px]">{formatNumber(parseInt(item.blocked))} blk</span>
                  </div>
                  {/* BlockToggle for client (if needed, e.g. block all queries from client) */}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 flex items-center gap-3 text-sm">
          <span className="text-danger-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-dark-400" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-dark-400" />
          <span className="text-sm text-dark-300">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filter.action}
            onChange={e => setFilter(prev => ({ ...prev, action: e.target.value }))}
            className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="">All Actions</option>
            <option value="allowed">Allowed</option>
            <option value="blocked">Blocked</option>
          </select>
          <input
            type="text"
            value={filter.domain}
            onChange={e => setFilter(prev => ({ ...prev, domain: e.target.value }))}
            placeholder="Filter domain..."
            className="flex-1 min-w-[150px] px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
          />
          <select
            value={filter.client}
            onChange={e => setFilter(prev => ({ ...prev, client: e.target.value }))}
            className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 min-w-[140px]"
          >
            <option value="">All Clients</option>
            {Object.entries(clientNames).map(([ip, name]) => (
              <option key={ip} value={ip}>{name} ({ip})</option>
            ))}
          </select>
          <button
            onClick={() => setFilter({ action: '', domain: '', client: '' })}
            className="px-3 py-2 text-dark-400 hover:text-white text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-dark-900 z-10">
                  <tr className="border-b border-dark-700">
                    <th className="text-left p-3 text-xs font-medium text-dark-400 uppercase">Time</th>
                    <th className="text-left p-3 text-xs font-medium text-dark-400 uppercase">Status</th>
                    <th className="text-left p-3 text-xs font-medium text-dark-400 uppercase">Domain</th>
                    <th className="text-left p-3 text-xs font-medium text-dark-400 uppercase hidden sm:table-cell">Type</th>
                    <th className="text-left p-3 text-xs font-medium text-dark-400 uppercase">Client</th>
                    <th className="text-right p-3 text-xs font-medium text-dark-400 uppercase hidden sm:table-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.logs.map((log, i) => (
                    <tr key={log.id || i} className="border-b border-dark-800 hover:bg-dark-800/50 text-sm">
                      <td className="p-3 text-dark-400 text-xs whitespace-nowrap">
                        {new Date(log.logged_at).toLocaleTimeString()}
                      </td>
                      <td className="p-3">
                        {log.action === 'blocked' ? (
                          <span className="flex items-center gap-1 text-danger-400 text-xs">
                            <Ban className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Blocked</span><span className="sm:hidden">BLK</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-primary-400 text-xs">
                            <CheckCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Allowed</span><span className="sm:hidden">OK</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-white font-mono text-xs truncate max-w-[120px] sm:max-w-xs">{log.domain}</td>
                      <td className="p-3 text-dark-400 text-xs hidden sm:table-cell">{log.query_type}</td>
                      <td className="p-3 text-dark-400 text-xs truncate max-w-[80px] sm:max-w-none">
                        <div className="flex items-center gap-1.5">
                          <ClientIcon ip={log.client_ip} />
                          <span className="truncate">{clientNames[log.client_ip] || log.client_ip}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <BlockToggle domain={log.domain} blocked={log.action === 'blocked'} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logs.pages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-dark-700 gap-3">
                <span className="text-sm text-dark-400">Page {logs.page} of {logs.pages} ({logs.total.toLocaleString()} results)</span>
                <div className="flex gap-1 flex-wrap justify-center">
                  <button
                    onClick={() => fetchLogs(1)}
                    disabled={logs.page <= 1}
                    className="px-2 py-1 rounded text-xs text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
                  >
                    First
                  </button>
                  <button
                    onClick={() => fetchLogs(Math.max(1, logs.page - 1))}
                    disabled={logs.page <= 1}
                    className="px-3 py-1 rounded text-sm text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
                  >
                    Prev
                  </button>
                  {(() => {
                    const pages = []
                    const start = Math.max(1, logs.page - 2)
                    const end = Math.min(logs.pages, logs.page + 2)
                    for (let i = start; i <= end; i++) {
                      pages.push(
                        <button key={i} onClick={() => fetchLogs(i)}
                          className={`px-3 py-1 rounded text-sm ${logs.page === i ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white hover:bg-dark-700'}`}>
                          {i}
                        </button>
                      )
                    }
                    return pages
                  })()}
                  <button
                    onClick={() => fetchLogs(Math.min(logs.pages, logs.page + 1))}
                    disabled={logs.page >= logs.pages}
                    className="px-3 py-1 rounded text-sm text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => fetchLogs(logs.pages)}
                    disabled={logs.page >= logs.pages}
                    className="px-2 py-1 rounded text-xs text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
