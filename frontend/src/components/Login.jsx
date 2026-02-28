import { useState } from 'react'
import { Zap, Lock, Eye, EyeOff, AlertTriangle, Smartphone, Download, Sun, Moon, Monitor } from 'lucide-react'
import { api } from '../utils/api'
import { useTheme } from '../contexts/ThemeContext'

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { toggle: toggleTheme, isDark } = useTheme()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password.trim()) return
    
    setLoading(true)
    setError('')
    
    try {
      const data = await api.login(password)
      localStorage.setItem('ionman_token', data.token)
      onLogin()
    } catch (err) {
      setError('Invalid password')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      {/* Theme Toggle */}
      <button onClick={toggleTheme} className="fixed top-4 right-4 p-2.5 rounded-xl bg-dark-900 border border-dark-700 text-dark-400 hover:text-primary-400 hover:border-primary-400/30 transition-all z-10">
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-400/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-primary-400/3 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-dark-900 border border-dark-700 mb-4 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
            <Zap className="w-9 h-9 text-primary-400" style={{ filter: 'drop-shadow(0 0 8px #00d4ff)' }} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            <span className="text-primary-400">Ion</span><span className="text-dark-100">Man</span>{' '}
            <span className="text-dark-400 font-normal text-lg">DNS+WireGuard</span>
          </h1>
          <p className="text-dark-500 text-sm mt-1">Pi-hole + AdGuard Home Alternative</p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleSubmit} className="bg-dark-900 border border-dark-700 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-4 h-4 text-primary-400" />
            <h2 className="text-white font-semibold">Authentication Required</h2>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 mb-4 bg-danger-400/10 border border-danger-400/20 rounded-lg text-sm text-danger-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="relative mb-5">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full px-4 py-3 pr-12 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-400/50 focus:ring-1 focus:ring-primary-400/20 transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-3 rounded-xl font-medium text-sm transition-all bg-primary-400/15 text-primary-400 border border-primary-400/30 hover:bg-primary-400/25 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,212,255,0.08)]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="30 70" /></svg>
                Authenticating...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Download Client Apps */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-dark-500 text-xs uppercase tracking-wider font-medium">Download Client App</p>
          <div className="flex gap-3 w-full">
            {/* Android */}
            <a
              href="/dns/api/subscribe/apk"
              className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-900 border border-dark-700 hover:border-primary-400/30 hover:bg-dark-800 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-400/10 flex items-center justify-center group-hover:bg-primary-400/20 transition-colors flex-shrink-0">
                <Smartphone className="w-4 h-4 text-primary-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold flex items-center gap-1">
                  Android <Download className="w-3 h-3 text-primary-400" />
                </p>
                <p className="text-dark-500 text-[10px] truncate">Get the APK</p>
              </div>
            </a>
            {/* Windows */}
            <a
              href="https://github.com/marcionmanlin-max/wireguard/releases/latest/download/IonManDNS-Setup-1.0.0.exe"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-dark-900 border border-dark-700 hover:border-primary-400/30 hover:bg-dark-800 transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
                <Monitor className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-semibold flex items-center gap-1">
                  Windows <Download className="w-3 h-3 text-blue-400" />
                </p>
                <p className="text-dark-500 text-[10px] truncate">Desktop App</p>
              </div>
            </a>
          </div>
          <p className="text-dark-600 text-xs">
            IonMan DNS+WireGuard &middot; Secure Admin Panel
          </p>
        </div>
      </div>
    </div>
  )
}
