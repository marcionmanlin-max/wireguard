import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { api } from './utils/api'
import { useTheme } from './contexts/ThemeContext'
import {
  LayoutDashboard, ScrollText, Shield, Globe, List,
  Settings, Info, Zap, LogOut, Menu, X, Regex, Users, Sun, Moon,
  Gamepad2, Radio
} from 'lucide-react'

import Login from './components/Login'
import Dashboard from './components/Dashboard'
import QueryLog from './components/QueryLog'
import Blocklists from './components/Blocklists'
import Domains from './components/Domains'
import WireGuard from './components/WireGuard'
import SettingsPage from './components/Settings'
import About from './components/About'
import RegexBlocker from './components/RegexBlocker'
import Subscribers from './components/Subscribers'
import Subscribe from './components/Subscribe'
import PortBlocking from './components/PortBlocking'
import SplashScreen from './components/SplashScreen'
import Resolver from './components/Resolver'

const NAV = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/querylog', label: 'Query Log', icon: ScrollText },
  { path: '/blocklists', label: 'Blocklists', icon: Shield },
  { path: '/domains', label: 'Domains', icon: List },
  { path: '/regex', label: 'Regex / Wildcard', icon: Regex },
  { path: '/wireguard', label: 'WireGuard', icon: Globe },
  { path: '/port-blocking', label: 'Port Blocking', icon: Gamepad2 },
  { path: '/resolver', label: 'DNS Resolver', icon: Radio },
  { path: '/subscribers', label: 'Subscribers', icon: Users },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/about', label: 'About', icon: Info },
]

export default function App() {
  const [authed, setAuthed] = useState(null)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // Show splash once per browser session
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('ionman_splash_done'))
  const { theme, toggle: toggleTheme, isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  // All hooks must be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    const token = localStorage.getItem('ionman_token')
    if (!token) { setAuthed(false); return }
    api.checkAuth().then(() => setAuthed(true)).catch(() => { localStorage.removeItem('ionman_token'); setAuthed(false) })
  }, [])

  useEffect(() => {
    const handler = () => { setAuthed(false) }
    window.addEventListener('ionman-logout', handler)
    return () => window.removeEventListener('ionman-logout', handler)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Public subscribe page - no auth needed
  // With BrowserRouter basename="/dns", pathname is already stripped of the base
  if (location.pathname === '/subscribe' || location.pathname.startsWith('/subscribe/')) {
    return <Subscribe />
  }

  const handleLogout = () => {
    api.logout().catch(() => {})
    localStorage.removeItem('ionman_token')
    setAuthed(false)
  }

  if (showSplash) {
    return (
      <SplashScreen onDone={() => {
        sessionStorage.setItem('ionman_splash_done', '1')
        setShowSplash(false)
      }} />
    )
  }

  if (authed === null) {
    return <div className="min-h-screen bg-dark-950 flex items-center justify-center"><Zap className="w-10 h-10 text-primary-400 animate-pulse" /></div>
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  const sidebarContent = (
    <>
      <div
        className="flex items-center gap-3 px-4 py-5 border-b border-dark-800 cursor-pointer hover:bg-dark-800/50 transition-colors"
        onClick={() => { navigate('/'); setMobileOpen(false) }}
      >
        <div className="w-9 h-9 rounded-xl bg-dark-800 border border-primary-400/30 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 0 15px rgba(0,212,255,0.1)' }}>
          <Zap className="w-5 h-5 text-primary-400" style={{ filter: 'drop-shadow(0 0 4px #00d4ff)' }} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white whitespace-nowrap"><span className="text-primary-400">Ion</span>Man <span className="text-dark-400 font-normal text-[11px]">DNS+WG+R</span></h1>
            <p className="text-[10px] text-dark-500">DNS · VPN · Resolver</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-primary-400/10 text-primary-400 border border-primary-400/20 shadow-[0_0_8px_rgba(0,212,255,0.05)]'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50 border border-transparent'
              }`
            }
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-dark-800 space-y-1">
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-primary-400 hover:bg-primary-400/5 transition-all border border-transparent">
          {isDark ? <Sun className="w-4.5 h-4.5 flex-shrink-0" /> : <Moon className="w-4.5 h-4.5 flex-shrink-0" />}
          {!collapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-danger-400 hover:bg-danger-400/5 transition-all border border-transparent">
          <LogOut className="w-4.5 h-4.5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-dark-950 text-white">
      <div className="fixed top-0 left-0 right-0 h-14 bg-dark-950/95 backdrop-blur-sm border-b border-dark-800 flex items-center px-4 z-40 md:hidden">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 -ml-2 text-dark-400 hover:text-white">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2 ml-3 cursor-pointer" onClick={() => navigate('/')}>
          <Zap className="w-5 h-5 text-primary-400" style={{ filter: 'drop-shadow(0 0 4px #00d4ff)' }} />
          <span className="font-bold text-sm"><span className="text-primary-400">Ion</span>Man DNS+WG+R</span>
        </div>
        <div className="ml-auto">
          <button onClick={toggleTheme} className="p-2 text-dark-400 hover:text-primary-400 transition-colors">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-dark-950 border-r border-dark-800 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside className={`hidden md:flex fixed left-0 top-0 bottom-0 ${collapsed ? 'w-16' : 'w-64'} bg-dark-950 border-r border-dark-800 flex-col z-30 transition-all duration-200`}>
        {sidebarContent}
        <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-20 w-6 h-6 bg-dark-800 border border-dark-700 rounded-full flex items-center justify-center text-dark-400 hover:text-white hover:border-primary-400/30 transition-all text-xs">
          {collapsed ? '\u2192' : '\u2190'}
        </button>
      </aside>

      <main className={`pt-14 md:pt-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'} transition-all duration-200`}>
        <div className="p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/querylog" element={<QueryLog />} />
            <Route path="/blocklists" element={<Blocklists />} />
            <Route path="/domains" element={<Domains />} />
            <Route path="/regex" element={<RegexBlocker />} />
            <Route path="/wireguard" element={<WireGuard />} />
            <Route path="/port-blocking" element={<PortBlocking />} />
            <Route path="/resolver" element={<Resolver />} />
            <Route path="/subscribers" element={<Subscribers />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/subscribe" element={<Subscribe />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
