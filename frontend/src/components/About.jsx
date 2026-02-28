import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'
import {
  Zap, Shield, Server, Code2, Heart, Globe, Clock, Database, Radio,
  Filter, ScrollText, Regex, Users, Gamepad2, Lock, Activity,
  CheckCircle, BarChart2, Wifi, RefreshCw, Star, Cpu, HardDrive,
  ChevronRight, Info, BookOpen, Layers, TrendingUp, ArrowRight
} from 'lucide-react'
import {
  AreaChart, Area, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell
} from 'recharts'
import { formatBytes } from '../utils/helpers'

const VERSION = '2.2.0'
const BUILD_DATE = '2026-02-28'

// ── Animated count-up ──────────────────────────────────
function useCountUp(target, duration = 1200, delay = 0) {
  const [val, setVal] = useState(0)
  const prevTarget = useRef(0)
  useEffect(() => {
    if (target == null || target === prevTarget.current) return
    const from = prevTarget.current || 0
    prevTarget.current = target
    const timer = setTimeout(() => {
      const steps = 40
      const stepMs = duration / steps
      let s = 0
      const id = setInterval(() => {
        s++
        setVal(Math.round(from + ((target - from) * s) / steps))
        if (s >= steps) { clearInterval(id); setVal(target) }
      }, stepMs)
    }, delay)
    return () => clearTimeout(timer)
  }, [target, duration, delay])
  return val
}

// ── Animated Stat ──────────────────────────────────────
function AnimStat({ value, label, color = 'text-primary-400', suffix = '', delay = 0 }) {
  const counted = useCountUp(value, 1400, delay)
  return (
    <div className="text-center">
      <p className={`text-3xl font-bold ${color} tabular-nums`}>
        {(counted ?? 0).toLocaleString()}{suffix}
      </p>
      <p className="text-dark-400 text-xs mt-1">{label}</p>
    </div>
  )
}

// ── Feature Card ───────────────────────────────────────
function FeatureCard({ icon: Icon, color, bg, title, desc, bullets }) {
  const [hovered, setHovered] = useState(false)
  const glowColor = color.includes('cyan') ? 'rgba(34,211,238,0.12)'
    : color.includes('yellow') ? 'rgba(250,204,21,0.12)'
    : color.includes('green')  ? 'rgba(74,222,128,0.12)'
    : color.includes('violet') ? 'rgba(167,139,250,0.12)'
    : color.includes('pink')   ? 'rgba(244,114,182,0.12)'
    : color.includes('orange') ? 'rgba(251,146,60,0.12)'
    : 'rgba(0,212,255,0.12)'
  return (
    <div
      className="bg-dark-900 border border-dark-700 rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 cursor-default"
      style={{
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 24px ${glowColor}` : 'none',
        borderColor: hovered ? color.replace('text-', '').replace('-400', '.3') : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg border ${bg} transition-transform duration-200`}
          style={{ transform: hovered ? 'scale(1.1)' : 'scale(1)' }}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <h4 className="text-white font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-dark-400 text-xs leading-relaxed">{desc}</p>
      <ul className="space-y-1">
        {bullets.map(b => (
          <li key={b} className="flex items-start gap-2 text-xs text-dark-300">
            <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Pipeline Step ──────────────────────────────────────
function PipelineStep({ step, label, detail, color, active }) {
  return (
    <div className={`flex items-start gap-3 transition-all duration-300 ${active ? 'opacity-100' : 'opacity-60'}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all duration-300 ${
        active ? `${color} border-current bg-dark-800 shadow-lg` : 'text-dark-600 border-dark-700 bg-dark-900'
      }`}>
        {step}
      </div>
      <div className={`flex-1 py-2.5 px-3 rounded-lg border transition-all duration-300 ${
        active ? 'bg-dark-800/80 border-dark-600' : 'bg-dark-800/30 border-dark-800'
      }`}>
        <span className={`font-medium text-sm ${active ? color : 'text-dark-500'}`}>{label}</span>
        <p className="text-dark-500 text-xs mt-0.5">{detail}</p>
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: Shield,    color: 'text-primary-400', bg: 'bg-primary-400/10 border-primary-400/20',
    title: 'Network-wide DNS Blocking',
    desc: 'Every device on your network — phones, smart TVs, IoT, laptops — is protected without installing anything on them.',
    bullets: ['Blocks ads across all browsers and apps','Eliminates in-app and YouTube ads','Stops tracking pixels and analytics beacons','Blocks known malware and phishing domains'] },
  { icon: Filter,    color: 'text-cyan-400',    bg: 'bg-cyan-400/10 border-cyan-400/20',
    title: 'Blocklist Management',
    desc: 'Subscribe to community-maintained blocklists or add your own. Auto-fetched, parsed, and loaded on a schedule.',
    bullets: ['One-click subscribe to popular lists (StevenBlack, OISD, etc.)','Auto-refresh on configurable schedule','Enable / disable lists without losing them','View domain count per list'] },
  { icon: Regex,     color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/20',
    title: 'Regex & Wildcard Rules',
    desc: 'Write regular expressions or wildcard patterns to block entire domain families that static lists miss.',
    bullets: ['Full PCRE-compatible regex support','Wildcard patterns (e.g. *.doubleclick.net)','Real-time rule testing before applying','Separate allow and block regex rules'] },
  { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20',
    title: 'Whitelist / Blacklist Control',
    desc: 'Granular per-domain control. Whitelist incorrectly blocked domains, or manually blacklist anything that slips through.',
    bullets: ['Whitelist overrides all blocklists','Add single domains or TLDs','Import / export lists','Instant effect — no restart required'] },
  { icon: ScrollText, color: 'text-violet-400', bg: 'bg-violet-400/10 border-violet-400/20',
    title: 'Query Log & Analytics',
    desc: 'Every DNS query is logged with client IP, domain, type, status, and resolution time.',
    bullets: ['Live query log with search and filter','Per-client query history','Top blocked domains and top clients','Cache hit / miss tracking'] },
  { icon: Radio,     color: 'text-green-400',   bg: 'bg-green-400/10 border-green-400/20',
    title: 'IonMan Recursive Resolver',
    desc: 'A custom Python DNS resolver with an in-memory LRU cache, dramatically reducing latency for repeated queries.',
    bullets: ['LRU cache with TTL-aware eviction','Round-robin upstream failover','DNS over TLS (DoT) support','Per-query DB logging and live stats','Cache flush on demand'] },
  { icon: Globe,     color: 'text-primary-400', bg: 'bg-primary-400/10 border-primary-400/20',
    title: 'WireGuard VPN',
    desc: 'Built-in WireGuard VPN gateway. Route DNS through IonMan from anywhere for network-level protection on the go.',
    bullets: ['Generate peer configs with QR codes','Add / remove peers from dashboard','All VPN traffic DNS-filtered automatically','Split-tunnel or full-tunnel support'] },
  { icon: Gamepad2,  color: 'text-orange-400',  bg: 'bg-orange-400/10 border-orange-400/20',
    title: 'Port Blocking',
    desc: 'Block outbound connections on specific ports network-wide using iptables rules managed from the dashboard.',
    bullets: ['Block by port and protocol (TCP/UDP)','Network-wide or per-client rules','Persists across reboots','One-click enable / disable'] },
  { icon: Users,     color: 'text-pink-400',    bg: 'bg-pink-400/10 border-pink-400/20',
    title: 'Subscriber Management',
    desc: 'Grant or revoke access, track per-subscriber usage, and assign VPN credentials — ideal for community networks.',
    bullets: ['Create and manage subscriber accounts','Assign custom DNS and VPN settings','Self-service subscriber portal','Usage tracking per subscriber'] },
  { icon: BarChart2, color: 'text-primary-400', bg: 'bg-primary-400/10 border-primary-400/20',
    title: 'Real-time Dashboard',
    desc: 'A live, auto-refreshing dashboard showing queries, block rate, active clients, top domains, and system health.',
    bullets: ['Auto-refreshes every 5 seconds','Top blocked and top allowed domains','Per-client traffic breakdown','CPU, memory, and uptime monitoring'] },
]

const ADVANTAGES = [
  { icon: Layers,    title: 'All-in-One Stack',      desc: 'DNS blocking + VPN + recursive resolver + subscriber management in a single deployment.' },
  { icon: Zap,       title: 'Low Latency Caching',   desc: 'IonMan Resolver caches in memory with TTL-aware LRU eviction. Repeated queries resolve in under 1ms.' },
  { icon: Lock,      title: 'Privacy by Design',     desc: 'DNS queries never leave your server unencrypted. DNS over TLS to upstreams. No third-party cloud.' },
  { icon: RefreshCw, title: 'Auto-updating Lists',   desc: 'Subscribe once, stay protected. Lists are re-fetched and reloaded automatically on schedule.' },
  { icon: Star,      title: 'YouTube & App Ads',     desc: 'Blocks ad domains used by YouTube, Spotify, and mobile apps — coverage browser blockers can\'t reach.' },
  { icon: Activity,  title: 'Full Observability',    desc: 'Every query is stored with timestamp, client IP, type, cache status, and upstream latency.' },
  { icon: Server,    title: 'Self-hosted',           desc: 'Runs on your own hardware. No subscriptions, no cloud dependency, no data sent to third parties.' },
  { icon: Wifi,      title: 'Whole-home Coverage',   desc: 'Configure your router to use IonMan as DNS and every device is protected with zero per-device setup.' },
]

const TECH_STACK = [
  { name: 'React 18 + Vite 6',  role: 'Frontend UI',             color: 'text-primary-400' },
  { name: 'Tailwind CSS 3',     role: 'Styling',                  color: 'text-primary-400' },
  { name: 'Recharts',           role: 'Charts & analytics',       color: 'text-cyan-400' },
  { name: 'PHP 8.4',            role: 'API backend',              color: 'text-primary-400' },
  { name: 'Python 3',          role: 'IonMan Resolver engine',   color: 'text-green-400' },
  { name: 'dnsmasq',            role: 'DNS proxy',                color: 'text-yellow-400' },
  { name: 'MariaDB 11',         role: 'Query log & config store', color: 'text-danger-400' },
  { name: 'WireGuard',          role: 'VPN tunnel',               color: 'text-primary-400' },
  { name: 'Nginx + SSL',        role: 'HTTPS reverse proxy',      color: 'text-primary-400' },
  { name: 'dnslib',             role: 'DNS packet parsing',       color: 'text-green-400' },
  { name: 'iptables',           role: 'Port blocking',            color: 'text-orange-400' },
  { name: 'systemd',            role: 'Service management',       color: 'text-dark-300' },
]

const DNS_PIPELINE = [
  { step: '1', label: 'Device query',           detail: 'Any device on the network sends a DNS query',                         color: 'text-dark-300' },
  { step: '2', label: 'dns_proxy.py  :53',      detail: 'Checks blocklists, regex rules, whitelist — blocks or allows',       color: 'text-primary-400' },
  { step: '3', label: 'Blocked → NXDOMAIN',     detail: 'Returns NXDOMAIN immediately. Domain is sinked.',                    color: 'text-danger-400' },
  { step: '4', label: 'dnsmasq  :5353',         detail: 'Forwards allowed queries; handles DHCP & local DNS entries',         color: 'text-yellow-400' },
  { step: '5', label: 'IonMan Resolver  :5300', detail: 'Checks LRU cache — serves in < 1ms if hit',                          color: 'text-green-400' },
  { step: '6', label: 'Upstream DNS',           detail: '8.8.8.8 / 1.1.1.1 / 9.9.9.9 via UDP or DoT',                        color: 'text-dark-400' },
  { step: '7', label: 'Response + Cache',       detail: 'Answer cached in LRU, logged to DB, returned to device',             color: 'text-primary-400' },
]

export default function About() {
  const [system, setSystem] = useState(null)
  const [stats,  setStats]  = useState(null)
  const [resolverStatus, setResolverStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    Promise.all([
      api.getSystem().catch(() => null),
      api.getStats().catch(() => null),
      api.getResolverStatus().catch(() => null),
    ]).then(([sys, st, res]) => { setSystem(sys); setStats(st); setResolverStatus(res) })
  }, [])

  // Poll resolver stats for sparkline
  useEffect(() => {
    const poll = () => {
      api.getResolverStatus().then(d => {
        if (d?.running) {
          const now = new Date().toLocaleTimeString('en-US', { hour12: false })
          setHistory(prev => [...prev.slice(-19), { t: now, total: d.total_queries || 0, cached: d.cached_queries || 0 }])
        }
      }).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  // Animate pipeline steps
  useEffect(() => {
    const id = setInterval(() => setActiveStep(p => (p + 1) % DNS_PIPELINE.length), 1200)
    return () => clearInterval(id)
  }, [])

  const blockedTotal = stats?.total_blocked_domains || 0
  const cacheHitRate = resolverStatus?.cache?.hit_rate || 0
  const cacheSize    = resolverStatus?.cache?.size || 0
  const totalQueries = resolverStatus?.total_queries || 0

  // Donut pie data for query types
  const pieData = [
    { name: 'Cached',    value: resolverStatus?.cached_queries    || 0, color: '#4ade80' },
    { name: 'Forwarded', value: resolverStatus?.forwarded_queries || 0, color: '#60a5fa' },
    { name: 'NXDOMAIN',  value: resolverStatus?.nxdomain_queries  || 0, color: '#facc15' },
    { name: 'Errors',    value: resolverStatus?.error_queries     || 0, color: '#f87171' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-8 w-full max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-400" /> Documentation
        </h2>
        <p className="text-dark-400 text-sm mt-1">IonMan DNS+WireGuard+Resolver — complete reference</p>
      </div>

      {/* ── Hero ── */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-8 text-center relative overflow-hidden">
        {/* Ambient glow background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 70%)',
        }} />
        <div
          className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-dark-800 border border-primary-400/30 mb-5 relative"
          style={{ boxShadow: '0 0 40px rgba(0,212,255,0.2)' }}
        >
          <Zap className="w-14 h-14 text-primary-400" style={{ filter: 'drop-shadow(0 0 10px #00d4ff)' }} />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">
          <span className="text-primary-400">Ion</span>Man{' '}
          <span className="text-dark-400 font-normal text-lg">DNS + WireGuard + Resolver</span>
        </h3>
        <p className="text-dark-300 text-sm max-w-xl mx-auto leading-relaxed">
          A self-hosted, network-wide DNS ad blocker, WireGuard VPN gateway, and custom caching recursive resolver
          giving you full network protection, remote access, and DNS observability in one package.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6 text-xs text-dark-400">
          {[
            { icon: Shield,   label: 'DNS Sinkhole',    c: 'text-primary-400' },
            { icon: Globe,    label: 'WireGuard VPN',   c: 'text-primary-400' },
            { icon: Radio,    label: 'IonMan Resolver', c: 'text-green-400' },
            { icon: BarChart2,label: 'Full Analytics',  c: 'text-violet-400' },
            { icon: Lock,     label: 'Self-hosted',     c: 'text-yellow-400' },
          ].map(({ icon: I, label, c }) => (
            <span key={label} className="flex items-center gap-1.5 bg-dark-800 border border-dark-700 rounded-full px-3 py-1.5 hover:border-dark-600 transition-colors">
              <I className={`w-3.5 h-3.5 ${c}`} /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Live Stats Banner ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Blocked Domains',  value: blockedTotal,  color: 'text-danger-400',  delay: 0 },
          { label: 'Resolver Queries', value: totalQueries,  color: 'text-primary-400', delay: 100 },
          { label: 'Cache Entries',    value: cacheSize,     color: 'text-green-400',   delay: 200 },
          { label: 'Cache Hit Rate',   value: cacheHitRate,  color: 'text-yellow-400',  delay: 300, suffix: '%' },
        ].map(s => (
          <div key={s.label} className="bg-dark-900 border border-dark-700 rounded-xl p-4 text-center">
            <AnimStat value={s.value} label={s.label} color={s.color} delay={s.delay} suffix={s.suffix || ''} />
          </div>
        ))}
      </div>

      {/* ── Live Resolver Chart + Query Mix ── */}
      {resolverStatus?.running && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-dark-900 border border-dark-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-400" />
                Live Resolver Activity
              </h3>
              <span className="flex items-center gap-1.5 text-[10px] text-dark-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                live
              </span>
            </div>
            {history.length < 2 ? (
              <div className="flex items-center justify-center h-28 text-dark-600 text-xs">Collecting data…</div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="aCached" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4ade80" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="total"  name="Total"  stroke="#00d4ff" strokeWidth={2} fill="url(#aTotal)"  dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="cached" name="Cached" stroke="#4ade80" strokeWidth={2} fill="url(#aCached)" dot={false} isAnimationActive={false} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-white font-semibold text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-400" /> Query Mix
            </h3>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4 flex-1">
                <PieChart width={90} height={90}>
                  <Pie data={pieData} cx={40} cy={40} innerRadius={26} outerRadius={42}
                    dataKey="value" paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                  </Pie>
                </PieChart>
                <div className="space-y-1.5 text-xs">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-dark-400 w-20">{d.name}</span>
                      <span className="font-bold tabular-nums" style={{ color: d.color }}>{d.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-dark-600 text-xs">No queries yet</div>
            )}
          </div>
        </div>
      )}

      {/* ── What is IonMan DNS ── */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary-400" /> What is IonMan DNS?
        </h3>
        <p className="text-dark-300 text-sm leading-relaxed mb-3">
          IonMan DNS installs on a Linux server and becomes the DNS resolver for your entire network. When a device
          asks "where is ads.doubleclick.net?", IonMan intercepts that query and returns nothing — the ad never loads,
          the tracker never fires.
        </p>
        <p className="text-dark-300 text-sm leading-relaxed mb-3">
          Beyond blocking, the built-in <span className="text-green-400 font-medium">IonMan Resolver</span> caches
          responses in memory so legitimate domains resolve faster than any public DNS. A built-in
          <span className="text-primary-400 font-medium"> WireGuard VPN </span> lets you protect devices even off your
          home network, routing their DNS back through IonMan transparently.
        </p>
        <p className="text-dark-300 text-sm leading-relaxed">
          Everything is managed through this web dashboard — no command-line required after initial setup.
        </p>
      </div>

      {/* ── Animated DNS Pipeline ── */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary-400" /> How a DNS Query Flows
          </h3>
          <span className="text-[10px] text-dark-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" /> animated
          </span>
        </div>
        <div className="space-y-2">
          {DNS_PIPELINE.map(({ step, label, detail, color }, i) => (
            <div key={step}>
              <PipelineStep step={step} label={label} detail={detail} color={color} active={i === activeStep} />
              {i < DNS_PIPELINE.length - 1 && (
                <div className={`ml-3.5 w-px h-3 transition-colors duration-300 ${i === activeStep ? 'bg-primary-400/40' : 'bg-dark-800'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <div>
        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-400" /> Features & Functionalities
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </div>

      {/* ── Advantages ── */}
      <div>
        <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" /> Advantages
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ADVANTAGES.map(({ icon: Icon, title, desc }) => (
            <div key={title}
              className="bg-dark-900 border border-dark-700 rounded-xl p-5 flex gap-4 hover:border-dark-500 transition-all duration-200 group cursor-default"
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-dark-800 border border-dark-700 h-fit group-hover:border-dark-600 transition-colors">
                <Icon className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm mb-1 group-hover:text-primary-400 transition-colors">{title}</h4>
                <p className="text-dark-400 text-xs leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── System Info ── */}
      {(system || stats) && (
        <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary-400" /> System Info
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="py-3 px-3 rounded-lg bg-dark-800/50 border border-dark-700">
              <span className="text-dark-500 text-xs">Version</span>
              <p className="text-primary-400 font-mono font-bold">v{VERSION}</p>
            </div>
            <div className="py-3 px-3 rounded-lg bg-dark-800/50 border border-dark-700">
              <span className="text-dark-500 text-xs">Build Date</span>
              <p className="text-dark-200 font-mono">{BUILD_DATE}</p>
            </div>
            {system && <>
              <div className="py-3 px-3 rounded-lg bg-dark-800/50 border border-dark-700">
                <span className="text-dark-500 text-xs">Hostname</span>
                <p className="text-dark-200">{system.hostname || 'ionman'}</p>
              </div>
              <div className="py-3 px-3 rounded-lg bg-dark-800/50 border border-dark-700">
                <span className="text-dark-500 text-xs">OS</span>
                <p className="text-dark-200 text-xs">{system.os || 'Ubuntu'}</p>
              </div>
              <div className="py-3 px-3 rounded-lg bg-dark-800/50 border border-dark-700">
                <span className="text-dark-500 text-xs flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                <p className="text-primary-400 font-bold">{system.cpu_percent}%</p>
              </div>
              <div className="py-3 px-3 rounded-lg bg-dark-800/50 border border-dark-700">
                <span className="text-dark-500 text-xs flex items-center gap-1"><HardDrive className="w-3 h-3" /> Memory</span>
                <p className="text-dark-200">{formatBytes(system.mem_used)} / {formatBytes(system.mem_total)}</p>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* ── Tech Stack ── */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary-400" /> Tech Stack
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TECH_STACK.map(({ name, role, color }) => (
            <div key={name}
              className="py-2.5 px-3 rounded-lg bg-dark-800/50 border border-dark-700 flex items-center justify-between gap-3 hover:border-dark-600 transition-colors"
            >
              <span className={`font-medium text-sm ${color}`}>{name}</span>
              <span className="text-dark-500 text-xs">{role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Open Source ── */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl p-6 flex items-start gap-4">
        <div className="flex-shrink-0 p-2 rounded-lg bg-dark-800 border border-dark-700">
          <Heart className="w-5 h-5 text-danger-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold mb-2">Open Source</h3>
          <p className="text-dark-300 text-sm leading-relaxed mb-1">
            IonMan DNS is free, open-source software combining Pi-hole-style blocking, AdGuard filter lists,
            WireGuard VPN, and a custom recursive resolver in a unified, modern stack.
          </p>
          <p className="text-dark-500 text-xs">
            Built with React, PHP, Python, dnsmasq, MariaDB, WireGuard, and Nginx — all standard open-source components.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="text-center py-4">
        <p className="text-dark-500 text-xs">
          IonMan DNS+WG+Resolver v{VERSION} &middot; {BUILD_DATE} &middot; dns.makoyot.xyz
        </p>
      </div>

    </div>
  )
}
