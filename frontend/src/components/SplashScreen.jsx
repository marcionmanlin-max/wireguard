import { useState, useEffect, useRef } from 'react'
import { Zap, Shield, Wifi, Gamepad2, CheckCircle, XCircle, Radio } from 'lucide-react'

const VERSION = '2.1.0'
const DEVELOPER = 'Ionman Dev'

const BLOCKED_DOMAINS = [
  'ads.google.com', 'doubleclick.net', 'pagead2.googlesyndication.com',
  'adservice.google.com', 'google-analytics.com', 'tracking.fb.com',
  'an.facebook.com', 'analytics.twitter.com', 'bat.bing.com',
  'scorecardresearch.com', 'outbrain.com', 'taboola.com',
  'ads.yahoo.com', 'adnxs.com', 'pubmatic.com', 'rubiconproject.com',
  'criteo.com', 'moatads.com', 'openx.net', 'amazon-adsystem.com',
  'quantserve.com', 'casalemedia.com', 'sharethrough.com', 'spotx.tv',
  'media.net', 'teads.tv', 'advertising.com', 'adsrvr.org',
  'ml314.com', 'tiktokv.com', 'analytics.tiktok.com', 'byteoversea.com',
]
const ALLOWED_DOMAINS = [
  'google.com', 'youtube.com', 'github.com', 'facebook.com',
  'twitter.com', 'instagram.com', 'reddit.com', 'wikipedia.org',
  'netflix.com', 'spotify.com', 'discord.com', 'twitch.tv',
  'amazon.com', 'microsoft.com', 'apple.com', 'cloudflare.com',
  'stackoverflow.com', 'medium.com', 'shopify.com', 'paypal.com',
]
const GAME_DOMAINS = [
  'steampowered.com', 'roblox.com', 'epicgames.com', 'ea.com',
  'blizzard.com', 'leagueoflegends.com', 'play.google.com', 'battle.net',
  'valorant.com', 'store.playstation.com', 'xbox.com', 'nintendo.com',
]

function Favicon({ domain }) {
  const [ok, setOk] = useState(true)
  return ok ? (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      className="w-5 h-5 rounded flex-shrink-0"
      onError={() => setOk(false)}
      alt=""
    />
  ) : (
    <div className="w-5 h-5 rounded bg-dark-700 flex-shrink-0" />
  )
}

function DomainPill({ domain, type, delay = 0 }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-500 border ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      } ${
        type === 'blocked'
          ? 'bg-red-500/10 border-red-500/30 text-red-300'
          : type === 'game'
          ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
          : 'bg-green-500/10 border-green-500/30 text-green-300'
      }`}
    >
      <Favicon domain={domain} />
      <span className="truncate max-w-[140px]">{domain}</span>
      {type === 'blocked' || type === 'game' ? (
        <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
      ) : (
        <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
      )}
    </div>
  )
}

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState(0)
  // 0 = logo in, 1 = features, 2 = domains anim, 3 = outro
  const [logoVisible, setLogoVisible] = useState(false)
  const [titleVisible, setTitleVisible] = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)
  const [featuresVisible, setFeaturesVisible] = useState([false, false, false, false])
  const [domainBatch, setDomainBatch] = useState(0)
  const [progress, setProgress] = useState(0)
  const [outroFade, setOutroFade] = useState(false)
  const doneRef = useRef(false)

  const TOTAL_MS = 9000

  // Shuffle helpers
  const shuffled = (arr) => [...arr].sort(() => Math.random() - 0.5)
  const blockedPool = useRef(shuffled(BLOCKED_DOMAINS))
  const allowedPool = useRef(shuffled(ALLOWED_DOMAINS))
  const gamePool = useRef(shuffled(GAME_DOMAINS))

  const blockedBatches = useRef([])
  const allowedBatches = useRef([])
  const gameBatches = useRef([])
  useEffect(() => {
    for (let i = 0; i < 4; i++) {
      blockedBatches.current.push(blockedPool.current.slice(i * 4, i * 4 + 4))
      allowedBatches.current.push(allowedPool.current.slice(i * 4, i * 4 + 4))
      gameBatches.current.push(gamePool.current.slice(i * 3, i * 3 + 3))
    }
  }, [])

  useEffect(() => {
    // Progress bar
    const start = Date.now()
    const prog = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.min(100, (elapsed / TOTAL_MS) * 100))
    }, 50)

    // Phase timeline
    const t0 = setTimeout(() => { setLogoVisible(true) }, 100)
    const t1 = setTimeout(() => { setTitleVisible(true) }, 600)
    const t2 = setTimeout(() => { setSubtitleVisible(true) }, 1100)
    const t3 = setTimeout(() => { setPhase(1) }, 2000)
    const t4 = setTimeout(() => setFeaturesVisible([true, false, false, false]), 2100)
    const t5 = setTimeout(() => setFeaturesVisible([true, true, false, false]), 2500)
    const t6 = setTimeout(() => setFeaturesVisible([true, true, true, false]), 2900)
    const t7 = setTimeout(() => setFeaturesVisible([true, true, true, true]), 3300)
    const t8 = setTimeout(() => { setPhase(2); setDomainBatch(0) }, 4000)
    const t9 = setTimeout(() => setDomainBatch(1), 5000)
    const t10 = setTimeout(() => setDomainBatch(2), 6200)
    const t11 = setTimeout(() => setDomainBatch(3), 7400)
    const t12 = setTimeout(() => { setPhase(3); setOutroFade(true) }, 8200)
    const t13 = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone() }
    }, TOTAL_MS)

    return () => {
      clearInterval(prog)
      ;[t0,t1,t2,t3,t4,t5,t6,t7,t8,t9,t10,t11,t12,t13].forEach(clearTimeout)
    }
  }, [onDone])

  const features = [
    { icon: Shield, label: 'Pi-hole Style', sub: 'Network DNS Blocking', color: 'text-primary-400', bg: 'bg-primary-400/10 border-primary-400/20' },
    { icon: Shield, label: 'AdGuard Home', sub: 'Filter Lists Engine', color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/20' },
    { icon: Wifi, label: 'WireGuard VPN', sub: 'Secure Tunnel Routing', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
    { icon: Radio, label: 'IonMan Resolver', sub: 'Custom Recursive DNS', color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  ]

  const curBlocked = blockedBatches.current[domainBatch] || []
  const curAllowed = allowedBatches.current[domainBatch] || []
  const curGames = gameBatches.current[domainBatch] || []

  return (
    <div className="fixed inset-0 bg-dark-950 flex flex-col items-center justify-center z-[9999] overflow-hidden select-none">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* Glow blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-400/5 blur-3xl pointer-events-none" />

      {/* ── Phase 0 & 1: Logo + Features ── */}
      <div className={`flex flex-col items-center transition-all duration-700 ${phase >= 2 ? 'opacity-0 scale-95 pointer-events-none absolute' : 'opacity-100'}`}>
        {/* Logo */}
        <div className={`transition-all duration-700 ${logoVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl bg-dark-800 border border-primary-400/30 flex items-center justify-center shadow-[0_0_60px_rgba(0,212,255,0.25)]">
              <Zap className="w-12 h-12 text-primary-400" style={{ filter: 'drop-shadow(0 0 12px #00d4ff)' }} />
            </div>
            {/* Orbit ring */}
            <div className="absolute inset-0 rounded-3xl border-2 border-primary-400/20 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
        </div>

        {/* Title */}
        <div className={`mt-6 text-center transition-all duration-700 ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-primary-400" style={{ textShadow: '0 0 30px rgba(0,212,255,0.5)' }}>Ion</span>
            <span className="text-white">Man</span>
            <span className="ml-2 text-dark-400 font-normal text-2xl">DNS</span>
          </h1>
        </div>

        {/* Subtitle */}
        <div className={`mt-2 text-center transition-all duration-700 ${subtitleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <p className="text-dark-400 text-sm tracking-widest uppercase">
            Pi-hole · AdGuard · WireGuard · Resolver
          </p>
        </div>

        {/* Features grid */}
        {phase >= 1 && (
          <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm">
            {features.map((f, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${f.bg} ${
                  featuresVisible[i] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <f.icon className={`w-5 h-5 flex-shrink-0 ${f.color}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${f.color}`}>{f.label}</p>
                  <p className="text-[10px] text-dark-500 truncate">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Phase 2: Domain Animation ── */}
      {phase >= 2 && phase < 3 && (
        <div className="flex flex-col items-center w-full max-w-2xl px-4">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Zap className="w-6 h-6 text-primary-400" style={{ filter: 'drop-shadow(0 0 6px #00d4ff)' }} />
              <h2 className="text-xl font-bold text-white">
                <span className="text-primary-400">Ion</span>Man DNS
              </h2>
            </div>
            <p className="text-dark-400 text-xs tracking-widest uppercase">Live Filtering Engine</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            {/* Blocked ads */}
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Ads Blocked
              </p>
              <div className="space-y-2">
                {curBlocked.map((d, i) => (
                  <DomainPill key={`b-${domainBatch}-${i}`} domain={d} type="blocked" delay={i * 120} />
                ))}
              </div>
            </div>

            {/* Allowed */}
            <div>
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Allowed Sites
              </p>
              <div className="space-y-2">
                {curAllowed.slice(0, 4).map((d, i) => (
                  <DomainPill key={`a-${domainBatch}-${i}`} domain={d} type="allowed" delay={i * 120} />
                ))}
              </div>
            </div>

            {/* Games blocked */}
            <div>
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Gamepad2 className="w-3.5 h-3.5" /> Games Controlled
              </p>
              <div className="space-y-2">
                {curGames.map((d, i) => (
                  <DomainPill key={`g-${domainBatch}-${i}`} domain={d} type="game" delay={i * 140} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 3: Outro ── */}
      {phase >= 3 && (
        <div className={`flex flex-col items-center transition-all duration-700 ${outroFade ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-16 h-16 rounded-2xl bg-dark-800 border border-primary-400/30 flex items-center justify-center mb-4"
            style={{ boxShadow: '0 0 40px rgba(0,212,255,0.2)' }}>
            <Zap className="w-8 h-8 text-primary-400" style={{ filter: 'drop-shadow(0 0 8px #00d4ff)' }} />
          </div>
          <h1 className="text-2xl font-bold">
            <span className="text-primary-400">Ion</span><span className="text-white">Man DNS</span>
          </h1>
          <p className="text-dark-500 text-xs mt-1 tracking-widest uppercase">DNS Blocker · VPN · Custom Resolver</p>
          <div className="mt-4 flex items-center gap-3 text-dark-500 text-xs">
            <span>v{VERSION}</span>
            <span>·</span>
            <span>Developed by <span className="text-primary-400">{DEVELOPER}</span></span>
          </div>
        </div>
      )}

      {/* Bottom: progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-dark-800">
        <div
          className="h-full bg-gradient-to-r from-primary-600 to-cyan-400 transition-all duration-100"
          style={{ width: `${progress}%`, boxShadow: '0 0 8px rgba(0,212,255,0.6)' }}
        />
      </div>

      {/* Skip hint */}
      <button
        onClick={() => { doneRef.current = true; onDone() }}
        className="absolute bottom-4 right-4 text-dark-600 hover:text-dark-400 text-xs transition-colors"
      >
        Skip →
      </button>
    </div>
  )
}
