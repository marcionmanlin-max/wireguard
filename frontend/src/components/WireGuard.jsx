import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import { formatBytes, timeAgo } from '../utils/helpers'
import { 
  Globe, Plus, Trash2, QrCode, RefreshCw, Download, 
  Wifi, WifiOff, Copy, Check, X, Shield, Settings,
  ChevronDown, ChevronUp, Radio, ArrowDown, ArrowUp,
  Clock, Zap, Users, Eye, Ban, ScrollText, Smartphone,
  Edit3, MessageCircle, Tv, Gamepad2, Dice1, ShieldOff,
  Film, Heart, RotateCcw, UserCheck, CheckSquare, Square,
  ChevronRight, ArrowLeft, Search, Loader2, Send, Megaphone,
  CheckCircle
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import Modal from './Modal'

export default function WireGuard() {
  const [peers, setPeers] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newPeer, setNewPeer] = useState({ name: '' })
  const [qrModal, setQrModal] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)
  const [expandedPeer, setExpandedPeer] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [peerLogs, setPeerLogs] = useState({})
  const [logModal, setLogModal] = useState(null)
  const [logModalData, setLogModalData] = useState([])
  const [logModalLoading, setLogModalLoading] = useState(false)
  const [logFilter, setLogFilter] = useState('all') // 'all' | 'allowed' | 'blocked'
  const [renamingPeer, setRenamingPeer] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null })
  const [renameValue, setRenameValue] = useState('')
  const [catModal, setCatModal] = useState(null) // peer object or 'bulk'
  const [catData, setCatData] = useState(null) // per-peer category data
  const [catLoading, setCatLoading] = useState(false)
  const [catSaving, setCatSaving] = useState(false)
  const [catEdits, setCatEdits] = useState({}) // local edits: { cat_key: bool }
  const [bulkSelected, setBulkSelected] = useState([]) // peer ids for bulk
  const [bulkMode, setBulkMode] = useState(false)
  const [peerBlockingSummary, setPeerBlockingSummary] = useState(null)
  // Brand-level blocking within categories
  const [brandView, setBrandView] = useState(null) // { categoryKey, categoryLabel } or null
  const [brandData, setBrandData] = useState(null) // { brands: [...], blocked_count, total_brands }
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandSearch, setBrandSearch] = useState('')
  const [togglingBrand, setTogglingBrand] = useState(null) // 'categoryKey:brandDisplay'
  const [brandFilter, setBrandFilter] = useState('all') // 'all' | 'blocked' | 'allowed'

  const fetchData = useCallback(async () => {
    try {
      const [peersData, statusData] = await Promise.all([
        api.getWgPeers(),
        api.getWgStatus(),
      ])
      // Preserve last_handshake_ts from existing state when WG restarts
      // (peer add triggers wg sync/restart which clears handshake temporarily)
      setPeers(prev => {
        const prevMap = {}
        prev.forEach(p => { prevMap[p.id] = p })
        return peersData.map(p => {
          const existing = prevMap[p.id]
          const now = Date.now() / 1000
          // If new handshake is 0 but existing was within 5 min, keep existing
          if (existing &&
              (!p.last_handshake_ts || p.last_handshake_ts === 0) &&
              existing.last_handshake_ts > 0 &&
              (now - existing.last_handshake_ts) < 300) {
            return { ...p, last_handshake_ts: existing.last_handshake_ts }
          }
          return p
        })
      })
      setStatus(statusData)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Fetch peer blocking summary for badges
  const fetchBlockingSummary = useCallback(async () => {
    try {
      const data = await api.getPeerBlocking()
      setPeerBlockingSummary(data)
    } catch (e) { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchBlockingSummary()
  }, [fetchBlockingSummary])

  const CATEGORY_ICONS = {
    social: MessageCircle, streaming: Tv, gaming: Gamepad2,
    gambling: Dice1, porn: ShieldOff, movies: Film, dating: Heart,
    messaging: Send, ads: Megaphone,
  }

  const openCatModal = async (peer) => {
    setCatModal(peer)
    setCatLoading(true)
    setCatEdits({})
    try {
      const data = await api.getPeerCategories(peer.id)
      setCatData(data)
      // Pre-populate edits with current effective state
      const edits = {}
      for (const [key, cat] of Object.entries(data.categories || {})) {
        edits[key] = cat.enabled
      }
      setCatEdits(edits)
    } catch (e) {
      setCatData(null)
    } finally {
      setCatLoading(false)
    }
  }

  const openBulkCatModal = async () => {
    setCatModal('bulk')
    setCatLoading(true)
    setCatEdits({})
    try {
      const cats = await api.getPeerBlockingCategories()
      setCatData({ categories_list: cats })
      const edits = {}
      cats.forEach(c => { edits[c.key] = c.global_enabled })
      setCatEdits(edits)
    } catch (e) {
      setCatData(null)
    } finally {
      setCatLoading(false)
    }
  }

  const saveCatModal = async () => {
    setCatSaving(true)
    try {
      if (catModal === 'bulk') {
        await api.bulkSetCategories(bulkSelected, catEdits)
      } else {
        await api.setPeerCategories(catModal.id, catEdits)
      }
      setCatModal(null)
      closeBrandView()
      setBulkMode(false)
      setBulkSelected([])
      fetchBlockingSummary()
    } catch (e) { /* ignore */ }
    finally { setCatSaving(false) }
  }

  const resetPeerCats = async (peerId) => {
    setCatSaving(true)
    try {
      await api.resetPeerCategories(peerId)
      setCatModal(null)
      fetchBlockingSummary()
    } catch (e) { /* ignore */ }
    finally { setCatSaving(false) }
  }

  // Open brand-level view for a category
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
    } catch (e) {
      setBrandData(null)
    } finally {
      setBrandLoading(false)
    }
  }

  const closeBrandView = () => {
    setBrandView(null)
    setBrandData(null)
    setBrandSearch('')
    setBrandFilter('all')
  }

  // Toggle a brand for the current peer
  const togglePeerBrand = async (brand) => {
    const peerId = catModal?.id
    if (!peerId || !brandView) return
    const domainId = `${brandView.categoryKey}:${brand.display}`
    setTogglingBrand(domainId)
    try {
      const newBlocked = !brand.blocked
      await api.togglePeerDomain(peerId, brandView.categoryKey, brand.display, newBlocked)
      // Update local brand data
      setBrandData(prev => {
        if (!prev) return prev
        const newBrands = prev.brands.map(b =>
          b.display === brand.display ? { ...b, blocked: newBlocked } : b
        )
        return {
          ...prev,
          brands: newBrands,
          blocked_count: newBrands.filter(b => b.blocked).length,
        }
      })
      // Update catData to reflect brand count changes
      setCatData(prev => {
        if (!prev?.categories) return prev
        const cat = prev.categories[brandView.categoryKey]
        if (!cat) return prev
        const delta = brand.blocked ? -1 : 1
        return {
          ...prev,
          categories: {
            ...prev.categories,
            [brandView.categoryKey]: {
              ...cat,
              blocked_brands: Math.max(0, (cat.blocked_brands || 0) + delta),
            }
          }
        }
      })
    } catch (e) { /* ignore */ }
    finally { setTogglingBrand(null) }
  }

  // Block or allow all brands for current peer in current category
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

  const toggleBulkPeer = (id) => {
    setBulkSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const getPeerBlockedCount = (peerId) => {
    if (!peerBlockingSummary) return null
    const p = peerBlockingSummary.peers?.find(x => x.id === peerId)
    if (!p) return null
    return { blocked: p.blocked_categories?.length || 0, hasCustom: p.has_custom_rules, cats: p.blocked_categories || [] }
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

  const onlinePeers = peers.filter(isOnline)
  const totalRx = peers.reduce((s, p) => s + (p.transfer_rx || 0), 0)
  const totalTx = peers.reduce((s, p) => s + (p.transfer_tx || 0), 0)

  const fetchPeerLogs = async (peer) => {
    const ip = peer.allowed_ips ? peer.allowed_ips.split('/')[0] : null
    if (!ip) return
    try {
      const data = await api.getQueryLog({ client: ip, limit: 8 })
      setPeerLogs(prev => ({ ...prev, [peer.id]: data.logs || [] }))
    } catch (e) { /* ignore */ }
  }

  const openLogModal = async (peer) => {
    const ip = peer.allowed_ips ? peer.allowed_ips.split('/')[0] : null
    if (!ip) return
    setLogModal(peer)
    setLogModalLoading(true)
    setLogFilter('all')
    try {
      const data = await api.getQueryLog({ client: ip, limit: 500 })
      setLogModalData(data.logs || [])
    } catch (e) {
      setLogModalData([])
    } finally {
      setLogModalLoading(false)
    }
  }

  // Group log data by domain, filtered by action
  const getGroupedLogData = () => {
    const filtered = logFilter === 'all' ? logModalData : logModalData.filter(q => q.action === logFilter)
    const groups = {}
    for (const q of filtered) {
      const key = q.domain + '|' + q.action
      if (!groups[key]) {
        groups[key] = { domain: q.domain, action: q.action, query_type: q.query_type, count: 0, last_seen: q.logged_at }
      }
      groups[key].count++
      if (q.logged_at > groups[key].last_seen) {
        groups[key].last_seen = q.logged_at
      }
    }
    return Object.values(groups).sort((a, b) => b.count - a.count)
  }

  const handleExpand = (peer) => {
    const expanded = expandedPeer === peer.id
    setExpandedPeer(expanded ? null : peer.id)
    if (!expanded && !peerLogs[peer.id]) {
      fetchPeerLogs(peer)
    }
  }

  const addPeer = async (e) => {
    e.preventDefault()
    try {
      await api.addWgPeer(newPeer)
      setNewPeer({ name: '' })
      setShowAdd(false)
      fetchData()
    } catch (err) { setError(err.message) }
  }

  const renamePeer = async (peer) => {
    if (!renameValue.trim() || renameValue.trim() === peer.name) {
      setRenamingPeer(null)
      return
    }
    try {
      await api.renamePeer(peer.id, renameValue.trim())
      setRenamingPeer(null)
      fetchData()
    } catch (err) { setError(err.message) }
  }

  const deletePeer = (id) => {
    setDeleteModal({ open: true, id })
  }

  const doDeletePeer = async () => {
    try { await api.deleteWgPeer(deleteModal.id); fetchData() }
    catch (err) { setError(err.message) }
  }

  const showQR = async (peerId) => {
    try { const data = await api.getWgPeerConfig(peerId); setQrModal(data) }
    catch (err) { setError(err.message) }
  }

  const copyConfig = () => {
    navigator.clipboard.writeText(qrModal.config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadConfig = () => {
    const blob = new Blob([qrModal.config], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = (qrModal.peer.name || 'wg0') + '.conf'
    a.click()
    URL.revokeObjectURL(url)
  }

  const setupWg = async () => {
    try { await api.setupWg(); fetchData() }
    catch (err) { setError(err.message) }
  }

  const restartWg = async () => {
    try { await api.restartWg(); setTimeout(fetchData, 2000) }
    catch (err) { setError(err.message) }
  }

  const transferData = peers.map(p => ({
    name: p.name || 'Unnamed',
    rx: p.transfer_rx || 0,
    tx: p.transfer_tx || 0,
  }))

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-primary-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Globe className="w-6 h-6 text-primary-400" /> WireGuard VPN</h2>
          <p className="text-dark-400 text-sm mt-1 flex items-center gap-2">
            Manage VPN peers
            {lastUpdate && (
              <span className="flex items-center gap-1 text-dark-500 text-xs">
                <Radio className="w-3 h-3 text-primary-400 animate-pulse" /> Live
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {bulkMode ? (
            <>
              <span className="text-dark-400 text-xs">{bulkSelected.length} selected</span>
              <button onClick={() => { if (bulkSelected.length > 0) openBulkCatModal() }} disabled={bulkSelected.length === 0} className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm disabled:opacity-40">
                <Shield className="w-4 h-4" /> Set Categories
              </button>
              <button onClick={() => { setBulkMode(false); setBulkSelected([]) }} className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm">
                <X className="w-4 h-4" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setBulkMode(true)} className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm" title="Bulk category blocking">
                <Shield className="w-4 h-4" /> <span className="hidden sm:inline">Bulk Block</span>
              </button>
              <button onClick={restartWg} className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm">
                <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline">Restart</span>
              </button>
              <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                <Plus className="w-4 h-4" /> Add Peer
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 flex items-center gap-3 text-sm">
          <span className="text-danger-300 flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4 text-dark-400" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={`border rounded-xl p-3 sm:p-4 ${status && status.active ? 'bg-primary-400/5 border-primary-400/20' : 'bg-danger-400/5 border-danger-400/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            {status && status.active ? <Wifi className="w-4 h-4 text-primary-400" /> : <WifiOff className="w-4 h-4 text-danger-400" />}
            <span className="text-dark-400 text-xs">Interface</span>
          </div>
          <p className="text-white font-bold text-base sm:text-lg">{status && status.active ? 'Active' : 'Inactive'}</p>
          <p className="text-dark-500 text-xs">Port {(status && status.listen_port) || '51820'}</p>
        </div>
        <div className="bg-primary-400/5 border border-primary-400/20 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-primary-400" /><span className="text-dark-400 text-xs">Peers</span></div>
          <p className="text-white font-bold text-base sm:text-lg">{onlinePeers.length}<span className="text-dark-500 text-sm font-normal">/{peers.length}</span></p>
          <p className="text-dark-500 text-xs">Online now</p>
        </div>
        <div className="bg-primary-400/5 border border-primary-400/20 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2"><ArrowDown className="w-4 h-4 text-primary-400" /><span className="text-dark-400 text-xs">Download</span></div>
          <p className="text-white font-bold text-base sm:text-lg">{formatBytes(totalRx)}</p>
          <p className="text-dark-500 text-xs">All peers</p>
        </div>
        <div className="bg-primary-400/5 border border-primary-400/20 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2"><ArrowUp className="w-4 h-4 text-primary-400" /><span className="text-dark-400 text-xs">Upload</span></div>
          <p className="text-white font-bold text-base sm:text-lg">{formatBytes(totalTx)}</p>
          <p className="text-dark-500 text-xs">All peers</p>
        </div>
      </div>

      {peers.length > 0 && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 sm:p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary-400" /> Data Transfer by Peer
          </h3>
          <div className="overflow-y-auto max-h-72 sm:max-h-80">
            <div style={{ height: Math.max(120, transferData.length * 50) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={transferData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" stroke="#444" tick={{ fontSize: 10 }} tickFormatter={(v) => formatBytes(v)} />
                  <YAxis type="category" dataKey="name" stroke="#444" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #222', borderRadius: '8px', color: '#ccc' }} formatter={(v) => formatBytes(v)} />
                  <Bar dataKey="rx" name="Download" fill="#00d4ff" radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey="tx" name="Upload" fill="#ff073a" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {status && !status.active && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 text-center">
          <WifiOff className="w-10 h-10 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300 mb-4">WireGuard is not running</p>
          <button onClick={setupWg} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm mx-auto">
            <Settings className="w-4 h-4" /> Setup WireGuard
          </button>
        </div>
      )}

      {showAdd && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-4 sm:p-6">
          <h3 className="text-white font-semibold mb-4">Add VPN Peer</h3>
          <form onSubmit={addPeer} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1">Peer Name</label>
              <input type="text" value={newPeer.name} onChange={e => setNewPeer({ name: e.target.value })} className="w-full max-w-md px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" placeholder="My Phone, Laptop, etc." required />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">Create Peer</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-dark-400 hover:text-white text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {peers.length === 0 ? (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-12 text-center">
          <Globe className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">No VPN peers configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {peers.map(peer => {
            const online = isOnline(peer)
            const connTime = getConnectionTime(peer)
            const expanded = expandedPeer === peer.id
            const logs = peerLogs[peer.id] || []
            return (
              <div key={peer.id} className={'bg-dark-900 border rounded-xl transition-all ' + (online ? 'border-primary-400/30 shadow-[0_0_12px_rgba(0,212,255,0.05)]' : 'border-dark-700')}>
                <div className="p-4 sm:p-5 cursor-pointer" onClick={() => bulkMode ? toggleBulkPeer(peer.id) : handleExpand(peer)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {bulkMode && (
                        <div className="flex-shrink-0">
                          {bulkSelected.includes(peer.id) ? (
                            <CheckSquare className="w-5 h-5 text-primary-400" />
                          ) : (
                            <Square className="w-5 h-5 text-dark-500" />
                          )}
                        </div>
                      )}
                      <div className={'p-2 rounded-lg ' + (online ? 'bg-primary-500/10' : 'bg-dark-800')}>
                        <Smartphone className={'w-5 h-5 ' + (online ? 'text-primary-400' : 'text-dark-500')} />
                      </div>
                      <div>
                        <h4 className="text-white font-medium flex items-center gap-2">
                          {renamingPeer === peer.id ? (
                            <input
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onBlur={() => renamePeer(peer)}
                              onKeyDown={e => { if (e.key === 'Enter') renamePeer(peer); if (e.key === 'Escape') setRenamingPeer(null) }}
                              className="bg-dark-800 border border-primary-500 rounded px-2 py-0.5 text-white text-sm w-28 focus:outline-none"
                              autoFocus
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              {peer.name}
                              <button onClick={(e) => { e.stopPropagation(); setRenamingPeer(peer.id); setRenameValue(peer.name) }} className="text-dark-500 hover:text-primary-400 transition-colors">
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {online && <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse shadow-[0_0_6px_rgba(0,212,255,0.5)]"></span>}
                        </h4>
                        <p className="text-dark-500 text-xs font-mono">{peer.allowed_ips}</p>
                        {(() => {
                          const bc = getPeerBlockedCount(peer.id)
                          if (!bc || bc.blocked === 0) return null
                          return (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Shield className="w-3 h-3 text-amber-400" />
                              <span className="text-amber-400 text-[10px]">{bc.blocked} cat{bc.blocked !== 1 ? 's' : ''} blocked</span>
                              {bc.hasCustom && <span className="text-[9px] text-amber-500/60 bg-amber-500/10 px-1 rounded">custom</span>}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {online && connTime && (
                        <span className="flex items-center gap-1 text-primary-400 text-xs"><Clock className="w-3 h-3" />{connTime}</span>
                      )}
                      {expanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-dark-800/50 rounded-lg py-1.5">
                      <p className={'text-xs font-medium ' + (online ? 'text-primary-400' : 'text-dark-500')}>{online ? 'Online' : 'Offline'}</p>
                    </div>
                    <div className="bg-dark-800/50 rounded-lg py-1.5">
                      <p className="text-xs text-dark-300">{'\u2193'} {formatBytes(peer.transfer_rx || 0)}</p>
                    </div>
                    <div className="bg-dark-800/50 rounded-lg py-1.5">
                      <p className="text-xs text-dark-300">{'\u2191'} {formatBytes(peer.transfer_tx || 0)}</p>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-dark-700 p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-dark-500 text-xs">Last Handshake</span>
                        <p className="text-dark-200">{peer.last_handshake ? timeAgo(peer.last_handshake) : 'Never'}</p>
                      </div>
                      <div>
                        <span className="text-dark-500 text-xs">Endpoint</span>
                        <p className="text-dark-200 font-mono text-xs truncate">{peer.endpoint || '\u2014'}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-dark-400 text-xs font-medium flex items-center gap-1"><Eye className="w-3 h-3" /> Recent Activity</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openLogModal(peer) }}
                          className="text-primary-400 text-[10px] hover:underline"
                        >Show all</button>
                      </div>
                      {logs.length === 0 ? (
                        <p className="text-dark-600 text-xs text-center py-2">No activity recorded</p>
                      ) : (
                        <div className="space-y-0.5 max-h-40 overflow-y-auto">
                          {logs.slice(0, 5).map((q, i) => (
                            <div key={i} className={'flex items-center gap-2 py-1 px-2 rounded text-[11px] ' + (q.action === 'blocked' ? 'bg-danger-400/5' : 'bg-dark-800/30')}>
                              <div className={'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (q.action === 'blocked' ? 'bg-danger-400' : 'bg-primary-400')} />
                              <span className="text-dark-300 font-mono truncate flex-1">{q.domain}</span>
                              <span className={'text-[10px] flex-shrink-0 ' + (q.action === 'blocked' ? 'text-danger-400' : 'text-dark-600')}>
                                {q.action === 'blocked' ? 'BLK' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1 flex-wrap">
                      <button onClick={(e) => { e.stopPropagation(); openCatModal(peer) }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500/20 text-xs font-medium min-w-[100px]">
                        <Shield className="w-3.5 h-3.5" /> Categories
                        {(() => { const bc = getPeerBlockedCount(peer.id); return bc && bc.blocked > 0 ? <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 rounded-full">{bc.blocked}</span> : null })()}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); showQR(peer.id) }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600/10 border border-primary-600/30 text-primary-400 rounded-lg hover:bg-primary-600/20 text-xs font-medium min-w-[100px]">
                        <QrCode className="w-3.5 h-3.5" /> QR & Config
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openLogModal(peer) }} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-dark-800 border border-dark-600 text-dark-300 rounded-lg hover:bg-dark-700 text-xs font-medium min-w-[100px]">
                        <ScrollText className="w-3.5 h-3.5" /> Queries
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deletePeer(peer.id) }} className="px-3 py-2 bg-danger-400/10 border border-danger-400/30 text-danger-400 rounded-lg hover:bg-danger-400/20 text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

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
            {/* Filter tabs */}
            {!logModalLoading && logModalData.length > 0 && (
              <div className="flex gap-1 px-4 sm:px-5 pt-3">
                {[
                  { key: 'all', label: 'All', count: logModalData.length },
                  { key: 'allowed', label: 'Allowed', count: logModalData.filter(q => q.action === 'allowed').length },
                  { key: 'blocked', label: 'Blocked', count: logModalData.filter(q => q.action === 'blocked').length },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setLogFilter(f.key)}
                    className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (logFilter === f.key
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
                              <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (g.count > 10 ? 'bg-dark-700 text-white' : g.count > 3 ? 'bg-dark-800 text-dark-200' : 'text-dark-400')}>
                                {g.count}
                              </span>
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

      {qrModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setQrModal(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <h3 className="text-white font-semibold">{qrModal.peer.name} &mdash; VPN Config</h3>
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

      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null })} onConfirm={doDeletePeer} title="Delete Peer" message="Delete this VPN peer? This cannot be undone." type="danger" confirmText="Delete" />

      {/* Category Blocking Modal */}
      {catModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setCatModal(null); closeBrandView() }}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-dark-700">
              <div className="flex items-center gap-3 min-w-0">
                {brandView && catModal !== 'bulk' && (
                  <button onClick={closeBrandView} className="p-1 text-dark-400 hover:text-white flex-shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="min-w-0">
                  <h3 className="text-white font-semibold flex items-center gap-2 truncate">
                    {brandView ? (
                      <>{(() => { const I = CATEGORY_ICONS[brandView.categoryKey] || Shield; return <I className="w-5 h-5 text-amber-400" /> })()}{brandView.categoryLabel}</>
                    ) : (
                      <><Shield className="w-5 h-5 text-amber-400" />{catModal === 'bulk' ? `Bulk Blocking (${bulkSelected.length})` : `${catModal.name} — Categories`}</>
                    )}
                  </h3>
                  <p className="text-dark-500 text-xs mt-0.5 truncate">
                    {brandView
                      ? `${brandData?.blocked_count || 0}/${brandData?.total_brands || 0} sites blocked`
                      : catModal === 'bulk' ? 'Apply rules to selected peers' : catModal.allowed_ips
                    }
                  </p>
                </div>
              </div>
              <button onClick={() => { setCatModal(null); closeBrandView() }} className="p-1 text-dark-400 hover:text-white flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            {/* Brand-level view */}
            {brandView ? (
              <>
                {/* Search */}
                <div className="px-4 sm:px-5 pt-3 pb-2 space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text" value={brandSearch} onChange={e => setBrandSearch(e.target.value)}
                      placeholder="Search sites..." className="w-full pl-9 pr-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 placeholder-dark-500"
                    />
                  </div>
                  {/* Filter tabs */}
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
                                  {brand.domains.length > 1 && (
                                    <span className="text-dark-600 text-[10px]">{brand.domains.length} domains</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => togglePeerBrand(brand)}
                                disabled={isToggling}
                                className={`relative flex-shrink-0 ml-3 rounded-full transition-all ${brand.blocked ? 'bg-danger-400' : 'bg-dark-600'}`}
                                style={{ width: '40px', height: '22px' }}
                              >
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
                {/* Brand footer */}
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
                {/* Category list view */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                  {catLoading ? (
                    <div className="flex justify-center py-8"><RefreshCw className="w-6 h-6 text-primary-400 animate-spin" /></div>
                  ) : (
                    <div className="space-y-2">
                      {(catModal === 'bulk' ? (catData?.categories_list || []) : Object.values(catData?.categories || {})).map(cat => {
                        const key = cat.key
                        const Icon = CATEGORY_ICONS[key] || Shield
                        const isEnabled = catEdits[key] ?? false
                        const source = cat.source || 'global'
                        const blockedBrands = cat.blocked_brands || 0
                        const totalBrands = cat.total_brands || 0
                        return (
                          <div key={key} className={'flex items-center justify-between p-3 rounded-xl border transition-all ' + (isEnabled ? 'bg-amber-500/10 border-amber-500/30' : 'bg-dark-800/50 border-dark-700 hover:border-dark-600')}>
                            {/* Clickable area for brand view (only for per-peer, not bulk) */}
                            <div
                              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                              onClick={() => catModal !== 'bulk' ? openBrandView(key, cat.label) : setCatEdits(prev => ({ ...prev, [key]: !prev[key] }))}
                            >
                              <div className={'p-2 rounded-lg ' + (isEnabled ? 'bg-amber-500/20' : 'bg-dark-800')}>
                                <Icon className={'w-4 h-4 ' + (isEnabled ? 'text-amber-400' : 'text-dark-500')} />
                              </div>
                              <div className="min-w-0">
                                <p className={'text-sm font-medium ' + (isEnabled ? 'text-amber-300' : 'text-dark-300')}>{cat.label}</p>
                                <p className="text-dark-500 text-[10px]">
                                  {cat.domain_count} domains
                                  {catModal !== 'bulk' && blockedBrands > 0 && !isEnabled && (
                                    <span className="ml-1 text-danger-400">&middot; {blockedBrands} site{blockedBrands > 1 ? 's' : ''} blocked</span>
                                  )}
                                  {catModal !== 'bulk' && source !== 'global' && (
                                    <span className="ml-1 text-primary-400/60">({source})</span>
                                  )}
                                </p>
                              </div>
                              {catModal !== 'bulk' && (
                                <ChevronRight className="w-4 h-4 text-dark-600 flex-shrink-0" />
                              )}
                            </div>
                            {/* Toggle */}
                            <div
                              className={'w-10 h-5 rounded-full transition-all flex items-center cursor-pointer flex-shrink-0 ml-2 ' + (isEnabled ? 'bg-amber-500 justify-end' : 'bg-dark-600 justify-start')}
                              onClick={(e) => { e.stopPropagation(); setCatEdits(prev => ({ ...prev, [key]: !prev[key] })) }}
                            >
                              <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {/* Category footer */}
                <div className="border-t border-dark-700 p-4 sm:p-5 flex gap-3">
                  {catModal !== 'bulk' && catData?.categories && Object.values(catData.categories).some(c => c.has_override) && (
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
    </div>
  )
}
