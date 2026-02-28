import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Radio, RefreshCw, Trash2, Play, Square, RotateCcw,
  Database, Zap, Clock, CheckCircle, XCircle, Search, Activity,
  ChevronDown, ChevronUp, Server, Settings2, Eye, Loader2, X,
  TrendingUp, Wifi
} from 'lucide-react'

// ─── BlockToggle Component ──────────────────────────────
function BlockToggle({ domain, blocked }) {
  const [isBlocked, setIsBlocked] = useState(blocked)
  const [loading, setLoading] = useState(false)

  const toggleBlock = async () => {
    setLoading(true)
    try {
      const action = isBlocked ? 'unblock' : 'block'
      await fetch(`/makodns/api/blocklists.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, action })
      })
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
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadialBarChart,
  RadialBar, Legend
} from 'recharts'

const API = '/dns/api/resolver'

// ─── Animated Counter ─────────────────────────────────────
function useCountUp(target, duration = 600) {
  const [val, setVal] = useState(target)
  const prev = useRef(target)
  useEffect(() => {
    if (target == null) return
    const start = prev.current ?? 0
    const diff = target - start
    if (diff === 0) return
    const steps = 20
    const stepMs = duration / steps
    let s = 0
    const id = setInterval(() => {
      s++
      setVal(Math.round(start + (diff * s) / steps))
      if (s >= steps) { clearInterval(id); prev.current = target }
    }, stepMs)
    return () => clearInterval(id)
  }, [target, duration])
  return val
}

// ─── Radial Cache Gauge ───────────────────────────────────
function CacheGauge({ filled, maxsize, hitRate }) {
  const pct = maxsize > 0 ? Math.min(100, Math.round((filled / maxsize) * 100)) : 0
  const data = [{ name: 'Filled', value: pct, fill: '#00d4ff' }]
  return (
    <div className="relative flex flex-col items-center justify-center">
      <RadialBarChart
        width={110} height={110}
        cx={55} cy={55}
        innerRadius={32} outerRadius={50}
        startAngle={210} endAngle={-30}
        data={data}
        barSize={10}
      >
        <RadialBar
          background={{ fill: '#1e293b' }}
          dataKey="value"
          cornerRadius={6}
          max={100}
        />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-lg font-bold text-white leading-none">{pct}%</span>
        <span className="text-[9px] text-dark-500 mt-0.5">filled</span>
      </div>
      {hitRate != null && (
        <span className="text-[10px] text-primary-400 mt-1">{hitRate}% hit rate</span>
      )}
    </div>
  )
}

// ─── Mini Sparkline ───────────────────────────────────────
function Sparkline({ data, dataKey, color = '#00d4ff', label }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[10px] text-dark-500">{label}</span>}
      <ResponsiveContainer width="100%" height={48}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
            fill={`url(#sg-${dataKey})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Query Mix Donut ──────────────────────────────────────
function QueryMixDonut({ cached, forwarded, errors, nxdomain }) {
  const total = (cached || 0) + (forwarded || 0) + (errors || 0) + (nxdomain || 0)
  if (total === 0) return (
    <div className="flex items-center justify-center h-32 text-dark-600 text-xs">No data yet</div>
  )

  const data = [
    { name: 'Cached',    value: cached    || 0, color: '#4ade80' },
    { name: 'Forwarded', value: forwarded || 0, color: '#60a5fa' },
    { name: 'NXDOMAIN',  value: nxdomain  || 0, color: '#facc15' },
    { name: 'Errors',    value: errors    || 0, color: '#f87171' },
  ].filter(d => d.value > 0)

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-xs shadow-lg">
        <span style={{ color: d.color }}>{d.name}</span>
        <span className="text-white ml-2 font-bold">{d.value.toLocaleString()}</span>
        <span className="text-dark-500 ml-1">({Math.round((d.value / total) * 100)}%)</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <PieChart width={100} height={100}>
        <Pie data={data} cx={45} cy={45} innerRadius={28} outerRadius={44}
          dataKey="value" paddingAngle={2} isAnimationActive>
          {data.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
      <div className="space-y-1.5">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-dark-400 w-20">{d.name}</span>
            <span className="font-bold tabular-nums" style={{ color: d.color }}>
              {d.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function fetcher(action, opts = {}) {
  const token = localStorage.getItem('ionman_token')
  const url = `${API}?action=${action}`
  return fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
    ...opts,
  }).then(r => r.json())
}

// ─── Shared Paginator ─────────────────────────────────────
function Paginator({ page, total, pageSize, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null
  const from = page * pageSize + 1
  const to   = Math.min(total, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between pt-2 border-t border-dark-800">
      <span className="text-[10px] text-dark-500">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="px-2 py-1 text-xs rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >‹ Prev</button>
        <span className="text-[10px] text-dark-500 px-1">{page + 1}/{totalPages}</span>
        <button
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          className="px-2 py-1 text-xs rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >Next ›</button>
      </div>
    </div>
  )
}

// ─── Hits Modal ───────────────────────────────────────────
const MODAL_PAGE_SIZE = 15

function HitsModal({ title, filter, color, onClose }) {
  const [rows, setRows]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(0)
  const overlayRef            = useRef(null)

  useEffect(() => {
    setLoading(true)
    setPage(0)
    fetcher(`log_grouped&filter=${filter}&limit=200`)
      .then(d => setRows(d.rows || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [filter])

  const maxHits  = rows?.[0]?.hits ?? 1
  const pageRows = rows ? rows.slice(page * MODAL_PAGE_SIZE, (page + 1) * MODAL_PAGE_SIZE) : []

  const barColor = color.includes('green') ? '#4ade80'
    : color.includes('blue')   ? '#60a5fa'
    : color.includes('purple') ? '#c084fc'
    : color.includes('yellow') ? '#facc15'
    : '#00d4ff'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => e.target === overlayRef.current && onClose()}
    >
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-lg flex flex-col shadow-2xl" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700 flex-shrink-0">
          <h3 className={`font-semibold text-sm ${color}`}>{title}</h3>
          <button onClick={onClose} className="text-dark-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-dark-400" />
            </div>
          ) : !rows || rows.length === 0 ? (
            <p className="text-dark-400 text-sm text-center py-12">No data yet — queries appear here once the resolver starts logging.</p>
          ) : (
            <div className="space-y-2.5">
              {pageRows.map((row, i) => {
                const rank = page * MODAL_PAGE_SIZE + i + 1
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between gap-3 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-dark-600 text-[10px] w-5 text-right flex-shrink-0">{rank}</span>
                        <span className="text-white text-xs font-mono truncate">{row.qname}</span>
                        <span className="text-dark-600 text-[10px] flex-shrink-0 bg-dark-800 px-1 rounded">{row.qtype}</span>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 tabular-nums ${color}`}>
                        {Number(row.hits).toLocaleString()}
                      </span>
                    </div>
                    {/* Bar */}
                    <div className="ml-7 h-1 rounded-full bg-dark-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round((row.hits / maxHits) * 100)}%`, backgroundColor: barColor }}
                      />
                    </div>
                    <div className="ml-7 mt-0.5 flex gap-3 text-[10px] text-dark-500">
                      {row.cache_hits > 0 && <span>{Number(row.cache_hits).toLocaleString()} cached</span>}
                      {row.avg_ms > 0 && <span>avg {row.avg_ms}ms</span>}
                      {row.last_seen && <span>{row.last_seen.slice(11, 19)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer + Pagination */}
        <div className="px-5 pb-4 pt-2 border-t border-dark-800 flex-shrink-0 space-y-2">
          <Paginator page={page} total={rows?.length ?? 0} pageSize={MODAL_PAGE_SIZE} onChange={setPage} />
          <p className="text-[10px] text-dark-600">{rows ? `${rows.length} unique domain${rows.length !== 1 ? 's' : ''}` : ''}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color = 'text-primary-400', bg = 'bg-dark-900', onClick, animate }) {
  const clickable = !!onClick
  // Extract numeric part for animation
  const numeric = typeof value === 'string' ? parseInt(value.replace(/[^0-9]/g, ''), 10) : value
  const suffix  = typeof value === 'string' ? value.replace(/[0-9,]/g, '').trim() : ''
  const counted = useCountUp(isNaN(numeric) ? null : numeric)
  const display = animate && !isNaN(numeric) && numeric != null
    ? (counted?.toLocaleString() ?? '—') + (suffix ? ` ${suffix}` : '')
    : (value ?? '—')

  const glowColor = color.includes('green')  ? 'rgba(74,222,128,0.15)'
    : color.includes('blue')   ? 'rgba(96,165,250,0.15)'
    : color.includes('yellow') ? 'rgba(250,204,21,0.15)'
    : color.includes('purple') ? 'rgba(192,132,252,0.15)'
    : color.includes('red')    ? 'rgba(248,113,113,0.15)'
    : 'rgba(0,212,255,0.15)'

  return (
    <div
      onClick={onClick}
      className={`${bg} border border-dark-700 rounded-xl p-5 transition-all ${
        clickable
          ? 'cursor-pointer hover:scale-[1.02] hover:border-dark-500 group'
          : ''
      }`}
      style={clickable ? { transition: 'box-shadow .2s,transform .2s,border-color .2s' } : {}}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.boxShadow = `0 0 18px ${glowColor}` }}
      onMouseLeave={e => { if (clickable) e.currentTarget.style.boxShadow = 'none' }}
    >
      <div className="flex items-center justify-between mb-3">
        {Icon && <Icon className={`w-5 h-5 ${color}`} />}
        {clickable && <span className="text-[10px] text-dark-600 group-hover:text-dark-400 transition-colors">tap to view</span>}
      </div>
      <p className="text-2xl font-bold text-white leading-tight tabular-nums">{display}</p>
      <p className={`text-xs ${color} mt-0.5 font-medium`}>{label}</p>
      {sub && <p className="text-[11px] text-dark-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────
function StatusBadge({ running, service }) {
  const active = running || service === 'active'
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
      active
        ? 'bg-primary-400/10 text-primary-400 border border-primary-400/30'
        : 'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>
      <span className={`w-2 h-2 rounded-full ${ active ? 'bg-primary-400 animate-pulse' : 'bg-red-400'}`} />
      {active ? 'Running' : 'Stopped'}
    </span>
  )
}

// ─── DNS Lookup Tool ──────────────────────────────────────
function LookupTool() {
  const [domain, setDomain] = useState('')
  const [type, setType]     = useState('A')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    if (!domain.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const data = await fetcher(`lookup&domain=${encodeURIComponent(domain.trim())}&type=${type}`)
      setResult(data)
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 space-y-3">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <Search className="w-4 h-4 text-primary-400" />
        DNS Lookup
        <span className="text-dark-500 text-xs font-normal">via IonMan Resolver</span>
      </h3>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-400/50"
          placeholder="example.com"
          value={domain}
          onChange={e => setDomain(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 sm:flex-none bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm text-white"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'PTR'].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={lookup}
            disabled={loading}
            className="flex-1 sm:flex-none px-4 py-2 bg-primary-400/10 hover:bg-primary-400/20 text-primary-400 border border-primary-400/20 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Lookup'}
          </button>
        </div>
      </div>
      {result && (
        <div className="bg-dark-950 border border-dark-700 rounded-lg p-3 font-mono text-xs text-dark-200 whitespace-pre-wrap">
          {result.error
            ? <span className="text-red-400">{result.error}</span>
            : (
              <>
                <span className="text-primary-400">{result.domain}</span>
                <span className="text-dark-400"> {result.type} @{result.server}{'\n'}</span>
                <span className="text-green-400">{result.result || '(empty response)'}</span>
              </>
            )
          }
        </div>
      )}
    </div>
  )
}

// ─── Config Editor ────────────────────────────────────────
function ConfigEditor({ onReload }) {
  const [config, setConfig] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetcher('config').then(d => d.config && setConfig(d.config)).catch(() => {})
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetcher('config', {
        method: 'POST',
        body: JSON.stringify(config),
      })
      setMsg(res.message || 'Saved')
      onReload()
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const updateUpstream = (idx, field, value) => {
    setConfig(prev => {
      const ups = [...prev.upstreams]
      ups[idx] = { ...ups[idx], [field]: value }
      return { ...prev, upstreams: ups }
    })
  }

  const addUpstream = () => {
    setConfig(prev => ({
      ...prev,
      upstreams: [...prev.upstreams, { host: '', port: 53, dot: false, name: 'Custom' }],
    }))
  }

  const removeUpstream = idx => {
    setConfig(prev => ({ ...prev, upstreams: prev.upstreams.filter((_, i) => i !== idx) }))
  }

  if (!config) {
    return <div className="text-dark-400 text-sm p-4">Loading config…</div>
  }

  return (
    <div className="p-5 space-y-4">
      {/* Upstream servers */}
      <div>
        <p className="text-xs text-dark-400 mb-2">Upstream DNS Servers</p>
        <div className="space-y-2">
          {config.upstreams.map((u, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                className="flex-1 bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white"
                placeholder="IP / hostname"
                value={u.host}
                onChange={e => updateUpstream(idx, 'host', e.target.value)}
              />
              <input
                className="w-16 bg-dark-800 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white text-center"
                placeholder="53"
                type="number"
                value={u.port}
                onChange={e => updateUpstream(idx, 'port', parseInt(e.target.value))}
              />
              <input
                className="w-24 bg-dark-800 border border-dark-700 rounded-lg px-2 py-1.5 text-xs text-white"
                placeholder="Label"
                value={u.name}
                onChange={e => updateUpstream(idx, 'name', e.target.value)}
              />
              <label className="flex items-center gap-1 text-xs text-dark-400 whitespace-nowrap">
                <input type="checkbox" checked={u.dot} onChange={e => updateUpstream(idx, 'dot', e.target.checked)} className="accent-primary-400" />
                DoT
              </label>
              <button onClick={() => removeUpstream(idx)} className="text-red-400 hover:text-red-300 p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addUpstream} className="mt-2 text-xs text-primary-400 hover:text-primary-300">
          + Add upstream
        </button>
      </div>

      {/* Cache settings */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-dark-400 mb-1">Cache Size (entries)</p>
          <input type="number" className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white"
            value={config.cache_size} onChange={e => setConfig(p => ({ ...p, cache_size: parseInt(e.target.value) }))} />
        </div>
        <div>
          <p className="text-xs text-dark-400 mb-1">Min TTL (s)</p>
          <input type="number" className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white"
            value={config.cache_min_ttl} onChange={e => setConfig(p => ({ ...p, cache_min_ttl: parseInt(e.target.value) }))} />
        </div>
        <div>
          <p className="text-xs text-dark-400 mb-1">Max TTL (s)</p>
          <input type="number" className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white"
            value={config.cache_max_ttl} onChange={e => setConfig(p => ({ ...p, cache_max_ttl: parseInt(e.target.value) }))} />
        </div>
        <div>
          <p className="text-xs text-dark-400 mb-1">Timeout (s)</p>
          <input type="number" step="0.5" className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-white"
            value={config.timeout} onChange={e => setConfig(p => ({ ...p, timeout: parseFloat(e.target.value) }))} />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <label className="flex items-center gap-2 text-xs text-dark-400">
            <input type="checkbox" checked={config.log_queries} onChange={e => setConfig(p => ({ ...p, log_queries: e.target.checked }))} className="accent-primary-400" />
            Log Queries
          </label>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <label className="flex items-center gap-2 text-xs text-dark-400">
            <input type="checkbox" checked={config.dot_enabled} onChange={e => setConfig(p => ({ ...p, dot_enabled: e.target.checked }))} className="accent-primary-400" />
            Enable DoT globally
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 bg-primary-400/10 hover:bg-primary-400/20 text-primary-400 border border-primary-400/20 rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save & Restart
        </button>
        {msg && <span className="text-xs text-dark-400">{msg}</span>}
      </div>
    </div>
  )
}

// ─── Query Log (Grouped) ──────────────────────────────────
const LOG_PAGE_SIZE = 20

function ResolverLog() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('all')
  const [page, setPage]       = useState(0)

  const load = useCallback(() => {
    setLoading(true)
    setPage(0)
    fetcher(`log_grouped&filter=${filter}&limit=500`)
      .then(d => setRows(d.rows || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { load() }, [load])

  const maxHits    = rows[0]?.hits ?? 1
  const pageRows   = rows.slice(page * LOG_PAGE_SIZE, (page + 1) * LOG_PAGE_SIZE)

  const filterBadge = f => f === filter
    ? 'bg-primary-400/10 text-primary-400 border-primary-400/20'
    : 'bg-dark-800 text-dark-400 border-dark-700 hover:text-dark-200'

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary-400" />
          Query Log
          <span className="text-dark-500 text-xs font-normal">grouped by domain</span>
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'all',       label: 'All' },
            { key: 'forwarded', label: 'Forwarded' },
            { key: 'cached',    label: 'Cached' },
            { key: 'nxdomain',  label: 'NXDOMAIN' },
            { key: 'error',     label: 'Errors' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${filterBadge(f.key)}`}>
              {f.label}
            </button>
          ))}
          <button onClick={load} className="p-1.5 text-dark-400 hover:text-primary-400 transition-colors ml-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-dark-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-dark-400 text-center py-8">No queries logged yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-dark-500 border-b border-dark-700">
                  <th className="text-right py-2 pr-3 w-8">#</th>
                  <th className="text-left py-2 pr-3">Domain</th>
                  <th className="text-left py-2 pr-2 w-10">Type</th>
                  <th className="text-right py-2 pr-3 w-16">Hits</th>
                  <th className="text-right py-2 pr-3 w-16">Cached</th>
                  <th className="text-right py-2 pr-3 w-16">Avg ms</th>
                  <th className="text-right py-2 w-16">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => {
                  const rank = page * LOG_PAGE_SIZE + i + 1
                  const barW = Math.round((row.hits / maxHits) * 100)
                  return (
                    <tr key={i} className="border-b border-dark-800/60 hover:bg-dark-800/30 group">
                      <td className="py-1.5 pr-3 text-dark-600 text-right tabular-nums">{rank}</td>
                      <td className="py-1.5 pr-3 max-w-[200px]">
                        <div className="font-mono text-white truncate">{row.qname}</div>
                        {/* mini bar */}
                        <div className="mt-0.5 h-0.5 rounded-full bg-dark-800 overflow-hidden w-full">
                          <div className="h-full rounded-full bg-primary-400/50" style={{ width: `${barW}%` }} />
                          <BlockToggle domain={row.qname} blocked={row.blocked} />
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 text-dark-500">{row.qtype}</td>
                      <td className="py-1.5 pr-3 text-right font-bold text-primary-400 tabular-nums">
                        {Number(row.hits).toLocaleString()}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-green-400 tabular-nums">
                        {row.cache_hits > 0 ? Number(row.cache_hits).toLocaleString() : <span className="text-dark-700">—</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-dark-400 tabular-nums">
                        {row.avg_ms > 0 ? row.avg_ms : <span className="text-dark-700">—</span>}
                      </td>
                      <td className="py-1.5 text-right text-dark-500 whitespace-nowrap">
                        {row.last_seen?.slice(11, 19) ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Paginator page={page} total={rows.length} pageSize={LOG_PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────
const HISTORY_LEN = 30  // keep 30 data points (5s * 30 = 2.5 min window)

export default function Resolver() {
  const [status, setStatus]         = useState(null)
  const [loading, setLoading]        = useState(true)
  const [actionLoading, setAL]       = useState(false)
  const [showConfig, setShowConfig]  = useState(false)
  const [showLog, setShowLog]        = useState(false)
  const [msg, setMsg]                = useState('')
  const [modal, setModal]            = useState(null)
  const [history, setHistory]        = useState([])  // rolling sparkline data

  const load = useCallback(() => {
    setLoading(true)
    fetcher('status')
      .then(d => {
        setStatus(d)
        if (d) {
          const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
          setHistory(prev => {
            const next = [...prev, {
              t: now,
              total:     d.total_queries     || 0,
              cached:    d.cached_queries    || 0,
              forwarded: d.forwarded_queries || 0,
              errors:    d.error_queries     || 0,
            }]
            return next.slice(-HISTORY_LEN)
          })
        }
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  const doAction = async (action) => {
    setAL(true)
    setMsg('')
    try {
      const res = await fetcher(action, { method: action === 'flush' ? 'POST' : undefined })
      setMsg(res.message || `${action} OK`)
      setTimeout(load, 1200)
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setAL(false)
    }
  }

  const running = status?.running && status?.service === 'active'
  const cache   = status?.cache || {}
  const uptime  = status?.uptime_seconds
    ? `${Math.floor(status.uptime_seconds / 3600)}h ${Math.floor((status.uptime_seconds % 3600) / 60)}m`
    : null

  // Derive delta sparkline (queries per 5s interval)
  const deltaHistory = history.map((d, i) => ({
    t: d.t,
    qps: i === 0 ? 0 : Math.max(0, d.total - history[i - 1].total),
    cached: i === 0 ? 0 : Math.max(0, d.cached - history[i - 1].cached),
  }))

  return (
    <div className="space-y-6">
      {modal && (
        <HitsModal
          title={modal.title}
          filter={modal.filter}
          color={modal.color}
          onClose={() => setModal(null)}
        />
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            IonMan Resolver <Radio className="w-5 h-5 text-primary-400" />
          </h2>
          <p className="text-dark-400 text-sm mt-1">Custom DNS recursive resolver — port 5300</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status && <StatusBadge running={status.running} service={status.service} />}
          <button onClick={load} disabled={loading} title="Refresh"
            className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-primary-400 hover:border-primary-400/30 transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {!running ? (
            <button onClick={() => doAction('start')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
              <Play className="w-4 h-4" /> Start
            </button>
          ) : (
            <button onClick={() => doAction('stop')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
              <Square className="w-4 h-4" /> Stop
            </button>
          )}
          <button onClick={() => doAction('restart')} disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-dark-200 border border-dark-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> Restart
          </button>
          <button onClick={() => doAction('flush')} disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 hover:bg-dark-700 text-dark-200 border border-dark-700 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
            <Trash2 className="w-4 h-4" /> Flush Cache
          </button>
        </div>
      </div>

      {msg && (
        <div className="text-sm text-primary-400 bg-primary-400/5 border border-primary-400/20 rounded-lg px-4 py-2.5">
          {msg}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard animate label="Total Queries" value={status?.total_queries}
          icon={Activity} color="text-primary-400"
          onClick={() => setModal({ title: 'All Queries — Top Domains', filter: 'all', color: 'text-primary-400' })} />
        <StatCard animate label="Cache Hits" value={status?.cached_queries}
          icon={Database} color="text-green-400"
          onClick={() => setModal({ title: 'Cache Hits — Top Domains', filter: 'cached', color: 'text-green-400' })} />
        <StatCard animate label="Forwarded" value={status?.forwarded_queries}
          icon={Zap} color="text-blue-400"
          onClick={() => setModal({ title: 'Forwarded — Top Domains', filter: 'forwarded', color: 'text-blue-400' })} />
        <StatCard label="Avg Upstream" value={status?.avg_upstream_ms != null ? `${status.avg_upstream_ms}ms` : null}
          icon={Clock} color="text-yellow-400" />
        <StatCard label="Cache Filled"
          value={cache.size != null ? `${cache.size}/${cache.maxsize}` : null}
          sub={cache.hit_rate != null ? `${cache.hit_rate}% hit rate` : null}
          icon={CheckCircle} color="text-purple-400"
          onClick={() => setModal({ title: 'Cached Domains — Top Hits', filter: 'cached', color: 'text-purple-400' })} />
        <StatCard label="Uptime" value={uptime} icon={Server} color="text-dark-300" />
      </div>

      {/* ── Live Charts Row ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Queries over time */}
        <div className="lg:col-span-2 bg-dark-900 border border-dark-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-400" />
              Queries / 5s — Live
            </h3>
            <span className="flex items-center gap-1.5 text-[10px] text-dark-500">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
              auto-refresh
            </span>
          </div>
          {deltaHistory.length < 2 ? (
            <div className="flex items-center justify-center h-32 text-dark-600 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Collecting data…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={deltaHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCached" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: '#475569' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: '#475569' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Area type="monotone" dataKey="qps"    name="Queries"  stroke="#00d4ff" strokeWidth={2} fill="url(#gTotal)"  dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="cached" name="Cached"   stroke="#4ade80" strokeWidth={2} fill="url(#gCached)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Query Mix Donut + Cache Gauge */}
        <div className="flex flex-col gap-4">

          {/* Query mix */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 flex-1">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-blue-400" />
              Query Mix
            </h3>
            <QueryMixDonut
              cached={status?.cached_queries}
              forwarded={status?.forwarded_queries}
              errors={status?.error_queries}
              nxdomain={status?.nxdomain_queries}
            />
          </div>

          {/* Cache gauge */}
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 flex items-center gap-4">
            <CacheGauge
              filled={cache.size ?? 0}
              maxsize={cache.maxsize ?? 5000}
              hitRate={cache.hit_rate}
            />
            <div className="text-xs text-dark-400 space-y-1">
              <p className="text-white font-semibold text-sm">Cache</p>
              <p>{(cache.size ?? 0).toLocaleString()} / {(cache.maxsize ?? 5000).toLocaleString()} entries</p>
              <p className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-400" /> {cache.hits ?? 0} hits</p>
              <p className="flex items-center gap-1"><XCircle className="w-3 h-3 text-dark-500" /> {cache.misses ?? 0} misses</p>
            </div>
          </div>

        </div>
      </div>

      {/* Info bar */}
      {status && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl px-4 py-3">
          <div className="flex overflow-x-auto gap-6 text-xs" style={{scrollbarWidth:'none'}}>
            <span className="whitespace-nowrap text-dark-400 flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-primary-400" />
              Listen: <span className="text-white font-mono ml-1">{status.listen ?? '127.0.0.1:5300'}</span>
            </span>
            <span className="whitespace-nowrap text-dark-400">
              Errors: <span className="text-red-400 font-mono">{status.error_queries ?? 0}</span>
            </span>
            <span className="whitespace-nowrap text-dark-400">
              NXDOMAIN: <span className="text-yellow-400 font-mono">{status.nxdomain_queries ?? 0}</span>
            </span>
            {status.config?.upstreams?.map((u, i) => (
              <span key={i} className="whitespace-nowrap text-dark-400">
                Upstream {i + 1}: <span className="text-white font-mono">{u.name || u.host}:{u.port}{u.dot ? ' ✦DoT' : ''}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* DNS Lookup tool */}
      <LookupTool />

      {/* Config editor (collapsible) */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        <button onClick={() => setShowConfig(!showConfig)}
          className="w-full flex items-center gap-2 text-sm font-semibold text-white px-5 py-4 hover:bg-dark-800/50 transition-colors">
          <Settings2 className="w-4 h-4 text-primary-400" />
          Resolver Configuration
          <span className="ml-auto">{showConfig ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}</span>
        </button>
        {showConfig && <div className="border-t border-dark-700"><ConfigEditor onReload={load} /></div>}
      </div>

      {/* Query log (collapsible) */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        <button onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center gap-2 text-sm font-semibold text-white px-5 py-4 hover:bg-dark-800/50 transition-colors">
          <Eye className="w-4 h-4 text-primary-400" />
          Resolver Query Log
          <span className="ml-auto">{showLog ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}</span>
        </button>
        {showLog && <div className="border-t border-dark-700"><ResolverLog /></div>}
      </div>

      {/* Setup guide */}
      {!running && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-yellow-400" />
            Setup Guide
          </h3>
          <div className="text-xs text-dark-400 space-y-2">
            <p>To install and start the IonMan Resolver service:</p>
            <pre className="bg-dark-950 rounded-lg p-3 text-dark-200 overflow-x-auto">{`# 1. Install Python dependency
pip3 install dnslib mysql-connector-python

# 2. Install the systemd service
sudo cp /var/www/html/ionman-dns/engine/ionman-resolver.service \\
        /etc/systemd/system/

# 3. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now ionman-resolver

# 4. Point dns_proxy.py at port 5300 instead of 5353
#    Update DNSMASQ_HOST/PORT in dns_proxy.py to 127.0.0.1:5300`}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
