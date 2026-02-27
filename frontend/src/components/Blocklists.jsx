import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { formatNumber, timeAgo } from '../utils/helpers'
import { 
  Shield, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, 
  Download, ExternalLink, AlertTriangle, X
} from 'lucide-react'
import Modal from './Modal'

export default function Blocklists() {
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newList, setNewList] = useState({ name: '', url: '' })
  const [updating, setUpdating] = useState(null)
  const [error, setError] = useState(null)
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null })

  const fetchLists = async () => {
    try {
      const data = await api.getBlocklists()
      setLists(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLists() }, [])

  const addList = async (e) => {
    e.preventDefault()
    try {
      await api.addBlocklist(newList)
      setNewList({ name: '', url: '' })
      setShowAdd(false)
      fetchLists()
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteList = (id) => {
    setConfirmModal({ open: true, id })
  }

  const doDeleteList = async () => {
    try {
      await api.deleteBlocklist(confirmModal.id)
      fetchLists()
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleList = async (id) => {
    try {
      await api.toggleBlocklist(id)
      fetchLists()
    } catch (err) {
      setError(err.message)
    }
  }

  const updateList = async (id) => {
    setUpdating(id)
    try {
      await api.updateBlocklist(id)
      fetchLists()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const updateAll = async () => {
    setUpdating('all')
    try {
      await api.updateAllLists()
      fetchLists()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  // Preset lists that can be added with one click
  const presets = [
    // Pi-hole / StevenBlack
    { name: 'Pi-hole Default', url: 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts', cat: 'Popular' },
    // AdGuard filters
    { name: 'AdGuard DNS', url: 'https://adguardteam.github.io/AdGuardSDNSFilter/Filters/filter.txt', cat: 'AdGuard' },
    { name: 'AdGuard Base', url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_2_Base/filter.txt', cat: 'AdGuard' },
    { name: 'AdGuard Mobile Ads', url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_11_Mobile/filter.txt', cat: 'AdGuard' },
    { name: 'AdGuard Tracking', url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_3_Spyware/filter.txt', cat: 'AdGuard' },
    { name: 'AdGuard Social', url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_4_Social/filter.txt', cat: 'AdGuard' },
    { name: 'AdGuard Annoyances', url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_14_Annoyances/filter.txt', cat: 'AdGuard' },
    { name: 'AdGuard Chinese', url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_224_Chinese/filter.txt', cat: 'AdGuard' },
    { name: 'AdGuard Japanese', url: 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_7_Japanese/filter.txt', cat: 'AdGuard' },
    // Popular community lists
    { name: 'OISD Full', url: 'https://big.oisd.nl/domainswild', cat: 'Popular' },
    { name: 'Energized Basic', url: 'https://block.energized.pro/basic/formats/hosts.txt', cat: 'Popular' },
    { name: 'URLhaus Malware', url: 'https://urlhaus.abuse.ch/downloads/hostfile/', cat: 'Security' },
    { name: 'NoTracking', url: 'https://raw.githubusercontent.com/notracking/hosts-blocklists/master/hostnames.txt', cat: 'Popular' },
    { name: 'Phishing Army', url: 'https://phishing.army/download/phishing_army_blocklist.txt', cat: 'Security' },
    { name: 'Dan Pollock', url: 'https://someonewhocares.org/hosts/hosts', cat: 'Popular' },
    { name: 'WindowsSpyBlocker', url: 'https://raw.githubusercontent.com/nicehash/host-block/master/hosts.txt', cat: 'Privacy' },
    { name: 'Peter Lowe Adservers', url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=0&mimetype=plaintext', cat: 'Popular' },
    { name: '1Hosts Lite', url: 'https://o0.pages.dev/Lite/hosts.txt', cat: 'Popular' },
  ]

  const presetCats = [...new Set(presets.map(p => p.cat))]

  const totalDomains = lists.reduce((sum, l) => sum + (l.domain_count || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Blocklists</h2>
          <p className="text-dark-400 text-sm mt-1">
            {lists.length} lists · {formatNumber(totalDomains)} domains
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={updateAll} 
            disabled={updating === 'all'}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${updating === 'all' ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Update All</span><span className="sm:hidden">Update</span>
          </button>
          <button 
            onClick={() => setShowAdd(true)} 
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add List</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 flex items-center gap-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-danger-400" />
          <span className="text-danger-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-dark-400" /></button>
        </div>
      )}

      {/* Add List Modal */}
      {showAdd && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Add Blocklist</h3>
          <form onSubmit={addList} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1">Name</label>
              <input
                type="text"
                value={newList.name}
                onChange={e => setNewList(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
                placeholder="My Blocklist"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">URL</label>
              <input
                type="url"
                value={newList.url}
                onChange={e => setNewList(prev => ({ ...prev, url: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
                placeholder="https://example.com/hosts.txt"
                required
              />
            </div>
            
            {/* Quick presets by category */}
            <div>
              <label className="block text-sm text-dark-300 mb-2">Quick Add Presets</label>
              {presetCats.map(cat => (
                <div key={cat} className="mb-3">
                  <p className="text-xs text-dark-500 font-medium mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {presets.filter(p => p.cat === cat).map(p => {
                      const alreadyAdded = lists.some(l => l.url === p.url)
                      return (
                        <button
                          key={p.url}
                          type="button"
                          onClick={() => !alreadyAdded && setNewList({ name: p.name, url: p.url })}
                          disabled={alreadyAdded}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                            alreadyAdded 
                              ? 'bg-primary-400/5 border-primary-400/20 text-primary-400/50 cursor-not-allowed' 
                              : 'bg-dark-800 border-dark-600 text-dark-300 hover:text-white hover:border-primary-500/50'
                          }`}
                        >
                          {alreadyAdded ? '✓ ' : ''}{p.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                Add & Download
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-dark-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Blocklists Table */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : lists.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No blocklists added yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-dark-900 z-10">
              <tr className="border-b border-dark-700">
                <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase">List</th>
                <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase">Domains</th>
                <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase hidden md:table-cell" title="Queries blocked by this list in the last 30 days">Hits (30d)</th>
                <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase hidden sm:table-cell">Updated</th>
                <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase">Status</th>
                <th className="text-right p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lists.map(list => (
                <tr key={list.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                  <td className="p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Shield className={`w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0 ${list.enabled ? 'text-primary-400' : 'text-dark-600'}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${list.enabled ? 'text-white' : 'text-dark-500'}`}>{list.name}</p>
                        <a href={list.url} target="_blank" className="text-xs text-dark-500 hover:text-primary-400 flex items-center gap-1 truncate max-w-[120px] sm:max-w-xs">
                          {list.url.replace(/https?:\/\//, '').substring(0, 50)}...
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 sm:p-4">
                    <span className="text-sm text-dark-200 font-mono">{formatNumber(list.domain_count || 0)}</span>
                  </td>
                  <td className="p-3 sm:p-4 hidden md:table-cell">
                    <span className={`text-sm font-mono font-bold ${list.hits > 0 ? 'text-red-400' : 'text-dark-600'}`}>
                      {list.hits > 0 ? formatNumber(list.hits) : '—'}
                    </span>
                  </td>
                  <td className="p-3 sm:p-4 hidden sm:table-cell">
                    <span className="text-sm text-dark-400">
                      {list.last_updated ? timeAgo(list.last_updated) : 'Never'}
                    </span>
                  </td>
                  <td className="p-3 sm:p-4">
                    <button onClick={() => toggleList(list.id)}>
                      {list.enabled ? (
                        <span className="flex items-center gap-1.5 text-primary-400 text-sm">
                          <ToggleRight className="w-5 h-5" /> <span className="hidden sm:inline">Enabled</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-dark-500 text-sm">
                          <ToggleLeft className="w-5 h-5" /> <span className="hidden sm:inline">Disabled</span>
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="p-3 sm:p-4 text-right">
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                      <button
                        onClick={() => updateList(list.id)}
                        disabled={updating === list.id}
                        className="p-1.5 sm:p-2 text-dark-400 hover:text-primary-400 rounded-lg hover:bg-dark-700"
                        title="Update"
                      >
                        <RefreshCw className={`w-4 h-4 ${updating === list.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => deleteList(list.id)}
                        className="p-1.5 sm:p-2 text-dark-400 hover:text-danger-400 rounded-lg hover:bg-dark-700"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <Modal open={confirmModal.open} onClose={() => setConfirmModal({ open: false, id: null })} onConfirm={doDeleteList} title="Delete Blocklist" message="Delete this blocklist and all its domains?" type="danger" confirmText="Delete" />
    </div>
  )
}
