import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import {
  Shield, Swords, Target, Flame, Sparkles, Crosshair, Box,
  Gamepad2, RefreshCw, X, Check, Loader2, Wifi, Monitor,
  ChevronRight, ArrowLeft, Search, Plus, Trash2, Edit3,
  ShieldAlert, ShieldOff, ToggleLeft, ToggleRight, Smartphone,
  Laptop, Tv, Users, Globe, Activity, Zap, ScanSearch,
  Network, Lock, Unlock, Info, Globe2, Tag
} from 'lucide-react'
import { formatNumber } from '../utils/helpers'

// Game icon mapping
const GAME_ICONS = {
  Swords, Target, Flame, Sparkles, Crosshair, Shield, Box, Gamepad2,
}

export default function PortBlocking() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [detecting, setDetecting] = useState(false)

  // Client edit modal
  const [clientModal, setClientModal] = useState(null) // null or client object
  const [clientGames, setClientGames] = useState({})
  const [clientSaving, setClientSaving] = useState(false)

  // Add LAN client modal
  const [addModal, setAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ ip_address: '', name: '', device_type: 'other' })
  const [addSaving, setAddSaving] = useState(false)

  // Game detail modal
  const [gameModal, setGameModal] = useState(null)

  // Search
  const [search, setSearch] = useState('')

  const showMsg = (msg) => { setMessage(msg); setTimeout(() => setMessage(null), 3000) }

  const fetchData = useCallback(async () => {
    try {
      const result = await api.getPortBlocking()
      setData(result)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-detect new games silently every 10 minutes
  useEffect(() => {
    const autoDetect = async () => {
      try {
        await api.detectNewGames()
        fetchData()
      } catch (e) { /* silent */ }
    }
    const interval = setInterval(autoDetect, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.syncPortRules()
      showMsg('Port rules synced to iptables')
      fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setSyncing(false)
    }
  }

  const openClientModal = async (client) => {
    setClientModal(client)
    setClientSaving(false)
    try {
      const result = await api.getClientPortBlocks(client.ip)
      const edits = {}
      for (const [key, g] of Object.entries(result.games || {})) {
        edits[key] = g.enabled
      }
      setClientGames(edits)
    } catch (e) {
      // Initialize from local data
      const edits = {}
      for (const [key, val] of Object.entries(client.port_blocks || {})) {
        edits[key] = val
      }
      setClientGames(edits)
    }
  }

  const saveClientGames = async () => {
    if (!clientModal) return
    setClientSaving(true)
    try {
      await api.setClientPortBlocks(clientModal.ip, clientGames)
      showMsg(`Port blocks updated for ${clientModal.name}`)
      setClientModal(null)
      fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setClientSaving(false)
    }
  }

  const handleGlobalToggle = async (gameKey, enabled) => {
    try {
      await api.setGlobalPortBlocks({ [gameKey]: enabled })
      showMsg(`${gameKey} globally ${enabled ? 'blocked' : 'allowed'}`)
      fetchData()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleAddLanClient = async () => {
    if (!addForm.ip_address || !addForm.name) return
    setAddSaving(true)
    try {
      await api.addLanClient(addForm)
      showMsg(`LAN client ${addForm.name} added`)
      setAddModal(false)
      setAddForm({ ip_address: '', name: '', device_type: 'other' })
      fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setAddSaving(false)
    }
  }

  const handleDeleteLanClient = async (client) => {
    if (!confirm(`Remove ${client.name}?`)) return
    try {
      await api.deleteLanClient(client.lan_id)
      showMsg(`${client.name} removed`)
      fetchData()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDetect = async () => {
    setDetecting(true)
    try {
      const result = await api.detectNewGames()
      const count = result.auto_detected?.length || 0
      showMsg(count > 0 ? `Detected ${count} new game(s)` : 'No new games detected')
      fetchData()
    } catch (e) {
      setError(e.message)
    } finally {
      setDetecting(false)
    }
  }

  // Bulk block all for a game
  const handleBlockAllGame = async (gameKey, block) => {
    if (!data?.clients) return
    const ips = data.clients.map(c => c.ip)
    try {
      await api.bulkPortBlocks(ips, { [gameKey]: block })
      showMsg(`${gameKey} ${block ? 'blocked' : 'allowed'} for all clients`)
      fetchData()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    )
  }

  const clients = data?.clients || []
  const games = data?.games || []
  const globalBlocks = data?.global_blocks || {}

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.ip.includes(search)
  )

  const wgClients = filtered.filter(c => c.type === 'wireguard')
  const lanClients = filtered.filter(c => c.type === 'lan')

  const DEVICE_ICONS = { phone: Smartphone, tablet: Smartphone, laptop: Laptop, desktop: Monitor, tv: Tv, other: Globe }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-100 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-orange-400" />
            Port Blocking
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            Block game ports via iptables — works even when games bypass DNS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDetect} disabled={detecting}
            className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 text-dark-200 border border-dark-700 rounded-lg text-sm transition-colors">
            <ScanSearch className={`w-4 h-4 text-primary-400 ${detecting ? 'animate-pulse' : ''}`} />
            <span className="hidden sm:inline">{detecting ? 'Detecting…' : 'Detect Games'}</span>
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 text-dark-200 border border-dark-700 rounded-lg text-sm transition-colors">
            <Zap className={`w-4 h-4 text-amber-400 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Rules'}</span>
          </button>
          <button onClick={() => setAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm transition-colors">
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">Add LAN Client</span>
            <span className="sm:hidden">+PC</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 text-green-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" /> {message}
        </div>
      )}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg px-4 py-2 text-danger-400 text-sm flex items-center gap-2">
          <ShieldOff className="w-4 h-4" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Global Game Defaults */}
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-3">Game Port Definitions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {games.map(game => {
            const Icon = GAME_ICONS[game.icon] || Gamepad2
            const isBlocked = globalBlocks[game.key] ?? game.default_blocked
            return (
              <div key={game.key}
                className={`p-3 rounded-xl border transition-all cursor-pointer group relative ${
                  isBlocked
                    ? 'bg-danger-500/10 border-danger-500/30 hover:border-danger-400/50'
                    : 'bg-dark-800/50 border-dark-700 hover:border-dark-500'
                }`}
                onClick={() => setGameModal(game)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isBlocked ? 'bg-danger-500/20' : 'bg-dark-700'
                  }`}>
                    <Icon className="w-4 h-4" style={{ color: game.color }} />
                  </div>
                  <span className="text-sm font-semibold text-dark-100 truncate flex-1">{game.label}</span>
                  <Info className="w-3.5 h-3.5 text-dark-500 group-hover:text-dark-300 flex-shrink-0" />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    isBlocked
                      ? 'bg-danger-500/20 text-danger-400'
                      : 'bg-green-500/20 text-green-400'
                  }`}>
                    {isBlocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    {isBlocked ? 'Blocked' : 'Allowed'}
                  </span>
                  <span className={`text-[11px] font-mono ${
                    game.dns_only ? 'text-yellow-500' : 'text-dark-400'
                  }`}>
                    {game.dns_only ? 'DNS only' : `${game.port_count} ports`}
                  </span>
                </div>
                {game.hits_24h > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-dark-700/40">
                    <Activity className="w-3 h-3 text-orange-400" />
                    <span className="text-[11px] text-orange-400 font-mono">{formatNumber(game.hits_24h)} hits</span>
                    <span className="text-dark-600 text-[10px] ml-0.5">24h</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-dark-500 mt-2">Click a card to view details &amp; toggle. Per-client overrides in the peer list below.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input type="text" placeholder="Search clients..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-dark-900 border border-dark-800 rounded-lg text-dark-200 text-sm focus:border-primary-500 focus:outline-none"
        />
      </div>

      {/* WireGuard Peers */}
      {wgClients.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary-400" /> WireGuard Peers ({wgClients.length})
          </h2>
          <div className="space-y-2">
            {wgClients.map(client => (
              <ClientRow key={client.ip} client={client} games={games} globalBlocks={globalBlocks}
                onEdit={() => openClientModal(client)} clickable />
            ))}
          </div>
        </div>
      )}

      {/* LAN Clients */}
      <div>
        <h2 className="text-sm font-semibold text-dark-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-green-400" /> LAN Clients ({lanClients.length})
        </h2>
        {lanClients.length === 0 ? (
          <div className="bg-dark-900 border border-dark-800 rounded-xl p-6 text-center text-dark-400 text-sm">
            No LAN clients added yet. Click "Add LAN Client" to add devices on your local network.
          </div>
        ) : (
          <div className="space-y-2">
            {lanClients.map(client => (
              <ClientRow key={client.ip} client={client} games={games} globalBlocks={globalBlocks}
                onEdit={() => openClientModal(client)}
                onDelete={client.type === 'lan' ? () => handleDeleteLanClient(client) : null} />
            ))}
          </div>
        )}
      </div>

      {/* Game Detail Modal */}
      {gameModal && (() => {
        const game = gameModal
        const Icon = GAME_ICONS[game.icon] || Gamepad2
        const isBlocked = globalBlocks[game.key] ?? game.default_blocked
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setGameModal(null)}>
            <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-dark-700">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isBlocked ? 'bg-danger-500/20' : 'bg-dark-700'
                  }`}>
                    <Icon className="w-5 h-5" style={{ color: game.color }} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{game.label}</h3>
                    {game.description && <p className="text-dark-400 text-xs mt-0.5">{game.description}</p>}
                  </div>
                </div>
                <button onClick={() => setGameModal(null)} className="p-1 text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Status + toggle */}
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isBlocked ? 'bg-danger-500/10 border-danger-500/30' : 'bg-green-500/10 border-green-500/30'
                }`}>
                  <div>
                    <p className="text-sm font-medium text-dark-200">Global Default</p>
                    <p className="text-xs text-dark-500">Applies to all clients unless overridden per-peer</p>
                  </div>
                  <button
                    onClick={() => handleGlobalToggle(game.key, !isBlocked)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      isBlocked ? 'bg-danger-500' : 'bg-dark-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      isBlocked ? 'left-[26px]' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-dark-800 rounded-xl p-3 text-center">
                    <p className="text-white font-bold text-lg">{game.port_count || 0}</p>
                    <p className="text-dark-400 text-xs">Port rules</p>
                  </div>
                  <div className="bg-dark-800 rounded-xl p-3 text-center">
                    <p className="text-white font-bold text-lg">{(game.domains || []).length}</p>
                    <p className="text-dark-400 text-xs">Domains</p>
                  </div>
                  <div className="bg-dark-800 rounded-xl p-3 text-center">
                    <p className={`font-bold text-lg ${game.hits_24h > 0 ? 'text-orange-400' : 'text-dark-500'}`}>{formatNumber(game.hits_24h || 0)}</p>
                    <p className="text-dark-400 text-xs">Hits 24h</p>
                  </div>
                </div>

                {/* Port ranges */}
                {(game.ports || []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5" /> Port Ranges
                    </h4>
                    <div className="space-y-1.5">
                      {game.ports.map((p, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-dark-800 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono uppercase ${
                              p.proto === 'tcp' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                            }`}>{p.proto}</span>
                            <span className="text-dark-200 font-mono text-sm">{p.range}</span>
                          </div>
                          <span className="text-dark-500 text-xs truncate ml-2 max-w-[160px]">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Domains */}
                {(game.domains || []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5" /> DNS Domains
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {game.domains.map((d, i) => (
                        <span key={i} className="text-[11px] font-mono px-2 py-0.5 bg-dark-800 border border-dark-700 rounded text-dark-300">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Client Edit Modal */}
      {clientModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setClientModal(null)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <div>
                <h3 className="text-white font-semibold">Port Blocking — {clientModal.name}</h3>
                <p className="text-dark-500 text-xs flex items-center gap-1 mt-0.5">
                  {clientModal.type === 'wireguard'
                    ? <><Wifi className="w-3 h-3 text-primary-400" /> WireGuard peer</>
                    : <><Monitor className="w-3 h-3 text-green-400" /> LAN client</>}
                  <span className="text-dark-600">· {clientModal.ip}</span>
                </p>
              </div>
              <button onClick={() => setClientModal(null)} className="p-1 text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {games.map(game => {
                const Icon = GAME_ICONS[game.icon] || Gamepad2
                const isBlocked = clientGames[game.key] ?? (globalBlocks[game.key] ?? game.default_blocked)
                return (
                  <div key={game.key}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isBlocked ? 'bg-danger-500/10 border-danger-500/30' : 'bg-dark-800/50 border-dark-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isBlocked ? 'bg-danger-500/20' : 'bg-dark-700'
                      }`}>
                        <Icon className="w-5 h-5" style={{ color: game.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-dark-200">{game.label}</div>
                        <div className="text-xs text-dark-500">
                          {game.dns_only ? 'DNS blocking only' : `${game.port_count || 0} ports`}
                          {game.hits_24h > 0 && <span className="ml-1.5 text-orange-400">{game.hits_24h} hits 24h</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setClientGames(prev => ({ ...prev, [game.key]: !isBlocked }))}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                        isBlocked ? 'bg-danger-500' : 'bg-dark-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                        isBlocked ? 'left-[26px]' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-2 p-4 border-t border-dark-700">
              <button onClick={saveClientGames} disabled={clientSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-medium transition-colors">
                {clientSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </button>
              <button onClick={() => { const all = {}; games.forEach(g => all[g.key] = true); setClientGames(all) }}
                className="px-3 py-2.5 bg-danger-600 hover:bg-danger-500 text-white rounded-xl text-xs font-medium">Block All</button>
              <button onClick={() => { const all = {}; games.forEach(g => all[g.key] = false); setClientGames(all) }}
                className="px-3 py-2.5 bg-dark-700 hover:bg-dark-600 text-dark-200 rounded-xl text-xs font-medium">Allow All</button>
            </div>
          </div>
        </div>
      )}

      {/* Add LAN Client Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setAddModal(false)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <h3 className="text-white font-semibold">Add LAN Client</h3>
              <button onClick={() => setAddModal(false)} className="p-1 text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1">IP Address</label>
              <input type="text" placeholder="192.168.1.100"
                value={addForm.ip_address} onChange={e => setAddForm(f => ({ ...f, ip_address: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-200 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Name</label>
              <input type="text" placeholder="Living Room TV"
                value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-200 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Device Type</label>
              <select value={addForm.device_type} onChange={e => setAddForm(f => ({ ...f, device_type: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-200 text-sm focus:border-primary-500 focus:outline-none">
                <option value="phone">Phone</option>
                <option value="tablet">Tablet</option>
                <option value="laptop">Laptop</option>
                <option value="desktop">Desktop</option>
                <option value="tv">TV</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button onClick={handleAddLanClient} disabled={addSaving || !addForm.ip_address || !addForm.name}
              className="w-full btn bg-primary-600 hover:bg-primary-500 text-white flex items-center justify-center gap-2">
              {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Client
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Client row component
function ClientRow({ client, games, globalBlocks, onEdit, onDelete, clickable }) {
  const blockedGames = games.filter(g => client.port_blocks?.[g.key] ?? (globalBlocks[g.key] ?? g.default_blocked))

  return (
    <div
      className={`bg-dark-900 border border-dark-800 rounded-xl p-3 flex items-center justify-between transition-colors ${clickable ? 'cursor-pointer hover:border-primary-500/30 hover:bg-dark-850' : 'hover:bg-dark-850'}`}
      onClick={clickable ? onEdit : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${client.type === 'wireguard'
          ? 'bg-primary-500/20 text-primary-400' : 'bg-green-500/20 text-green-400'}`}>
          {client.type === 'wireguard' ? <Wifi className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-dark-200 truncate">{client.name}</div>
          <div className="text-xs text-dark-500">{client.ip}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Game status indicators */}
        <div className="hidden sm:flex items-center gap-1">
          {games.map(game => {
            const Icon = GAME_ICONS[game.icon] || Gamepad2
            const isBlocked = client.port_blocks?.[game.key] ?? (globalBlocks[game.key] ?? game.default_blocked)
            return (
              <div key={game.key} title={`${game.label}: ${isBlocked ? 'Blocked' : 'Allowed'}`}
                className={`w-6 h-6 rounded flex items-center justify-center ${isBlocked
                  ? 'bg-danger-500/20 text-danger-400' : 'bg-dark-800 text-dark-500'}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            )
          })}
        </div>

        {/* Blocked count for mobile */}
        <span className="sm:hidden text-xs px-2 py-0.5 rounded-full bg-danger-500/20 text-danger-400">
          {blockedGames.length}/{games.length} blocked
        </span>

        <button onClick={(e) => { if (clickable) e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-dark-200 transition-colors">
          <Edit3 className="w-4 h-4" />
        </button>

        {onDelete && (
          <button onClick={(e) => { if (clickable) e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-danger-500/20 text-dark-400 hover:text-danger-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
