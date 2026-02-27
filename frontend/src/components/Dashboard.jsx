import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../utils/api'
import { formatNumber, formatBytes } from '../utils/helpers'
import { 
  Shield, ShieldOff, Activity, Ban, Globe, 
  List, RefreshCw, AlertTriangle, Wifi, WifiOff,
  Cpu, HardDrive, Clock, Server, Zap, Eye,
  ArrowUpRight, Radio, X, Monitor, Smartphone,
  Youtube, Facebook, Megaphone, ScrollText, QrCode,
  MessageCircle, Tv, Gamepad2, Dice1, Film, Heart,
  ChevronRight, ArrowLeft, Search, Loader2, Send,
  Check, Copy, Download, RotateCcw, CheckCircle,
  Swords, Target, Flame, Sparkles, Crosshair, Box
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar
} from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [system, setSystem] = useState(null)
  const [recentQueries, setRecentQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [modal, setModal] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [wgPeers, setWgPeers] = useState([])
  const [wgStatus, setWgStatus] = useState(null)
  const [clientNames, setClientNames] = useState({})
  const [clientTypes, setClientTypes] = useState({})
  const [modalTab, setModalTab] = useState('top')
  const [adFilter, setAdFilter] = useState('all') // for ad modal: 'all' | 'allowed' | 'blocked'
  const pulseRef = useRef(null)

  // Peer interaction state (WireGuard-like modals)
  const [expandedPeer, setExpandedPeer] = useState(null)
  const [catModal, setCatModal] = useState(null)
  const [catData, setCatData] = useState(null)
  const [catLoading, setCatLoading] = useState(false)
  const [catSaving, setCatSaving] = useState(false)
  const [catEdits, setCatEdits] = useState({})
  const [brandView, setBrandView] = useState(null)
  const [brandData, setBrandData] = useState(null)
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandSearch, setBrandSearch] = useState('')
  const [togglingBrand, setTogglingBrand] = useState(null)
  const [brandFilter, setBrandFilter] = useState('all')
  const [logModal, setLogModal] = useState(null)
  const [logModalData, setLogModalData] = useState([])
  const [logModalLoading, setLogModalLoading] = useState(false)
  const [logFilter, setLogFilter] = useState('all')
  const [qrModal, setQrModal] = useState(null)
  const [copied, setCopied] = useState(false)

  const CATEGORY_ICONS = {
    social: MessageCircle, streaming: Tv, gaming: Gamepad2,
    gambling: Dice1, porn: ShieldOff, movies: Film, dating: Heart,
    messaging: Send, ads: Megaphone,
  }

  const GAME_ICONS = {
    Swords, Target, Flame, Sparkles, Crosshair, Shield,
    Gamepad2, Box, ShieldOff,
  }

  const getClientType = (ip) => {
    if (clientTypes[ip]) return clientTypes[ip]
    if (ip.startsWith('10.0.0.')) return 'wireguard'
    if (ip === '127.0.0.1' || ip === '::1') return 'server'
    return 'lan'
  }

  const clientName = (ip) => clientNames[ip] || ip

  const ClientIcon = ({ ip, className = 'w-3.5 h-3.5' }) => {
    const type = getClientType(ip)
    if (type === 'wireguard') return <Globe className={`${className} text-primary-400`} title="WireGuard VPN" />
    if (type === 'server') return <Server className={`${className} text-amber-400`} title="Server" />
    return <Monitor className={`${className} text-green-400`} title="LAN" />
  }

  const fetchStats = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true)
      const [statsData, sysData, logData, wgPeersData, wgStatusData] = await Promise.all([
        api.getStats(),
        api.getSystem(),
        api.getQueryLog({ limit: 15 }),
        api.getWgPeers().catch(() => []),
        api.getWgStatus().catch(() => null),
      ])
      setStats(statsData)
      setSystem(sysData)
      setRecentQueries(logData.logs || [])
      setWgPeers(Array.isArray(wgPeersData) ? wgPeersData : [])
      setWgStatus(wgStatusData)
      setClientNames(statsData.client_names || {})
      setClientTypes(statsData.client_types || {})
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(() => fetchStats(true), 5000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const toggleBlocking = async () => {
    try {
      if (stats.blocking_enabled) {
        await api.disableBlocking()
      } else {
        await api.enableBlocking()
      }
      fetchStats()
    } catch (err) {
      setError(err.message)
    }
  }

  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  const timeAgo = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    return `${Math.floor(diff/86400)}d ago`
  }

  const isOnline = (peer) => {
    if (!peer.last_handshake_ts || peer.last_handshake_ts === 0) return false
    return (Date.now() / 1000 - peer.last_handshake_ts) < 180
  }

  const getConnectionTime = (peer) => {
    if (!peer.last_handshake_ts || peer.last_handshake_ts === 0) return null
    const diff = Math.floor(Date.now() / 1000 - peer.last_handshake_ts)
    if (diff > 180) return null
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = diff % 60
    if (h > 0) return h + 'h ' + m + 'm'
    if (m > 0) return m + 'm ' + s + 's'
    return s + 's'
  }

  const onlinePeers = wgPeers.filter(isOnline)

  // Category modal
  const openCatModal = async (peer) => {
    setCatModal(peer)
    setCatLoading(true)
    setCatEdits({})
    try {
      const data = await api.getPeerCategories(peer.id)
      setCatData(data)
      const edits = {}
      for (const [key, cat] of Object.entries(data.categories || {})) {
        edits[key] = cat.enabled
      }
      setCatEdits(edits)
    } catch (e) { setCatData(null) }
    finally { setCatLoading(false) }
  }

  const saveCatModal = async () => {
    setCatSaving(true)
    try {
      await api.setPeerCategories(catModal.id, catEdits)
      setCatModal(null)
      closeBrandView()
    } catch (e) { /* ignore */ }
    finally { setCatSaving(false) }
  }

  const resetPeerCats = async (peerId) => {
    setCatSaving(true)
    try {
      await api.resetPeerCategories(peerId)
      setCatModal(null)
    } catch (e) { /* ignore */ }
    finally { setCatSaving(false) }
  }

  const openBrandView = async (categoryKey, categoryLabel) => {
    const peerId = catModal?.id
    if (!peerId) return
    setBrandView({ categoryKey, categoryLabel })
    setBrandLoading(true)
    setBrandSearch('')
    setBrandFilter('all')
    try {
      const data = await api.getPeerCategoryDomains(peerId, categoryKey)
      setBrandData(data)
    } catch (e) { setBrandData(null) }
    finally { setBrandLoading(false) }
  }

  const closeBrandView = () => {
    setBrandView(null)
    setBrandData(null)
    setBrandSearch('')
    setBrandFilter('all')
  }

  const togglePeerBrand = async (brand) => {
    const peerId = catModal?.id
    if (!peerId || !brandView) return
    const domainId = `${brandView.categoryKey}:${brand.display}`
    setTogglingBrand(domainId)
    try {
      const newBlocked = !brand.blocked
      await api.togglePeerDomain(peerId, brandView.categoryKey, brand.display, newBlocked)
      setBrandData(prev => {
        if (!prev) return prev
        const newBrands = prev.brands.map(b => b.display === brand.display ? { ...b, blocked: newBlocked } : b)
        return { ...prev, brands: newBrands, blocked_count: newBrands.filter(b => b.blocked).length }
      })
      setCatData(prev => {
        if (!prev?.categories) return prev
        const cat = prev.categories[brandView.categoryKey]
        if (!cat) return prev
        const delta = brand.blocked ? -1 : 1
        return { ...prev, categories: { ...prev.categories, [brandView.categoryKey]: { ...cat, blocked_brands: Math.max(0, (cat.blocked_brands || 0) + delta) } } }
      })
    } catch (e) { /* ignore */ }
    finally { setTogglingBrand(null) }
  }

  const toggleAllBrands = async (blockAll) => {
    const peerId = catModal?.id
    if (!peerId || !brandView || !brandData?.brands) return
    const toChange = brandData.brands.filter(b => b.blocked !== blockAll)
    if (toChange.length === 0) return
    setTogglingBrand('__all__')
    try {
      await Promise.all(toChange.map(b => api.togglePeerDomain(peerId, brandView.categoryKey, b.display, blockAll)))
      setBrandData(prev => {
        if (!prev) return prev
        const newBrands = prev.brands.map(b => ({ ...b, blocked: blockAll }))
        return { ...prev, brands: newBrands, blocked_count: blockAll ? newBrands.length : 0 }
      })
      setCatData(prev => {
        if (!prev?.categories) return prev
        const cat = prev.categories[brandView.categoryKey]
        if (!cat) return prev
        return { ...prev, categories: { ...prev.categories, [brandView.categoryKey]: { ...cat, blocked_brands: blockAll ? brandData.brands.length : 0 } } }
      })
    } catch (e) { /* ignore */ }
    finally { setTogglingBrand(null) }
  }

  // Log modal
  const openLogModal = async (peer) => {
    const ip = peer.allowed_ips ? peer.allowed_ips.split('/')[0] : null
    if (!ip) return
    setLogModal(peer)
    setLogModalLoading(true)
    setLogFilter('all')
    try {
      const data = await api.getQueryLog({ client: ip, limit: 500 })
      setLogModalData(data.logs || [])
    } catch (e) { setLogModalData([]) }
    finally { setLogModalLoading(false) }
  }

  const getGroupedLogData = () => {
    const filtered = logFilter === 'all' ? logModalData : logModalData.filter(q => q.action === logFilter)
    const groups = {}
    for (const q of filtered) {
      const key = q.domain + '|' + q.action
      if (!groups[key]) {
        groups[key] = { domain: q.domain, action: q.action, query_type: q.query_type, count: 0, last_seen: q.logged_at }
      }
      groups[key].count++
      if (q.logged_at > groups[key].last_seen) groups[key].last_seen = q.logged_at
    }
    return Object.values(groups).sort((a, b) => b.count - a.count)
  }

  // QR modal
  const showQR = async (peerId) => {
    try {
      const data = await api.getWgPeerConfig(peerId)
      setQrModal(data)
    } catch (e) { /* ignore */ }
  }

  const copyConfig = () => {
    if (qrModal?.config) {
      navigator.clipboard.writeText(qrModal.config)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const downloadConfig = () => {
    if (qrModal?.config) {
      const blob = new Blob([qrModal.config], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${qrModal.peer?.name || 'peer'}.conf`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="bg-danger-400/10 border border-danger-400/30 rounded-xl p-6 flex items-center gap-4">
        <AlertTriangle className="w-8 h-8 text-danger-400" />
        <div>
          <h3 className="text-danger-400 font-semibold">Error loading dashboard</h3>
          <p className="text-dark-400 text-sm">{error}</p>
        </div>
        <button onClick={() => fetchStats()} className="ml-auto px-4 py-2 bg-danger-400/20 text-danger-400 rounded-lg hover:bg-danger-400/30">Retry</button>
      </div>
    )
  }

  const statCards = [
    { label: 'Queries Today', value: formatNumber(stats.queries_today), icon: Activity, color: 'text-primary-400', bg: 'bg-primary-400/10 border-primary-400/20', glow: 'shadow-[0_0_15px_rgba(0,212,255,0.08)]', modalType: 'queries' },
    { label: 'Blocked Today', value: formatNumber(stats.blocked_today), icon: Ban, color: 'text-danger-400', bg: 'bg-danger-400/10 border-danger-400/20', glow: 'shadow-[0_0_15px_rgba(255,7,58,0.08)]', sub: `${stats.block_percentage}%`, modalType: 'blocked' },
    { label: 'Domains on Blocklist', value: formatNumber(stats.total_blocked_domains), icon: Shield, color: 'text-primary-400', bg: 'bg-primary-400/5 border-primary-400/10', glow: '', modalType: 'domains' },
    { label: 'Active Blocklists', value: stats.total_blocklists, icon: List, color: 'text-primary-400', bg: 'bg-primary-400/10 border-primary-400/20', glow: 'shadow-[0_0_15px_rgba(0,212,255,0.08)]', modalType: 'blocklists' },
  ]

  const openModal = async (type) => {
    setModal(type)
    setModalLoading(true)
    setModalData(null)
    setModalTab('top')
    try {
      if (type === 'queries') {
        const data = await api.getQueryLog({ limit: 50 })
        setModalData({
          recent: data.logs || [],
          topDomains: stats.top_allowed || [],
          totalToday: stats.queries_today,
          allowedToday: stats.allowed_today,
          blockedToday: stats.blocked_today,
          pct: stats.block_percentage,
        })
      } else if (type === 'blocked') {
        const data = await api.getQueryLog({ limit: 50, action: 'blocked' })
        setModalData({
          recent: data.logs || [],
          topDomains: stats.top_blocked || [],
          totalBlocked: stats.blocked_today,
          pct: stats.block_percentage,
        })
      } else if (type === 'domains') {
        setModalData({ total: stats.total_blocked_domains, topBlocked: stats.top_blocked })
      } else if (type === 'blocklists') {
        const data = await api.getBlocklists()
        setModalData(data)
      } else if (type === 'youtube_ads' || type === 'facebook_ads' || type === 'total_ads') {
        const adMap = { youtube_ads: 'youtube', facebook_ads: 'facebook', total_ads: 'total' }
        const data = await api.getQueryLog({ ad_type: adMap[type], grouped: '1', limit: 500 })
        setModalData(data)
        setAdFilter('all')
      } else if (type?.startsWith('client:')) {
        const clientIp = type.replace('client:', '')
        const data = await api.getQueryLog({ client: clientIp, grouped: '1', limit: 500 })
        setModalData({ ...data, clientIp })
        setAdFilter('all')
      }
    } catch (err) {
      setModalData(null)
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">Dashboard <Zap className="w-5 h-5 text-primary-400" /></h2>
          <p className="text-dark-400 text-sm mt-1 flex items-center gap-2">
            Network protection overview
            {lastUpdate && (
              <span className="flex items-center gap-1 text-dark-500 text-xs">
                <Radio className={`w-3 h-3 ${refreshing ? 'text-primary-400 animate-pulse' : 'text-dark-500'}`} />
                Live &middot; {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button onClick={() => fetchStats()} className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-primary-400 hover:border-primary-400/30 transition-all" title="Refresh now">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${stats.dns_running ? 'bg-primary-400/10 text-primary-400 border border-primary-400/30' : 'bg-danger-400/10 text-danger-400 border border-danger-400/30'}`}>
            {stats.dns_running ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">DNS</span> {stats.dns_running ? 'Active' : 'Down'}
          </div>
          <button onClick={toggleBlocking} className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${stats.blocking_enabled ? 'bg-primary-400/15 text-primary-400 border border-primary-400/30 hover:bg-primary-400/25' : 'bg-danger-400/15 text-danger-400 border border-danger-400/30 hover:bg-danger-400/25'}`}>
            {stats.blocking_enabled ? <><Shield className="w-4 h-4" /> <span className="hidden sm:inline">Protection</span> On</> : <><ShieldOff className="w-4 h-4" /> <span className="hidden sm:inline">Protection</span> Off</>}
          </button>
        </div>
      </div>

      {/* Stat Cards - Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg, glow, sub, modalType }) => (
          <div key={label} onClick={() => openModal(modalType)} className={`${bg} ${glow} border rounded-xl p-5 cursor-pointer hover:scale-[1.02] transition-all group`}>
            <div className="flex items-center justify-between">
              <Icon className={`w-5 h-5 ${color}`} />
              <div className="flex items-center gap-2">
                {sub && <span className={`text-xs font-bold ${color}`}>{sub}</span>}
                <ArrowUpRight className="w-3.5 h-3.5 text-dark-600 group-hover:text-dark-300 transition-colors" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mt-3">{value}</p>
            <p className="text-dark-400 text-sm mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Ad Blocking Stats */}
      {stats.ad_stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'youtube_ads', icon: Youtube, color: 'red', value: stats.ad_stats.youtube_ads_blocked, label: 'YouTube Ads Blocked' },
            { key: 'facebook_ads', icon: Facebook, color: 'blue', value: stats.ad_stats.facebook_ads_blocked, label: 'Facebook Ads Blocked' },
            { key: 'total_ads', icon: Megaphone, color: 'amber', value: stats.ad_stats.total_ads_blocked, label: 'Total Ads Blocked' },
          ].map(({ key, icon: AdIcon, color, value, label }) => (
            <div key={key} onClick={() => openModal(key)} className={`bg-dark-900 border border-dark-700 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:border-${color}-500/30 transition-all group`}>
              <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 flex items-center justify-center flex-shrink-0`}>
                <AdIcon className={`w-5 h-5 text-${color}-500`} />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-xl">{formatNumber(value)}</p>
                <p className="text-dark-400 text-xs">{label} <span className="text-dark-600">24h</span></p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-dark-600 group-hover:text-dark-300 transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* System Stats */}
      {system && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SystemGauge label="CPU" value={system.cpu_percent} icon={Cpu} color="#00d4ff" sub={`Load: ${system.load_1}`} />
          <SystemGauge label="Memory" value={system.mem_percent} icon={Server} color={system.mem_percent > 80 ? '#ff073a' : '#00d4ff'} sub={`${formatBytes(system.mem_used)} / ${formatBytes(system.mem_total)}`} />
          <SystemGauge label="Disk" value={system.disk_percent} icon={HardDrive} color={system.disk_percent > 80 ? '#ff073a' : '#00d4ff'} sub={`${formatBytes(system.disk_used)} / ${formatBytes(system.disk_total)}`} />
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 flex flex-col items-center justify-center">
            <Clock className="w-5 h-5 text-primary-400 mb-2" />
            <p className="text-white font-bold text-lg">{formatUptime(system.uptime_seconds)}</p>
            <p className="text-dark-400 text-xs mt-1">Uptime</p>
            {system.temperature && <p className="text-dark-500 text-xs mt-1">{system.temperature}°C</p>}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* WireGuard VPN Clients - Online Only */}
      <div className="lg:col-span-3 bg-dark-900 border border-dark-700 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary-400" /> Online VPN Clients
          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${wgStatus?.active ? 'bg-primary-400/15 text-primary-400 border border-primary-400/30' : 'bg-dark-700 text-dark-400 border border-dark-600'}`}>
            {wgStatus?.active ? 'WG Active' : 'WG Inactive'}
          </span>
          <span className="ml-auto text-dark-500 text-xs">{onlinePeers.length}/{wgPeers.length} online</span>
        </h3>
        {onlinePeers.length === 0 ? (
          <p className="text-dark-500 text-sm text-center py-4">No VPN clients currently online</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {onlinePeers.map((peer) => {
              const isExpanded = expandedPeer === peer.id
              const connTime = getConnectionTime(peer)
              return (
                <div key={peer.id} onClick={() => setExpandedPeer(isExpanded ? null : peer.id)} className="relative rounded-xl p-4 border transition-all cursor-pointer bg-primary-400/5 border-primary-400/20 shadow-[0_0_10px_rgba(0,212,255,0.05)] hover:border-primary-400/40">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-400/15">
                      <Smartphone className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{peer.name}</p>
                      <p className="text-dark-500 text-xs font-mono">{peer.allowed_ips}</p>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-primary-400 shadow-[0_0_6px_rgba(0,212,255,0.6)] animate-pulse"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-dark-500">Connected</span>
                      <p className="text-primary-400 font-mono">{connTime || timeAgo(peer.last_handshake)}</p>
                    </div>
                    <div>
                      <span className="text-dark-500">Endpoint</span>
                      <p className="text-dark-300 font-mono truncate">{peer.endpoint || '—'}</p>
                    </div>
                    <div>
                      <span className="text-dark-500">↓ Received</span>
                      <p className="text-primary-400 font-mono">{formatBytes(peer.transfer_rx || 0)}</p>
                    </div>
                    <div>
                      <span className="text-dark-500">↑ Sent</span>
                      <p className="text-primary-400 font-mono">{formatBytes(peer.transfer_tx || 0)}</p>
                    </div>
                  </div>
                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-primary-400/20 flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openCatModal(peer)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 text-xs font-medium">
                        <Shield className="w-3.5 h-3.5" /> Categories
                      </button>
                      <button onClick={() => showQR(peer.id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-300 rounded-lg hover:bg-dark-700 text-xs font-medium">
                        <QrCode className="w-3.5 h-3.5" /> QR
                      </button>
                      <button onClick={() => openLogModal(peer)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-300 rounded-lg hover:bg-dark-700 text-xs font-medium">
                        <ScrollText className="w-3.5 h-3.5" /> Queries
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-900 border border-dark-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-400" /> Queries (Last 24 Hours)
            <span className="ml-auto flex items-center gap-1 text-dark-500 text-xs"><Radio className="w-3 h-3 text-primary-400 animate-pulse" /> Live</span>
          </h3>
          <div className="h-96 overflow-x-auto max-w-full min-w-[800px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.hourly_data}>
                <defs>
                  <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff073a" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff073a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                <XAxis dataKey="hour" stroke="#444444" tick={{ fontSize: 11 }} tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit' })} />
                <YAxis stroke="#444444" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #222222', borderRadius: '8px', color: '#cccccc' }} labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Area type="monotone" dataKey="allowed" stroke="#00d4ff" fillOpacity={1} fill="url(#colorAllowed)" name="Allowed" />
                <Area type="monotone" dataKey="blocked" stroke="#ff073a" fillOpacity={1} fill="url(#colorBlocked)" name="Blocked" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">Query Distribution</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ name: 'Allowed', value: stats.allowed_today || 0 }, { name: 'Blocked', value: stats.blocked_today || 0 }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                  <Cell fill="#00d4ff" /> <Cell fill="#ff073a" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #222222', borderRadius: '8px', color: '#cccccc' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary-400"></div><span className="text-sm text-dark-300">Allowed</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-danger-400"></div><span className="text-sm text-dark-300">Blocked</span></div>
          </div>
        </div>
      </div>

      {/* Live Activity Feed + Top Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Activity Timeline */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary-400" /> Live Activity
            <span className="ml-auto flex items-center gap-1 text-dark-500 text-xs"><Radio className="w-3 h-3 text-primary-400 animate-pulse" /> Live</span>
          </h3>
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {recentQueries.length === 0 ? (
              <p className="text-dark-500 text-sm text-center py-4">No recent queries</p>
            ) : recentQueries.map((q, i) => (
              <div key={i} className={`flex items-start gap-2 py-1.5 px-2 rounded-lg text-xs ${q.action === 'blocked' ? 'bg-danger-400/5' : 'bg-dark-800/30'} hover:bg-dark-800/60 transition-colors`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${q.action === 'blocked' ? 'bg-danger-400 shadow-[0_0_4px_rgba(255,7,58,0.5)]' : 'bg-primary-400 shadow-[0_0_4px_rgba(0,212,255,0.5)]'}`}></div>
                <div className="min-w-0 flex-1">
                  <p className="text-dark-200 truncate font-mono text-[11px]">{q.domain}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <ClientIcon ip={q.client_ip} className="w-3 h-3" />
                    <span className="text-dark-500 text-[10px]">{clientName(q.client_ip)}</span>
                    <span className="text-dark-600 text-[10px]">{timeAgo(q.logged_at)}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-medium flex-shrink-0 ${q.action === 'blocked' ? 'text-danger-400' : 'text-primary-400'}`}>{q.action === 'blocked' ? 'BLK' : 'OK'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Blocked */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Ban className="w-4 h-4 text-danger-400" /> Top Blocked Domains
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stats.top_blocked.length === 0 ? (
              <p className="text-dark-500 text-sm text-center py-4">No blocked queries yet</p>
            ) : stats.top_blocked.map((item, i) => {
              const maxCount = Math.max(...stats.top_blocked.map(x => parseInt(x.count)))
              const pct = (parseInt(item.count) / maxCount) * 100
              return (
                <div key={i} className="relative py-2 px-3 rounded-lg bg-dark-800/50 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-danger-400/10 rounded-lg" style={{ width: `${pct}%` }}></div>
                  <div className="relative flex items-center justify-between">
                    <span className="text-sm text-dark-200 truncate flex-1 font-mono text-xs">{item.domain}</span>
                    <span className="text-xs font-mono text-danger-400 ml-2">{formatNumber(parseInt(item.count))}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary-400" /> Top Clients
          </h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {stats.top_clients.length === 0 ? (
              <p className="text-dark-500 text-sm text-center py-4">No client queries yet</p>
            ) : stats.top_clients.map((item, i) => {
              const maxTotal = Math.max(...stats.top_clients.map(x => parseInt(x.total)))
              const pct = (parseInt(item.total) / maxTotal) * 100
              return (
                <div key={i} onClick={() => openModal('client:' + item.client_ip)} className="relative py-2 px-3 rounded-lg bg-dark-800/50 overflow-hidden cursor-pointer hover:bg-dark-800/80 transition-colors group">
                  <div className="absolute inset-y-0 left-0 bg-primary-400/10 rounded-lg" style={{ width: `${pct}%` }}></div>
                  <div className="relative flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ClientIcon ip={item.client_ip} className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-sm text-dark-200 font-mono text-xs truncate">{clientName(item.client_ip)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="text-primary-400">{formatNumber(parseInt(item.total))}</span>
                      <span className="text-danger-400">{formatNumber(parseInt(item.blocked))} blk</span>
                      <ArrowUpRight className="w-3 h-3 text-dark-600 group-hover:text-dark-300 transition-colors" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top Games Blocked */}
      {stats.top_games && stats.top_games.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-purple-400" /> Top Games Blocked
            <span className="ml-1 text-xs text-dark-500 font-normal">last 24h</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(() => {
              const maxHits = Math.max(...stats.top_games.map(g => g.hits))
              return stats.top_games.map((game, i) => {
                const GameIcon = GAME_ICONS[game.icon] || Gamepad2
                const pct = (game.hits / maxHits) * 100
                return (
                  <div key={game.key} className="relative bg-dark-800/50 rounded-lg px-4 py-3 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-lg opacity-20" style={{ width: `${pct}%`, backgroundColor: game.color }} />
                    <div className="relative flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: game.color + '22', border: `1px solid ${game.color}44` }}>
                        <GameIcon className="w-4 h-4" style={{ color: game.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-dark-200 text-sm font-medium truncate">{game.label}</p>
                        <p className="text-xs" style={{ color: game.color }}>{formatNumber(game.hits)} hits</p>
                      </div>
                      <span className="text-xs font-mono text-dark-500 flex-shrink-0">#{i + 1}</span>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-2xl max-h-[80vh] m-4 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                {modal === 'queries' && <><Activity className="w-5 h-5 text-primary-400" /> Queries Today</>}
                {modal === 'blocked' && <><Ban className="w-5 h-5 text-danger-400" /> Blocked Today</>}
                {modal === 'domains' && 'Blocked Domains'}
                {modal === 'blocklists' && 'Active Blocklists'}
                {modal === 'youtube_ads' && <><Youtube className="w-5 h-5 text-red-500" /> YouTube Ads Blocked</>}
                {modal === 'facebook_ads' && <><Facebook className="w-5 h-5 text-blue-500" /> Facebook Ads Blocked</>}
                {modal === 'total_ads' && <><Megaphone className="w-5 h-5 text-amber-500" /> Total Ads Blocked</>}
                {modal?.startsWith('client:') && <><Globe className="w-5 h-5 text-primary-400" /> {clientName(modal.replace('client:', ''))} — Queries</>}
              </h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 scrollbar-thin">
              {modalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
                </div>
              ) : (
                <>
                  {(modal === 'queries' || modal === 'blocked') && modalData && (
                    <div className="space-y-5">
                      {/* Summary Stats */}
                      <div className={`grid ${modal === 'queries' ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                        {modal === 'queries' ? (
                          <>
                            <div className="bg-primary-400/10 border border-primary-400/20 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-primary-400">{formatNumber(modalData.totalToday)}</p>
                              <p className="text-dark-400 text-[11px] mt-0.5">Total Queries</p>
                            </div>
                            <div className="bg-primary-400/5 border border-primary-400/10 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-green-400">{formatNumber(modalData.allowedToday)}</p>
                              <p className="text-dark-400 text-[11px] mt-0.5">Allowed</p>
                            </div>
                            <div className="bg-danger-400/10 border border-danger-400/20 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-danger-400">{formatNumber(modalData.blockedToday)}</p>
                              <p className="text-dark-400 text-[11px] mt-0.5">Blocked ({modalData.pct}%)</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-danger-400/10 border border-danger-400/20 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-danger-400">{formatNumber(modalData.totalBlocked)}</p>
                              <p className="text-dark-400 text-[11px] mt-0.5">Blocked Today</p>
                            </div>
                            <div className="bg-danger-400/5 border border-danger-400/10 rounded-xl p-3 text-center">
                              <p className="text-2xl font-bold text-danger-300">{modalData.pct}%</p>
                              <p className="text-dark-400 text-[11px] mt-0.5">Block Rate</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Tabs */}
                      <div className="flex gap-1 bg-dark-800/60 p-1 rounded-lg">
                        <button
                          onClick={() => setModalTab('top')}
                          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                            modalTab === 'top'
                              ? modal === 'blocked' ? 'bg-danger-400/20 text-danger-400' : 'bg-primary-400/20 text-primary-400'
                              : 'text-dark-400 hover:text-dark-200'
                          }`}
                        >
                          Top Domains
                        </button>
                        <button
                          onClick={() => setModalTab('recent')}
                          className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                            modalTab === 'recent'
                              ? modal === 'blocked' ? 'bg-danger-400/20 text-danger-400' : 'bg-primary-400/20 text-primary-400'
                              : 'text-dark-400 hover:text-dark-200'
                          }`}
                        >
                          Recent Activity
                        </button>
                      </div>

                      {/* Top Domains Tab */}
                      {modalTab === 'top' && (
                        <div className="space-y-2">
                          {modalData.topDomains.length === 0 ? (
                            <p className="text-dark-500 text-center py-6">No data yet</p>
                          ) : modalData.topDomains.map((item, i) => {
                            const maxCount = Math.max(...modalData.topDomains.map(x => parseInt(x.count)))
                            const pct = (parseInt(item.count) / maxCount) * 100
                            const isBlocked = modal === 'blocked'
                            return (
                              <div key={i} className="relative py-2.5 px-3 rounded-lg bg-dark-800/50 overflow-hidden">
                                <div className={`absolute inset-y-0 left-0 rounded-lg ${isBlocked ? 'bg-danger-400/10' : 'bg-primary-400/10'}`} style={{ width: `${pct}%` }} />
                                <div className="relative flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${isBlocked ? 'text-danger-400/60' : 'text-primary-400/60'}`}>{i + 1}</span>
                                    <span className="text-dark-200 truncate font-mono text-xs">{item.domain}</span>
                                  </div>
                                  <span className={`text-xs font-mono flex-shrink-0 ${isBlocked ? 'text-danger-400' : 'text-primary-400'}`}>{formatNumber(parseInt(item.count))}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Recent Activity Tab */}
                      {modalTab === 'recent' && (
                        <div className="space-y-1">
                          {modalData.recent.length === 0 ? (
                            <p className="text-dark-500 text-center py-6">No recent queries</p>
                          ) : modalData.recent.map((q, i) => (
                            <div key={i} className={`flex items-center gap-3 py-2 px-3 rounded-lg text-sm ${q.action === 'blocked' ? 'bg-danger-400/5' : 'bg-dark-800/30'} hover:bg-dark-800/60 transition-colors`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${q.action === 'blocked' ? 'bg-danger-400' : 'bg-primary-400'}`} />
                              <span className="text-dark-200 truncate flex-1 font-mono text-xs">{q.domain}</span>
                              <span className="text-dark-500 text-xs flex-shrink-0 hidden sm:flex sm:items-center sm:gap-1"><ClientIcon ip={q.client_ip} className="w-3 h-3" />{clientName(q.client_ip)}</span>
                              <span className={`text-xs font-medium flex-shrink-0 ${q.action === 'blocked' ? 'text-danger-400' : 'text-primary-400'}`}>
                                {q.action === 'blocked' ? 'BLK' : 'OK'}
                              </span>
                              <span className="text-dark-600 text-[10px] flex-shrink-0">{timeAgo(q.logged_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {modal === 'domains' && modalData && (
                    <div className="space-y-4">
                      <div className="bg-primary-400/10 border border-primary-400/20 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-primary-400">{formatNumber(modalData.total)}</p>
                        <p className="text-dark-400 text-sm mt-1">Total domains on blocklist</p>
                      </div>
                      <h4 className="text-white font-semibold text-sm">Top Blocked Domains</h4>
                      <div className="space-y-2">
                        {modalData.topBlocked?.map((item, i) => {
                          const maxCount = Math.max(...modalData.topBlocked.map(x => parseInt(x.count)))
                          const pct = (parseInt(item.count) / maxCount) * 100
                          return (
                            <div key={i} className="relative py-2 px-3 rounded-lg bg-dark-800/50 overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-danger-400/10 rounded-lg" style={{ width: `${pct}%` }}></div>
                              <div className="relative flex items-center justify-between">
                                <span className="text-dark-200 truncate flex-1 font-mono text-xs">{item.domain}</span>
                                <span className="text-xs font-mono text-danger-400 ml-2">{formatNumber(parseInt(item.count))}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {modal === 'blocklists' && Array.isArray(modalData) && (
                    <div className="space-y-2">
                      {modalData.length === 0 ? (
                        <p className="text-dark-500 text-center py-6">No blocklists found</p>
                      ) : modalData.map((bl, i) => (
                        <div key={i} className="flex items-center gap-3 py-3 px-4 rounded-lg bg-dark-800/50 hover:bg-dark-800/80 transition-colors">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${bl.enabled ? 'bg-primary-400 shadow-[0_0_6px_rgba(0,212,255,0.5)]' : 'bg-dark-600'}`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-dark-200 text-sm font-medium truncate">{bl.name}</p>
                            <p className="text-dark-500 text-xs truncate">{bl.url}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-primary-400 text-xs font-mono">{formatNumber(bl.domain_count || 0)}</p>
                            <p className="text-dark-600 text-[10px]">domains</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ad Stats Detail Modal */}
                  {(modal === 'youtube_ads' || modal === 'facebook_ads' || modal === 'total_ads') && modalData && (() => {
                    const adColor = modal === 'youtube_ads' ? 'red' : modal === 'facebook_ads' ? 'blue' : 'amber'
                    const grouped = modalData.grouped || []
                    const filteredGrouped = adFilter === 'all' ? grouped : grouped.filter(g => g.action === adFilter)
                    const blockedCount = grouped.filter(g => g.action === 'blocked').reduce((s, g) => s + g.hits, 0)
                    const allowedCount = grouped.filter(g => g.action === 'allowed').reduce((s, g) => s + g.hits, 0)
                    return (
                      <div className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className={`bg-${adColor}-500/10 border border-${adColor}-500/20 rounded-xl p-3 text-center`}>
                            <p className={`text-2xl font-bold text-${adColor}-400`}>{formatNumber(modalData.total_queries)}</p>
                            <p className="text-dark-400 text-[11px] mt-0.5">Total Hits</p>
                          </div>
                          <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-danger-400">{formatNumber(blockedCount)}</p>
                            <p className="text-dark-400 text-[11px] mt-0.5">Blocked</p>
                          </div>
                          <div className="bg-dark-800 border border-dark-700 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-white">{modalData.unique_domains}</p>
                            <p className="text-dark-400 text-[11px] mt-0.5">Unique Domains</p>
                          </div>
                        </div>

                        {/* Filter tabs */}
                        <div className="flex gap-1">
                          {[
                            { key: 'all', label: 'All', count: modalData.total_queries },
                            { key: 'blocked', label: 'Blocked', count: blockedCount },
                            { key: 'allowed', label: 'Allowed', count: allowedCount },
                          ].map(f => (
                            <button
                              key={f.key}
                              onClick={() => setAdFilter(f.key)}
                              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (adFilter === f.key
                                ? f.key === 'blocked' ? 'bg-danger-400/20 text-danger-300 border border-danger-400/30'
                                  : f.key === 'allowed' ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                                  : 'bg-dark-700 text-white border border-dark-600'
                                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800 border border-transparent'
                              )}
                            >
                              {f.label} <span className="ml-1 opacity-60">{f.count}</span>
                            </button>
                          ))}
                        </div>

                        {/* Grouped domain list */}
                        <div className="space-y-1.5">
                          {filteredGrouped.length === 0 ? (
                            <p className="text-dark-500 text-center py-8">No {adFilter} queries</p>
                          ) : filteredGrouped.map((g, i) => (
                            <div key={i} className="bg-dark-800/50 rounded-lg px-3 py-2.5 hover:bg-dark-800/80 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${g.action === 'blocked' ? 'bg-danger-400' : 'bg-primary-400'}`} />
                                  <span className="text-dark-200 font-mono text-xs truncate">{g.domain}</span>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${g.hits > 10 ? 'bg-dark-700 text-white' : g.hits > 3 ? 'bg-dark-800 text-dark-200' : 'text-dark-400'}`}>
                                    {g.hits}
                                  </span>
                                  <span className={`text-[10px] ${g.action === 'blocked' ? 'text-danger-400' : 'text-primary-400'}`}>
                                    {g.action === 'blocked' ? 'BLK' : 'OK'}
                                  </span>
                                </div>
                              </div>
                              {/* Client breakdown */}
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 ml-3.5">
                                {g.clients.map((c, ci) => (
                                  <span key={ci} className="flex items-center gap-1 text-[10px] text-dark-500">
                                    <ClientIcon ip={c.ip} className="w-2.5 h-2.5" />
                                    {c.name}
                                    {g.clients.length > 1 && <span className="text-dark-600">({c.hits})</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {/* Client Query Log Modal */}
                  {modal?.startsWith('client:') && modalData && (() => {
                    const grouped = modalData.grouped || []
                    const filteredGrouped = adFilter === 'all' ? grouped : grouped.filter(g => g.action === adFilter)
                    const totalHits = grouped.reduce((s, g) => s + g.hits, 0)
                    const blockedCount = grouped.filter(g => g.action === 'blocked').reduce((s, g) => s + g.hits, 0)
                    const allowedCount = grouped.filter(g => g.action === 'allowed').reduce((s, g) => s + g.hits, 0)
                    return (
                      <div className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-primary-400/10 border border-primary-400/20 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-primary-400">{formatNumber(totalHits)}</p>
                            <p className="text-dark-400 text-[11px] mt-0.5">Total Queries</p>
                          </div>
                          <div className="bg-primary-400/5 border border-primary-400/10 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-green-400">{formatNumber(allowedCount)}</p>
                            <p className="text-dark-400 text-[11px] mt-0.5">Allowed</p>
                          </div>
                          <div className="bg-danger-400/10 border border-danger-400/20 rounded-xl p-3 text-center">
                            <p className="text-2xl font-bold text-danger-400">{formatNumber(blockedCount)}</p>
                            <p className="text-dark-400 text-[11px] mt-0.5">Blocked</p>
                          </div>
                        </div>

                        {/* Client IP info */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-dark-800/50 rounded-lg">
                          <ClientIcon ip={modalData.clientIp} className="w-4 h-4" />
                          <span className="text-dark-300 font-mono text-xs">{modalData.clientIp}</span>
                          <span className="text-dark-500 text-xs">— {modalData.unique_domains} unique domains</span>
                        </div>

                        {/* Filter tabs */}
                        <div className="flex gap-1">
                          {[
                            { key: 'all', label: 'All', count: totalHits },
                            { key: 'allowed', label: 'Allowed', count: allowedCount },
                            { key: 'blocked', label: 'Blocked', count: blockedCount },
                          ].map(f => (
                            <button
                              key={f.key}
                              onClick={() => setAdFilter(f.key)}
                              className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (adFilter === f.key
                                ? f.key === 'blocked' ? 'bg-danger-400/20 text-danger-300 border border-danger-400/30'
                                  : f.key === 'allowed' ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                                  : 'bg-dark-700 text-white border border-dark-600'
                                : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800 border border-transparent'
                              )}
                            >
                              {f.label} <span className="ml-1 opacity-60">{f.count}</span>
                            </button>
                          ))}
                        </div>

                        {/* Grouped domain list */}
                        <div className="space-y-1.5">
                          {filteredGrouped.length === 0 ? (
                            <p className="text-dark-500 text-center py-8">No {adFilter} queries</p>
                          ) : filteredGrouped.map((g, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-dark-800/50 hover:bg-dark-800/80 transition-colors">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${g.action === 'blocked' ? 'bg-danger-400' : 'bg-primary-400'}`} />
                                <span className="text-dark-200 font-mono text-xs truncate">{g.domain}</span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${g.hits > 10 ? 'bg-dark-700 text-white' : g.hits > 3 ? 'bg-dark-800 text-dark-200' : 'text-dark-400'}`}>
                                  {g.hits}
                                </span>
                                <span className={`text-[10px] ${g.action === 'blocked' ? 'text-danger-400' : 'text-primary-400'}`}>
                                  {g.action === 'blocked' ? 'BLK' : 'OK'}
                                </span>
                                <span className="text-dark-600 text-[10px] hidden sm:inline">{new Date(g.last_seen).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Blocking Modal */}
      {catModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setCatModal(null); closeBrandView() }}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-dark-700">
              <div className="flex items-center gap-3 min-w-0">
                {brandView && (
                  <button onClick={closeBrandView} className="p-1 text-dark-400 hover:text-white flex-shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="min-w-0">
                  <h3 className="text-white font-semibold flex items-center gap-2 truncate">
                    {brandView ? (
                      <>{(() => { const I = CATEGORY_ICONS[brandView.categoryKey] || Shield; return <I className="w-5 h-5 text-amber-400" /> })()}{brandView.categoryLabel}</>
                    ) : (
                      <><Shield className="w-5 h-5 text-amber-400" />{catModal.name} &mdash; Categories</>
                    )}
                  </h3>
                  <p className="text-dark-500 text-xs mt-0.5 truncate">
                    {brandView
                      ? `${brandData?.blocked_count || 0}/${brandData?.total_brands || 0} sites blocked`
                      : catModal.allowed_ips
                    }
                  </p>
                </div>
              </div>
              <button onClick={() => { setCatModal(null); closeBrandView() }} className="p-1 text-dark-400 hover:text-white flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            {brandView ? (
              <>
                <div className="px-4 sm:px-5 pt-3 pb-2 space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={brandSearch} onChange={e => setBrandSearch(e.target.value)} placeholder="Search sites..." className="w-full pl-9 pr-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 placeholder-dark-500" />
                  </div>
                  {!brandLoading && brandData?.brands?.length > 0 && (
                    <div className="flex gap-1">
                      {[
                        { key: 'all', label: 'All', count: brandData.brands.length },
                        { key: 'blocked', label: 'Blocked', count: brandData.brands.filter(b => b.blocked).length },
                        { key: 'allowed', label: 'Allowed', count: brandData.brands.filter(b => !b.blocked).length },
                      ].map(f => (
                        <button key={f.key} onClick={() => setBrandFilter(f.key)} className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (brandFilter === f.key
                          ? f.key === 'blocked' ? 'bg-danger-400/20 text-danger-300 border border-danger-400/30'
                            : f.key === 'allowed' ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                            : 'bg-dark-700 text-white border border-dark-600'
                          : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800 border border-transparent'
                        )}>
                          {f.label} <span className="ml-1 opacity-60">{f.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-3">
                  {brandLoading ? (
                    <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-primary-400 animate-spin" /></div>
                  ) : !brandData?.brands?.length ? (
                    <p className="text-dark-500 text-center py-8 text-sm">No domains in this category</p>
                  ) : (() => {
                    const filtered = brandData.brands
                      .filter(b => brandFilter === 'all' ? true : brandFilter === 'blocked' ? b.blocked : !b.blocked)
                      .filter(b => !brandSearch || b.display.toLowerCase().includes(brandSearch.toLowerCase()))
                    return filtered.length === 0 ? (
                      <p className="text-dark-500 text-xs text-center py-4">{brandFilter !== 'all' ? `No ${brandFilter} sites` : 'No sites match your search'}</p>
                    ) : (
                      <div className="space-y-1">
                        {filtered.map((brand, i) => {
                          const domainId = `${brandView.categoryKey}:${brand.display}`
                          const isToggling = togglingBrand === domainId
                          return (
                            <div key={i} className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm transition-colors ${brand.blocked ? 'bg-danger-400/5' : 'bg-dark-800/30'} hover:bg-dark-800/60`}>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${brand.blocked ? 'bg-danger-400' : 'bg-primary-400'}`} />
                                <div className="min-w-0">
                                  <span className="text-dark-200 text-sm truncate block">{brand.display}</span>
                                  {brand.domains.length > 1 && <span className="text-dark-600 text-[10px]">{brand.domains.length} domains</span>}
                                </div>
                              </div>
                              <button onClick={() => togglePeerBrand(brand)} disabled={isToggling} className={`relative flex-shrink-0 ml-3 rounded-full transition-all ${brand.blocked ? 'bg-danger-400' : 'bg-dark-600'}`} style={{ width: '40px', height: '22px' }}>
                                {isToggling ? (
                                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin absolute top-[3px] left-1/2 -translate-x-1/2" />
                                ) : (
                                  <span className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all shadow" style={{ left: brand.blocked ? '19px' : '2px' }} />
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
                <div className="p-4 border-t border-dark-700 flex items-center justify-between">
                  <span className="text-dark-500 text-xs">{brandData?.blocked_count || 0} of {brandData?.total_brands || 0} blocked</span>
                  <div className="flex gap-2">
                    <button onClick={() => toggleAllBrands(false)} disabled={togglingBrand || !brandData?.blocked_count} className="px-3 py-1.5 bg-primary-400/15 text-primary-400 border border-primary-400/30 rounded-lg hover:bg-primary-400/25 text-xs font-medium disabled:opacity-30">
                      {togglingBrand === '__all__' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}Allow All
                    </button>
                    <button onClick={() => toggleAllBrands(true)} disabled={togglingBrand || brandData?.blocked_count === brandData?.total_brands} className="px-3 py-1.5 bg-danger-400/15 text-danger-400 border border-danger-400/30 rounded-lg hover:bg-danger-400/25 text-xs font-medium disabled:opacity-30">
                      {togglingBrand === '__all__' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}Block All
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                  {catLoading ? (
                    <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-primary-400 animate-spin" /></div>
                  ) : (
                    <div className="space-y-2">
                      {Object.values(catData?.categories || {}).map(cat => {
                        const key = cat.key
                        const Icon = CATEGORY_ICONS[key] || Shield
                        const isEnabled = catEdits[key] ?? false
                        const source = cat.source || 'global'
                        const blockedBrands = cat.blocked_brands || 0
                        const totalBrands = cat.total_brands || 0
                        return (
                          <div key={key} className={'flex items-center justify-between p-3 rounded-xl border transition-all ' + (isEnabled ? 'bg-amber-500/10 border-amber-500/30' : 'bg-dark-800/50 border-dark-700 hover:border-dark-600')}>
                            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => openBrandView(key, cat.label)}>
                              <div className={'p-2 rounded-lg ' + (isEnabled ? 'bg-amber-500/20' : 'bg-dark-800')}>
                                <Icon className={'w-4 h-4 ' + (isEnabled ? 'text-amber-400' : 'text-dark-500')} />
                              </div>
                              <div className="min-w-0">
                                <p className={'text-sm font-medium ' + (isEnabled ? 'text-amber-300' : 'text-dark-300')}>{cat.label}</p>
                                <p className="text-dark-500 text-[10px]">
                                  {cat.domain_count} domains
                                  {blockedBrands > 0 && !isEnabled && <span className="ml-1 text-danger-400">&middot; {blockedBrands} site{blockedBrands > 1 ? 's' : ''} blocked</span>}
                                  {source !== 'global' && <span className="ml-1 text-primary-400/60">({source})</span>}
                                </p>
                              </div>
                              <ChevronRight className="w-4 h-4 text-dark-600 flex-shrink-0" />
                            </div>
                            <div className={'w-10 h-5 rounded-full transition-all flex items-center cursor-pointer flex-shrink-0 ml-2 ' + (isEnabled ? 'bg-amber-500 justify-end' : 'bg-dark-600 justify-start')} onClick={(e) => { e.stopPropagation(); setCatEdits(prev => ({ ...prev, [key]: !prev[key] })) }}>
                              <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="border-t border-dark-700 p-4 sm:p-5 flex gap-3">
                  {catData?.categories && Object.values(catData.categories).some(c => c.has_override) && (
                    <button onClick={() => resetPeerCats(catModal.id)} disabled={catSaving} className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-300 rounded-lg hover:bg-dark-700 text-sm">
                      <RotateCcw className="w-4 h-4" /> Reset
                    </button>
                  )}
                  <button onClick={() => { setCatModal(null); closeBrandView() }} className="flex-1 px-4 py-2 text-dark-400 hover:text-white text-sm">Cancel</button>
                  <button onClick={saveCatModal} disabled={catSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm disabled:opacity-50">
                    {catSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {catSaving ? 'Saving...' : 'Save Rules'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Query Log Modal */}
      {logModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setLogModal(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-dark-700">
              <div>
                <h3 className="text-white font-semibold">{logModal.name} &mdash; Query Log</h3>
                <p className="text-dark-500 text-xs">{logModal.allowed_ips}</p>
              </div>
              <button onClick={() => setLogModal(null)} className="p-1 text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {!logModalLoading && logModalData.length > 0 && (
              <div className="flex gap-1 px-4 sm:px-5 pt-3">
                {[
                  { key: 'all', label: 'All', count: logModalData.length },
                  { key: 'allowed', label: 'Allowed', count: logModalData.filter(q => q.action === 'allowed').length },
                  { key: 'blocked', label: 'Blocked', count: logModalData.filter(q => q.action === 'blocked').length },
                ].map(f => (
                  <button key={f.key} onClick={() => setLogFilter(f.key)} className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (logFilter === f.key
                    ? f.key === 'blocked' ? 'bg-danger-400/20 text-danger-300 border border-danger-400/30'
                      : f.key === 'allowed' ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                      : 'bg-dark-700 text-white border border-dark-600'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800 border border-transparent'
                  )}>
                    {f.label} <span className="ml-1 opacity-60">{f.count}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {logModalLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-primary-400 animate-spin" /></div>
              ) : logModalData.length === 0 ? (
                <p className="text-dark-500 text-center py-8">No queries recorded for this peer</p>
              ) : (() => {
                const grouped = getGroupedLogData()
                return grouped.length === 0 ? (
                  <p className="text-dark-500 text-center py-8">No {logFilter} queries</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-700">
                          <th className="text-left p-2 text-xs text-dark-400 font-medium">Domain</th>
                          <th className="text-right p-2 text-xs text-dark-400 font-medium">Hits</th>
                          <th className="text-left p-2 text-xs text-dark-400 font-medium">Status</th>
                          <th className="text-left p-2 text-xs text-dark-400 font-medium hidden sm:table-cell">Last Seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grouped.map((g, i) => (
                          <tr key={i} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                            <td className="p-2 text-dark-200 font-mono text-xs truncate max-w-[200px] sm:max-w-xs">{g.domain}</td>
                            <td className="p-2 text-right">
                              <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (g.count > 10 ? 'bg-dark-700 text-white' : g.count > 3 ? 'bg-dark-800 text-dark-200' : 'text-dark-400')}>{g.count}</span>
                            </td>
                            <td className="p-2">
                              {g.action === 'blocked' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-danger-400/10 border border-danger-400/20 text-danger-400 rounded-full text-[10px] font-medium"><Ban className="w-3 h-3" /> Blocked</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-400/10 border border-primary-400/20 text-primary-400 rounded-full text-[10px] font-medium"><CheckCircle className="w-3 h-3" /> Allowed</span>
                              )}
                            </td>
                            <td className="p-2 text-dark-500 text-xs whitespace-nowrap hidden sm:table-cell">{new Date(g.last_seen).toLocaleTimeString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-dark-600 text-[10px] mt-2 text-center">{grouped.length} unique domains from {logFilter === 'all' ? logModalData.length : logModalData.filter(q => q.action === logFilter).length} queries</p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* QR / Config Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h3 className="text-white font-semibold">{qrModal.peer?.name} &mdash; VPN Config</h3>
              <button onClick={() => setQrModal(null)} className="p-1 text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              {qrModal.qr_code && (
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl"><img src={qrModal.qr_code} alt="WireGuard QR" className="w-48 h-48 sm:w-64 sm:h-64" /></div>
                </div>
              )}
              <p className="text-center text-dark-400 text-sm">Scan with the WireGuard app on your device</p>
              <div className="relative">
                <pre className="bg-dark-950 border border-dark-700 rounded-xl p-4 text-xs text-dark-200 font-mono overflow-x-auto whitespace-pre">{qrModal.config}</pre>
                <div className="absolute top-2 right-2">
                  <button onClick={copyConfig} className="p-2 bg-dark-800 border border-dark-600 rounded-lg text-dark-400 hover:text-white text-xs">
                    {copied ? <Check className="w-4 h-4 text-primary-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={downloadConfig} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                  <Download className="w-4 h-4" /> Download .conf
                </button>
                <button onClick={copyConfig} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm">
                  {copied ? <><Check className="w-4 h-4 text-primary-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SystemGauge({ label, value, icon: Icon, color, sub }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference
  
  return (
    <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} stroke="#222222" strokeWidth="6" fill="none" />
          <circle cx="40" cy="40" r={radius} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 0.5s ease', filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-bold text-sm">{Math.round(value)}%</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-dark-300 text-xs font-medium">{label}</span>
      </div>
      {sub && <p className="text-dark-500 text-[10px] mt-0.5">{sub}</p>}
    </div>
  )
}
