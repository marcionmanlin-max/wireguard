import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { 
  ShieldCheck, ShieldX, Plus, Trash2, Search, RefreshCw, X, Upload
} from 'lucide-react'

export default function Domains() {
  const [activeTab, setActiveTab] = useState('whitelist')
  const [domains, setDomains] = useState({ domains: [], total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newDomain, setNewDomain] = useState({ domain: '', comment: '' })
  const [error, setError] = useState(null)

  const fetchDomains = async (page = 1) => {
    setLoading(true)
    try {
      const params = { page, limit: 50 }
      if (search) params.search = search
      const data = await api.getDomains(activeTab, params)
      setDomains(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDomains() }, [activeTab])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchDomains()
  }

  const addDomain = async (e) => {
    e.preventDefault()
    try {
      const result = await api.addDomain(activeTab, newDomain)
      setNewDomain({ domain: '', comment: '' })
      setShowAdd(false)
      fetchDomains()
      if (result.errors?.length > 0) {
        setError(`Added ${result.added}, errors: ${result.errors.join(', ')}`)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteDomain = async (id) => {
    try {
      await api.deleteDomain(activeTab, id)
      fetchDomains(domains.page)
    } catch (err) {
      setError(err.message)
    }
  }

  const tabs = [
    { id: 'whitelist', label: 'Whitelist', icon: ShieldCheck, color: 'text-primary-400' },
    { id: 'blacklist', label: 'Custom Blacklist', icon: ShieldX, color: 'text-danger-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Domain Lists</h2>
          <p className="text-dark-400 text-sm mt-1">Custom whitelist and blacklist management</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Domain
        </button>
      </div>

      {error && (
        <div className="bg-danger-500/10 border border-danger-500/30 rounded-lg p-3 flex items-center gap-3 text-sm">
          <span className="text-danger-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-dark-400" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-dark-700 pb-0">
        {tabs.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setSearch('') }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? `${color} border-current`
                : 'text-dark-400 border-transparent hover:text-dark-200'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Add Domain Form */}
      {showAdd && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">
            Add to {activeTab === 'whitelist' ? 'Whitelist' : 'Blacklist'}
          </h3>
          <form onSubmit={addDomain} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1">
                Domain(s) — separate multiple with commas or newlines
              </label>
              <textarea
                value={newDomain.domain}
                onChange={e => setNewDomain(prev => ({ ...prev, domain: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 h-24 font-mono"
                placeholder="example.com&#10;ads.example.com&#10;tracker.example.org"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Comment (optional)</label>
              <input
                type="text"
                value={newDomain.comment}
                onChange={e => setNewDomain(prev => ({ ...prev, comment: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
                placeholder="Why this domain is listed"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                <Upload className="w-4 h-4 inline mr-2" />Add Domain(s)
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-dark-400 hover:text-white text-sm">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500"
            placeholder="Search domains..."
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm">
          Search
        </button>
      </form>

      {/* Domain List */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
          </div>
        ) : domains.domains.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-dark-400">No domains in {activeTab}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-dark-900 z-10">
                <tr className="border-b border-dark-700">
                  <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase">Domain</th>
                  <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase hidden md:table-cell" title="Total query matches in log">
                    {activeTab === 'whitelist' ? 'Allowed Hits' : 'Blocked Hits'}
                  </th>
                  <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase hidden sm:table-cell">Comment</th>
                  <th className="text-left p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase hidden sm:table-cell">Added</th>
                  <th className="text-right p-3 sm:p-4 text-xs font-medium text-dark-400 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {domains.domains.map(d => (
                  <tr key={d.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                    <td className="p-3 sm:p-4">
                      <div className="flex items-center gap-2">
                        <img src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`} className="w-4 h-4 rounded flex-shrink-0" onError={e => e.target.style.display='none'} />
                        <span className="text-sm text-white font-mono break-all">{d.domain}</span>
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 hidden md:table-cell">
                      <span className={`text-sm font-mono font-bold ${d.hits > 0 ? (activeTab === 'whitelist' ? 'text-green-400' : 'text-red-400') : 'text-dark-600'}`}>
                        {d.hits > 0 ? d.hits.toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 hidden sm:table-cell">
                      <span className="text-sm text-dark-400">{d.comment || '—'}</span>
                    </td>
                    <td className="p-3 sm:p-4 hidden sm:table-cell">
                      <span className="text-sm text-dark-400">{new Date(d.created_at).toLocaleDateString()}</span>
                    </td>
                    <td className="p-3 sm:p-4 text-right">
                      <button
                        onClick={() => deleteDomain(d.id)}
                        className="p-2 text-dark-400 hover:text-danger-400 rounded-lg hover:bg-dark-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            {domains.pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-dark-700">
                <span className="text-sm text-dark-400">{domains.total} total domains</span>
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(domains.pages, 10) }, (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => fetchDomains(i + 1)}
                      className={`px-3 py-1 rounded text-sm ${
                        domains.page === i + 1
                          ? 'bg-primary-600 text-white'
                          : 'text-dark-400 hover:text-white hover:bg-dark-700'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
