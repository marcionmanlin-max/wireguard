import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import { 
  Settings, Save, RefreshCw, Server, Shield, Database,
  Globe, AlertTriangle, CheckCircle, X, Crosshair,
  Gamepad2, Heart, DollarSign, Video, Users, Ban,
  Loader2, ChevronRight, Eye, Search, Film, ShieldAlert, Activity
} from 'lucide-react'
import { formatNumber } from '../utils/helpers'
import Modal from './Modal'

const CATEGORY_META = {
  social: { label: 'Social Media', desc: 'Facebook, Twitter, Instagram, TikTok, Snapchat, Reddit, Discord, WhatsApp &amp; more', icon: Users, color: 'text-primary-400' },
  streaming: { label: 'Streaming', desc: 'YouTube, Netflix, Disney+, Hulu, Twitch, Spotify, HBO Max, Apple TV+ &amp; more', icon: Video, color: 'text-danger-400' },
  gaming: { label: 'Gaming', desc: 'Steam, Epic, PUBG, Mobile Legends, Roblox, Valorant, Genshin Impact &amp; more', icon: Gamepad2, color: 'text-primary-400' },
  gambling: { label: 'Gambling', desc: 'Bet365, PokerStars, DraftKings, FanDuel, Stake, 1xBet &amp; more', icon: DollarSign, color: 'text-yellow-400' },
  movies: { label: 'Movies & TV', desc: 'Netflix, Disney+, HBO Max, Hulu, Prime Video, Apple TV+, iWantTFC, Viu &amp; more', icon: Film, color: 'text-purple-400' },
  porn: { label: 'Adult Content', desc: 'Top 20 adult/NSFW websites', icon: Ban, color: 'text-danger-400' },
  dating: { label: 'Dating', desc: 'Tinder, Bumble, Match, OkCupid, Hinge, Grindr &amp; more', icon: Heart, color: 'text-pink-400' },
  messaging: { label: 'Messaging', desc: 'WhatsApp, Telegram, Messenger, Signal, Viber, Line, Skype, Slack, Teams &amp; more', icon: Globe, color: 'text-green-400' },
  ads: { label: 'Ads & Tracking', desc: 'Google Ads, DoubleClick, Facebook Pixel, TikTok Ads, Criteo, Taboola — always on for all peers', icon: ShieldAlert, color: 'text-orange-400' },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({})
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [detectingIp, setDetectingIp] = useState(false)
  const [togglingCategory, setTogglingCategory] = useState(null)
  const [categoryModal, setCategoryModal] = useState(null)
  const [togglingDomain, setTogglingDomain] = useState(null)
  const [domainSearch, setDomainSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('all') // 'all' | 'blocked' | 'allowed'
  const [flushModal, setFlushModal] = useState(false)

  const fetchAll = async () => {
    try {
      const [settingsData, catData] = await Promise.all([
        api.getSettings(),
        api.getCategories().catch(() => []),
      ])
      setSettings(settingsData)
      setCategories(Array.isArray(catData) ? catData : (catData.categories || []))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const showMsg = (msg) => { setMessage(msg); setTimeout(() => setMessage(null), 3000) }

  const saveSettings = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateSettings(settings)
      showMsg('Settings saved successfully')
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  const updateField = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const detectPublicIp = async () => {
    setDetectingIp(true)
    try {
      const data = await api.getPublicIp()
      if (data.detected && data.ip) {
        updateField('wg_endpoint', data.ip)
        showMsg(`Public IP detected: ${data.ip}`)
      } else {
        setError('Could not detect public IP')
      }
    } catch (err) { setError(err.message) }
    finally { setDetectingIp(false) }
  }

  const toggleCategory = async (key, currentEnabled) => {
    setTogglingCategory(key)
    try {
      await api.toggleCategory(key, !currentEnabled)
      setCategories(prev => prev.map(c => c.key === key ? { ...c, enabled: !currentEnabled, domains: c.domains.map(d => ({ ...d, blocked: !currentEnabled })), blocked_count: !currentEnabled ? c.total_groups : 0 } : c))
      // Update modal if open
      setCategoryModal(prev => prev && prev.key === key ? { ...prev, enabled: !currentEnabled, domains: prev.domains.map(d => ({ ...d, blocked: !currentEnabled })), blocked_count: !currentEnabled ? prev.total_groups : 0 } : prev)
      showMsg(`${CATEGORY_META[key]?.label || key} ${!currentEnabled ? 'blocked' : 'allowed'}`)
    } catch (err) { setError(err.message) }
    finally { setTogglingCategory(null) }
  }

  const toggleDomain = async (categoryKey, domain) => {
    const domainId = `${categoryKey}:${domain.display}`
    setTogglingDomain(domainId)
    try {
      const newBlocked = !domain.blocked
      await api.toggleCategoryDomain(categoryKey, domain.display, newBlocked)
      
      // Update domain state in categories
      const updateDomains = (domains) => domains.map(d => d.display === domain.display ? { ...d, blocked: newBlocked } : d)
      setCategories(prev => prev.map(c => {
        if (c.key !== categoryKey) return c
        const newDomains = updateDomains(c.domains)
        const blockedCount = newDomains.filter(d => d.blocked).length
        return { ...c, domains: newDomains, blocked_count: blockedCount, enabled: blockedCount > 0 }
      }))
      // Update modal
      setCategoryModal(prev => {
        if (!prev || prev.key !== categoryKey) return prev
        const newDomains = updateDomains(prev.domains)
        const blockedCount = newDomains.filter(d => d.blocked).length
        return { ...prev, domains: newDomains, blocked_count: blockedCount, enabled: blockedCount > 0 }
      })
    } catch (err) { setError(err.message) }
    finally { setTogglingDomain(null) }
  }

  const restartDns = async () => {
    try { await api.restartDns(); showMsg('DNS service restarted') }
    catch (err) { setError(err.message) }
  }

  const flushLogs = () => setFlushModal(true)

  const doFlushLogs = async () => {
    try { const r = await api.flushLogs(); showMsg(r.message) }
    catch (err) { setError(err.message) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-primary-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Settings className="w-6 h-6 text-primary-400" /> Settings</h2>
        <p className="text-dark-400 text-sm mt-1">Configure DNS, blocking categories, and WireGuard</p>
      </div>

      {message && (
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 flex items-center gap-3 text-sm animate-pulse">
          <CheckCircle className="w-4 h-4 text-primary-400" />
          <span className="text-primary-300">{message}</span>
        </div>
      )}
      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-danger-400" />
          <span className="text-danger-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-dark-400" /></button>
        </div>
      )}

      {/* Category Blocking - Auto-save toggles */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-5 h-5 text-primary-400" />
          <h3 className="text-white font-semibold">Category Blocking</h3>
        </div>
        <p className="text-dark-500 text-xs mb-5">Toggle categories to instantly block/unblock entire domain groups. Click a card to view all domains.</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {categories.map(cat => {
            const meta = CATEGORY_META[cat.key] || { label: cat.label, desc: '', icon: Ban, color: 'text-dark-300' }
            const Icon = meta.icon
            const isToggling = togglingCategory === cat.key
            return (
              <div key={cat.key} className={`border rounded-xl p-4 transition-all cursor-pointer hover:scale-[1.02] ${cat.enabled ? 'bg-danger-400/5 border-danger-400/30' : 'bg-dark-800/50 border-dark-700 hover:border-dark-500'}`}
                onClick={() => setCategoryModal(cat)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${meta.color}`} />
                    <span className="text-white font-medium text-sm">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-dark-600" />
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCategory(cat.key, cat.enabled) }}
                      disabled={isToggling}
                      className={`relative w-11 h-6 rounded-full transition-all ${cat.enabled ? 'bg-danger-400' : 'bg-dark-600'}`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin absolute top-1 left-1/2 -translate-x-1/2" />
                      ) : (
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow`} style={{ left: cat.enabled ? '22px' : '2px' }}></span>
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-dark-500 text-xs line-clamp-2">{meta.desc}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-dark-600 text-[10px]">{cat.domain_count} domains &middot; {cat.enabled ? <span className="text-danger-400">{cat.blocked_count || cat.total_groups} blocked</span> : <span className="text-primary-400">All Allowed</span>}</p>
                  {cat.hits_24h > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-orange-400">
                      <Activity className="w-2.5 h-2.5" />
                      {formatNumber(cat.hits_24h)} hits
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Category Domain Modal - Individual Toggles */}
      {categoryModal && (() => {
        const allDomains = categoryModal.domains || []
        const filteredDomains = allDomains
          .filter(d => domainFilter === 'all' ? true : domainFilter === 'blocked' ? d.blocked : !d.blocked)
          .filter(d => !domainSearch || d.display.toLowerCase().includes(domainSearch.toLowerCase()))
        const blockedCount = allDomains.filter(d => d.blocked).length
        const allowedCount = allDomains.filter(d => !d.blocked).length
        const totalGroups = categoryModal.total_groups || allDomains.length
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => { setCategoryModal(null); setDomainSearch(''); setDomainFilter('all') }}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-lg max-h-[80vh] m-4 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-dark-700">
              <div className="flex items-center gap-3">
                {(() => { const M = CATEGORY_META[categoryModal.key]; const I = M?.icon || Ban; return <I className={`w-5 h-5 ${M?.color || 'text-dark-300'}`} /> })()}
                <div>
                  <h3 className="text-white font-bold text-lg">{categoryModal.label}</h3>
                  <p className="text-dark-500 text-xs">
                    {blockedCount}/{totalGroups} sites blocked
                    {blockedCount > 0 && blockedCount < totalGroups && <span className="text-yellow-400 ml-1"> (partial)</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => { setCategoryModal(null); setDomainSearch(''); setDomainFilter('all') }} className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Search + Filter tabs */}
            <div className="px-5 pt-4 pb-2 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={domainSearch}
                  onChange={e => setDomainSearch(e.target.value)}
                  placeholder="Search domains..."
                  className="w-full pl-9 pr-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 placeholder-dark-500"
                />
              </div>
              <div className="flex gap-1">
                {[
                  { key: 'all', label: 'All', count: allDomains.length },
                  { key: 'blocked', label: 'Blocked', count: blockedCount },
                  { key: 'allowed', label: 'Allowed', count: allowedCount },
                ].map(f => (
                  <button key={f.key} onClick={() => setDomainFilter(f.key)} className={'px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (domainFilter === f.key
                    ? f.key === 'blocked' ? 'bg-danger-400/20 text-danger-300 border border-danger-400/30'
                      : f.key === 'allowed' ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                      : 'bg-dark-700 text-white border border-dark-600'
                    : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800 border border-transparent'
                  )}>
                    {f.label} <span className="ml-1 opacity-60">{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 pb-2 overflow-y-auto flex-1 scrollbar-thin">
              <div className="grid grid-cols-1 gap-1">
                {filteredDomains.map((domain, i) => {
                  const domainId = `${categoryModal.key}:${domain.display}`
                  const isToggling = togglingDomain === domainId
                  return (
                    <div key={i} className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm ${domain.blocked ? 'bg-danger-400/5' : 'bg-dark-800/30'} hover:bg-dark-800/60 transition-colors`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${domain.blocked ? 'bg-danger-400' : 'bg-primary-400'}`}></div>
                        <span className="text-dark-200 font-mono text-xs truncate">{domain.display}</span>
                        {domain.domains.length > 1 && (
                          <span className="text-dark-600 text-[10px] flex-shrink-0">+{domain.domains.length - 1} sub</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleDomain(categoryModal.key, domain)}
                        disabled={isToggling}
                        className={`relative w-10 h-5.5 rounded-full transition-all flex-shrink-0 ml-3 ${domain.blocked ? 'bg-danger-400' : 'bg-dark-600'}`}
                        style={{ width: '40px', height: '22px' }}
                      >
                        {isToggling ? (
                          <Loader2 className="w-3.5 h-3.5 text-white animate-spin absolute top-[3px] left-1/2 -translate-x-1/2" />
                        ) : (
                          <span className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-all shadow`} style={{ left: domain.blocked ? '19px' : '2px' }}></span>
                        )}
                      </button>
                    </div>
                  )
                })}
                {filteredDomains.length === 0 && (
                  <p className="text-dark-500 text-xs text-center py-4">No domains match your search</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-dark-700 flex items-center justify-between">
              <span className="text-dark-500 text-xs">{blockedCount} of {totalGroups} blocked</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { toggleCategory(categoryModal.key, true) }}
                  disabled={togglingCategory === categoryModal.key || blockedCount === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-primary-400/15 text-primary-400 border border-primary-400/30 hover:bg-primary-400/25 disabled:opacity-30"
                >
                  {togglingCategory === categoryModal.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Allow All
                </button>
                <button
                  onClick={() => { toggleCategory(categoryModal.key, false) }}
                  disabled={togglingCategory === categoryModal.key || blockedCount === totalGroups}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-danger-400/15 text-danger-400 border border-danger-400/30 hover:bg-danger-400/25 disabled:opacity-30"
                >
                  {togglingCategory === categoryModal.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Block All
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      })()}

      <form onSubmit={saveSettings} className="space-y-6">
        {/* DNS Settings */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Server className="w-5 h-5 text-primary-400" />
            <h3 className="text-white font-semibold">DNS Settings</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm text-dark-300 mb-1">Upstream DNS (comma separated)</label>
              <input type="text" value={settings.upstream_dns || ''} onChange={e => updateField('upstream_dns', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" placeholder="8.8.8.8,8.8.4.4,1.1.1.1" />
              <p className="text-dark-500 text-xs mt-1">Forwarded to IonMan Resolver → these servers. Chain: dns_proxy → dnsmasq → resolver → upstream</p>
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">DNS Port</label>
              <input type="number" value={settings.dns_port || '53'} onChange={e => updateField('dns_port', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Cache Size</label>
              <input type="number" value={settings.cache_size || '1000'} onChange={e => updateField('cache_size', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Blocking Mode</label>
              <select value={settings.blocking_mode || '0.0.0.0'} onChange={e => updateField('blocking_mode', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500">
                <option value="0.0.0.0">NULL (0.0.0.0) — recommended</option>
                <option value="127.0.0.1">Loopback (127.0.0.1)</option>
                <option value="#">NXDOMAIN</option>
              </select>
            </div>
          </div>
        </div>

        {/* Blocking Settings */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5 text-primary-400" />
            <h3 className="text-white font-semibold">Blocking</h3>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.blocking_enabled === '1'} onChange={e => updateField('blocking_enabled', e.target.checked ? '1' : '0')} className="w-4 h-4 rounded border-dark-600 text-primary-600 focus:ring-primary-500 bg-dark-800" />
              <span className="text-dark-200 text-sm">Enable DNS blocking</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.log_queries === '1'} onChange={e => updateField('log_queries', e.target.checked ? '1' : '0')} className="w-4 h-4 rounded border-dark-600 text-primary-600 focus:ring-primary-500 bg-dark-800" />
              <span className="text-dark-200 text-sm">Log DNS queries</span>
            </label>
          </div>
        </div>

        {/* Log Settings */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Database className="w-5 h-5 text-primary-400" />
            <h3 className="text-white font-semibold">Logs & Data</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm text-dark-300 mb-1">Log Retention (days)</label>
              <input type="number" value={settings.log_retention_days || '30'} onChange={e => updateField('log_retention_days', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={flushLogs} className="px-4 py-2 bg-primary-500/10 border border-primary-500/30 text-primary-400 rounded-lg hover:bg-primary-500/20 text-sm">Flush Old Logs</button>
            </div>
          </div>
        </div>

        {/* WireGuard Settings */}
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <Globe className="w-5 h-5 text-primary-400" />
            <h3 className="text-white font-semibold">WireGuard VPN</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm text-dark-300 mb-1">Public Endpoint (IP or hostname)</label>
              <div className="flex gap-2">
                <input type="text" value={settings.wg_endpoint || ''} onChange={e => updateField('wg_endpoint', e.target.value)} className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" placeholder="your.server.ip or domain.com" />
                <button type="button" onClick={detectPublicIp} disabled={detectingIp} className="flex items-center gap-1.5 px-3 py-2 bg-primary-500/10 border border-primary-500/30 text-primary-400 rounded-lg hover:bg-primary-500/20 text-sm whitespace-nowrap disabled:opacity-50" title="Auto-detect public IP">
                  {detectingIp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  Detect
                </button>
              </div>
              <p className="text-dark-500 text-xs mt-1">The public IP/domain clients will connect to</p>
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Listen Port</label>
              <input type="number" value={settings.wg_listen_port || '51820'} onChange={e => updateField('wg_listen_port', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Server IP / Subnet</label>
              <input type="text" value={settings.wg_server_ip || '10.0.0.1/24'} onChange={e => updateField('wg_server_ip', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">DNS Server for Peers</label>
              <input type="text" value={settings.wg_dns || '10.0.0.1'} onChange={e => updateField('wg_dns', e.target.value)} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" />
              <p className="text-dark-500 text-xs mt-1">Should be the WireGuard server IP to use IonMan DNS+WireGuard blocking</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 flex-wrap">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button type="button" onClick={restartDns} className="flex items-center gap-2 px-4 py-2.5 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm">
            <RefreshCw className="w-4 h-4" /> Restart DNS
          </button>
        </div>
      </form>

      <Modal open={flushModal} onClose={() => setFlushModal(false)} onConfirm={doFlushLogs} title="Flush Logs" message={`Flush logs older than ${settings.log_retention_days || 30} days? This cannot be undone.`} type="warning" confirmText="Flush" />
    </div>
  )
}
