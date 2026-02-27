import { useState, useEffect } from 'react'
import { api } from '../utils/api'
import { 
  Code, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight, 
  AlertTriangle, X, CheckCircle, Zap, Play, HelpCircle
} from 'lucide-react'
import Modal from './Modal'

const PRESET_PATTERNS = [
  { pattern: '(^|\\.)ad[0-9]+\\.', comment: 'Block numbered ad servers (ad1., ad2.)', is_wildcard: false },
  { pattern: '(^|\\.)ads?\\.', comment: 'Block ads/ad subdomains', is_wildcard: false },
  { pattern: '(^|\\.)track(ing|er)?\\.', comment: 'Block tracking subdomains', is_wildcard: false },
  { pattern: '(^|\\.)telemetry\\.', comment: 'Block telemetry subdomains', is_wildcard: false },
  { pattern: '(^|\\.)analytics?\\.', comment: 'Block analytics subdomains', is_wildcard: false },
  { pattern: '(^|\\.)pixel\\.', comment: 'Block tracking pixels', is_wildcard: false },
  { pattern: '(^|\\.)banner[0-9]*\\.', comment: 'Block banner ad servers', is_wildcard: false },
  { pattern: '(^|\\.)popup[0-9]*\\.', comment: 'Block popup servers', is_wildcard: false },
  { pattern: '.*\\.doubleclick\\..*', comment: 'Block all doubleclick', is_wildcard: false },
  { pattern: '.*\\.googlesyndication\\..*', comment: 'Block Google ad syndication', is_wildcard: false },
  { pattern: '.*\\.adnxs\\..*', comment: 'Block AppNexus ads', is_wildcard: false },
  { pattern: '.*\\.moatads\\..*', comment: 'Block Moat analytics', is_wildcard: false },
  { pattern: '.*\\.outbrain\\..*', comment: 'Block Outbrain clickbait', is_wildcard: false },
  { pattern: '.*\\.taboola\\..*', comment: 'Block Taboola clickbait', is_wildcard: false },
  { pattern: '.*\\.criteo\\..*', comment: 'Block Criteo retargeting', is_wildcard: false },
]

export default function RegexBlocker() {
  const [patterns, setPatterns] = useState([])
  const [total, setTotal] = useState(0)
  const [enabledCount, setEnabledCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null })
  const [showAdd, setShowAdd] = useState(false)
  const [newPattern, setNewPattern] = useState({ pattern: '', comment: '', is_wildcard: false })
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [applying, setApplying] = useState(false)
  const [testDomain, setTestDomain] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  const fetchPatterns = async () => {
    try {
      const data = await api.getRegexPatterns()
      setPatterns(data.patterns || [])
      setTotal(data.total || 0)
      setEnabledCount(data.enabled || 0)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPatterns() }, [])

  const showMsg = (msg) => { setMessage(msg); setTimeout(() => setMessage(null), 3000) }

  const addPattern = async (e) => {
    e.preventDefault()
    try {
      await api.addRegexPattern(newPattern)
      setNewPattern({ pattern: '', comment: '', is_wildcard: false })
      setShowAdd(false)
      showMsg('Pattern added and applied')
      fetchPatterns()
    } catch (err) {
      setError(err.message)
    }
  }

  const quickAdd = async (preset) => {
    try {
      await api.addRegexPattern(preset)
      showMsg(`Added: ${preset.comment}`)
      fetchPatterns()
    } catch (err) {
      setError(err.message)
    }
  }

  const deletePattern = (id) => {
    setDeleteModal({ open: true, id })
  }

  const doDeletePattern = async () => {
    try {
      await api.deleteRegexPattern(deleteModal.id)
      showMsg('Pattern deleted')
      fetchPatterns()
    } catch (err) {
      setError(err.message)
    }
  }

  const togglePattern = async (id) => {
    try {
      await api.toggleRegexPattern(id)
      fetchPatterns()
    } catch (err) {
      setError(err.message)
    }
  }

  const applyAll = async () => {
    setApplying(true)
    try {
      const result = await api.applyRegexPatterns()
      showMsg(result.message)
      fetchPatterns()
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  const testRegex = () => {
    if (!testDomain) return
    const results = []
    for (const p of patterns) {
      if (!p.enabled) continue
      try {
        let regex = p.pattern
        if (p.is_wildcard) {
          regex = regex.replace(/\./g, '\\.').replace(/\*/g, '.*')
          regex = `^${regex}$`
        }
        const re = new RegExp(regex, 'i')
        if (re.test(testDomain)) {
          results.push(p)
        }
      } catch (e) {
        // invalid regex, skip
      }
    }
    setTestResult(results)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-primary-400 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Code className="w-6 h-6 text-primary-400" /> Regex / Wildcard Blocking
          </h2>
          <p className="text-dark-400 text-sm mt-1">
            {total} patterns · {enabledCount} enabled · Block domains matching regex patterns
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowHelp(!showHelp)} className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-400 hover:text-primary-400 transition-all">
            <HelpCircle className="w-4 h-4" />
          </button>
          <button onClick={applyAll} disabled={applying} className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 text-dark-200 rounded-lg hover:bg-dark-700 text-sm disabled:opacity-50">
            <Play className={`w-4 h-4 ${applying ? 'animate-spin' : ''}`} /> Apply All
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
            <Plus className="w-4 h-4" /> Add Pattern
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 flex items-center gap-3 text-sm">
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

      {/* Help Panel */}
      {showHelp && (
        <div className="bg-dark-900 border border-primary-400/20 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-primary-400" /> Regex Pattern Guide</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-dark-300 font-medium mb-2">Regex Syntax</p>
              <div className="space-y-1 text-dark-400 font-mono text-xs">
                <p><span className="text-primary-400">.</span> — any character</p>
                <p><span className="text-primary-400">*</span> — zero or more of previous</p>
                <p><span className="text-primary-400">+</span> — one or more of previous</p>
                <p><span className="text-primary-400">\.</span> — literal dot</p>
                <p><span className="text-primary-400">^</span> — start of string</p>
                <p><span className="text-primary-400">$</span> — end of string</p>
                <p><span className="text-primary-400">[0-9]</span> — digit</p>
                <p><span className="text-primary-400">(a|b)</span> — a or b</p>
              </div>
            </div>
            <div>
              <p className="text-dark-300 font-medium mb-2">Examples</p>
              <div className="space-y-1 text-dark-400 font-mono text-xs">
                <p><span className="text-danger-400">(^|\.)ads?\.</span> — blocks ad.x.com, ads.x.com</p>
                <p><span className="text-danger-400">.*\.doubleclick\..*</span> — blocks all doubleclick</p>
                <p><span className="text-danger-400">(^|\.)track(ing|er)?\.  </span> — blocks tracker, tracking</p>
                <p><span className="text-danger-400">.*porn.*</span> — blocks anything with "porn"</p>
                <p><span className="text-danger-400">(^|\.)ad[0-9]+\.</span> — blocks ad1., ad2., ad99.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Domain */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-primary-400" /> Test Domain</h3>
        <div className="flex gap-3">
          <input type="text" value={testDomain} onChange={e => { setTestDomain(e.target.value); setTestResult(null) }} placeholder="e.g. ads.example.com" className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 font-mono" />
          <button onClick={testRegex} className="px-4 py-2 bg-primary-600/20 border border-primary-400/30 text-primary-400 rounded-lg hover:bg-primary-600/30 text-sm">Test</button>
        </div>
        {testResult !== null && (
          <div className="mt-3">
            {testResult.length === 0 ? (
              <p className="text-dark-400 text-sm">No patterns match this domain — it would be <span className="text-primary-400 font-medium">allowed</span></p>
            ) : (
              <div>
                <p className="text-danger-400 text-sm font-medium mb-2">Matched {testResult.length} pattern(s) — would be <span className="font-bold">BLOCKED</span></p>
                {testResult.map((p, i) => (
                  <p key={i} className="text-dark-400 text-xs font-mono bg-danger-400/5 rounded px-2 py-1 mt-1">{p.pattern} — {p.comment}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Pattern Form */}
      {showAdd && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Add Regex Pattern</h3>
          <form onSubmit={addPattern} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1">Pattern</label>
              <input type="text" value={newPattern.pattern} onChange={e => setNewPattern(p => ({...p, pattern: e.target.value}))} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 font-mono" placeholder="(^|\.)ads?\." required />
            </div>
            <div>
              <label className="block text-sm text-dark-300 mb-1">Comment (optional)</label>
              <input type="text" value={newPattern.comment} onChange={e => setNewPattern(p => ({...p, comment: e.target.value}))} className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500" placeholder="Block ad subdomains" />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={newPattern.is_wildcard} onChange={e => setNewPattern(p => ({...p, is_wildcard: e.target.checked}))} className="w-4 h-4 rounded border-dark-600 text-primary-600 bg-dark-800" />
              <span className="text-dark-200 text-sm">Wildcard mode (use * instead of regex)</span>
            </label>

            {/* Quick presets */}
            <div>
              <label className="block text-sm text-dark-500 mb-2">Quick Add Presets</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_PATTERNS.map((p, i) => {
                  const alreadyAdded = patterns.some(ex => ex.pattern === p.pattern)
                  return (
                    <button key={i} type="button" onClick={() => !alreadyAdded && quickAdd(p)} disabled={alreadyAdded} className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${alreadyAdded ? 'bg-primary-400/5 border-primary-400/20 text-primary-400/50 cursor-not-allowed' : 'bg-dark-800 border-dark-600 text-dark-300 hover:text-white hover:border-primary-500/50'}`}>
                      {alreadyAdded ? '✓ ' : ''}{p.comment}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">Add Pattern</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-dark-400 hover:text-white text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Patterns List */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        {patterns.length === 0 ? (
          <div className="text-center py-12">
            <Code className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No regex patterns added yet</p>
            <p className="text-dark-500 text-sm mt-1">Add patterns to block domains matching regex rules</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left p-4 text-xs font-medium text-dark-400 uppercase">Pattern</th>
                <th className="text-left p-4 text-xs font-medium text-dark-400 uppercase">Type</th>
                <th className="text-left p-4 text-xs font-medium text-dark-400 uppercase">Comment</th>
                <th className="text-left p-4 text-xs font-medium text-dark-400 uppercase">Status</th>
                <th className="text-right p-4 text-xs font-medium text-dark-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map(p => (
                <tr key={p.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                  <td className="p-4">
                    <code className={`text-sm font-mono ${p.enabled ? 'text-danger-400' : 'text-dark-500'}`}>{p.pattern}</code>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${p.is_wildcard ? 'bg-primary-400/10 text-primary-400' : 'bg-danger-400/10 text-danger-400'}`}>
                      {p.is_wildcard ? 'Wildcard' : 'Regex'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-dark-400">{p.comment || '—'}</span>
                  </td>
                  <td className="p-4">
                    <button onClick={() => togglePattern(p.id)}>
                      {p.enabled ? (
                        <span className="flex items-center gap-1.5 text-primary-400 text-sm"><ToggleRight className="w-5 h-5" /> Enabled</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-dark-500 text-sm"><ToggleLeft className="w-5 h-5" /> Disabled</span>
                      )}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => deletePattern(p.id)} className="p-2 text-dark-400 hover:text-danger-400 rounded-lg hover:bg-dark-700" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null })} onConfirm={doDeletePattern} title="Delete Pattern" message="Delete this regex pattern?" type="danger" confirmText="Delete" />
    </div>
  )
}
