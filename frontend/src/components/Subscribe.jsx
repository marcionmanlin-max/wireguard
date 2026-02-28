import { useState, useEffect } from 'react';
import { Shield, Wifi, Clock, CreditCard, CheckCircle, AlertTriangle, XCircle, Copy, QrCode, ChevronDown, Zap, Globe, Lock, Smartphone, Eye, EyeOff } from 'lucide-react';
import PhAddressSelector from './PhAddressSelector';

const API = '/dns/api/subscribe';

// Fallback plans used only if API fetch fails
const defaultPlans = [
  { id: 'trial', slug: 'trial', name: 'Free Trial', price_php: 0, price_usd: 0, duration_type: 'minutes', duration_value: 10, color: 'from-blue-600 to-cyan-500', features: ['DNS ad blocking', 'WireGuard VPN', 'Category blocking', '10-minute free trial'], badge: 'FREE', is_trial: true },
  { id: 'daily', slug: 'daily', name: 'Daily Pass', price_php: 5, price_usd: 0.09, duration_type: 'day', duration_value: 1, color: 'from-cyan-600 to-teal-500', features: ['DNS filtering', 'Game blocking', 'Category blocking'], badge: '1 DAY' },
  { id: 'weekly', slug: 'weekly', name: 'Weekly', price_php: 25, price_usd: 0.43, duration_type: 'week', duration_value: 1, color: 'from-teal-600 to-emerald-500', features: ['DNS filtering', 'Game blocking', 'Category blocking', 'Speed control'], badge: '7 DAYS' },
  { id: 'monthly', slug: 'monthly', name: 'Monthly', price_php: 100, price_usd: 1.74, duration_type: 'month', duration_value: 1, color: 'from-primary-600 to-primary-400', features: ['Everything included', 'Priority support', 'Speed control'], badge: 'POPULAR', is_recommended: true },
  { id: 'selfhost', slug: 'selfhost', name: 'Self-Host', price_php: 500, price_usd: 8.69, duration_type: 'month', duration_value: 1, color: 'from-purple-600 to-pink-500', features: ['Full server installation', 'Unlimited peers', 'All features'], badge: 'PRO' },
];

const planColors = ['from-blue-600 to-cyan-500', 'from-cyan-600 to-teal-500', 'from-teal-600 to-emerald-500', 'from-primary-600 to-primary-400', 'from-purple-600 to-pink-500', 'from-amber-600 to-yellow-500'];

const comparisonData = [
  { feature: 'DNS Ad Blocking', ionman: true, pihole: true, adguard: true },
  { feature: 'Category Blocking (Social, Streaming, etc.)', ionman: true, pihole: false, adguard: false },
  { feature: 'Per-Brand Toggles (e.g. block TikTok, keep Facebook)', ionman: true, pihole: false, adguard: false },
  { feature: 'Built-in WireGuard VPN', ionman: true, pihole: false, adguard: false },
  { feature: 'Mobile App Client', ionman: true, pihole: false, adguard: false },
  { feature: 'Regex/Wildcard Blocking', ionman: true, pihole: true, adguard: true },
  { feature: 'Pi-hole Blocklist Compatible', ionman: true, pihole: true, adguard: true },
  { feature: 'AdGuard Blocklist Compatible', ionman: true, pihole: false, adguard: true },
  { feature: 'Modern React Dashboard', ionman: true, pihole: false, adguard: false },
  { feature: 'Subscription & Payment System', ionman: true, pihole: false, adguard: false },
  { feature: 'One-Command Install', ionman: true, pihole: true, adguard: true },
  { feature: 'Remote DNS Protection (VPN)', ionman: true, pihole: false, adguard: false },
];

export default function Subscribe() {
  const [view, setView] = useState('landing'); // landing, register, login, dashboard
  const [token, setToken] = useState(localStorage.getItem('sub_token') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [status, setStatus] = useState(null);
  const [wgConfig, setWgConfig] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [plans, setPlans] = useState(defaultPlans);

  // Form state
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', address: '', city: '', province: '', region: '', barangay: '' });
  const [paymentForm, setPaymentForm] = useState({ plan: 'monthly', gcash_reference: '', gcash_sender_name: '', gcash_sender_number: '', card_number: '', card_expiry: '', card_cvv: '', card_name: '' });
  const [payMethod, setPayMethod] = useState('gcash');

  // Load plans from API
  useEffect(() => {
    fetch(`${API}?id=plans`).then(r => r.json()).then(data => {
      if (data.plans) {
        const apiPlans = Object.entries(data.plans).map(([slug, p], i) => ({
          id: slug,
          slug,
          name: p.name,
          price_php: p.price_php,
          price_usd: p.price_usd,
          duration_type: p.duration_type || 'month',
          duration_value: p.duration_value || 1,
          duration: p.duration,
          color: planColors[i % planColors.length],
          features: p.features || [],
          badge: p.is_trial ? 'FREE' : p.is_recommended ? 'POPULAR' : p.duration_type === 'day' ? '1 DAY' : '',
          is_trial: p.is_trial,
          is_recommended: p.is_recommended,
          speed_limit_mbps: p.speed_limit_mbps,
        }));
        if (apiPlans.length > 0) setPlans(apiPlans);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (token) {
      checkStatus();
    }
  }, [token]);

  const api = async (endpoint, method = 'GET', body = null) => {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API}/${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const checkStatus = async () => {
    try {
      const data = await api('status');
      setStatus(data);
      if (data.active && data.wg_peer_id) {
        try {
          const cfg = await api('config');
          setWgConfig(cfg.config || '');
          setQrCode(cfg.qr_code || '');
        } catch (e) {}
      }
      setView('dashboard');
    } catch (e) {
      localStorage.removeItem('sub_token');
      setToken('');
      setView('landing');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api('register', 'POST', form);
      setToken(data.token);
      localStorage.setItem('sub_token', data.token);
      setWgConfig(data.wg_config || '');
      setSuccess(data.message);
      setView('dashboard');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api('login', 'POST', { email: form.email, password: form.password });
      setToken(data.token);
      localStorage.setItem('sub_token', data.token);
      if (data.wg_config) setWgConfig(data.wg_config);
      setView('dashboard');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const payload = { plan: paymentForm.plan };
      if (payMethod === 'gcash') {
        payload.gcash_reference = paymentForm.gcash_reference;
        payload.gcash_sender_name = paymentForm.gcash_sender_name;
        payload.gcash_sender_number = paymentForm.gcash_sender_number;
      } else {
        payload.card_number = paymentForm.card_number;
        payload.card_expiry = paymentForm.card_expiry;
        payload.card_cvv = paymentForm.card_cvv;
        payload.card_name = paymentForm.card_name;
      }
      const data = await api('payment', 'POST', payload);
      setSuccess(data.message);
      if (data.wg_config) setWgConfig(data.wg_config);
      checkStatus();
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(wgConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const logout = () => {
    localStorage.removeItem('sub_token');
    setToken('');
    setStatus(null);
    setWgConfig('');
    setView('landing');
  };

  const inputClass = "w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm";

  // ─── LANDING PAGE ────────────────────────────────
  if (view === 'landing') return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 via-dark-950 to-purple-600/10" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-400/10 border border-primary-400/30 rounded-full text-primary-400 text-sm mb-6">
            <Shield className="w-4 h-4" /> Pi-hole + AdGuard Home Alternative
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold mb-4 bg-gradient-to-r from-primary-400 to-cyan-300 bg-clip-text text-transparent">
            IonMan DNS+WireGuard
          </h1>
          <p className="text-lg sm:text-xl text-dark-300 max-w-2xl mx-auto mb-8">
            Block ads, trackers, malware, social media & more across all your devices. 
            Connect via WireGuard VPN for protection anywhere.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => setView('register')} className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-400 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity">
              Start Free Trial (10 min)
            </button>
            <button onClick={() => setView('login')} className="px-8 py-4 bg-dark-800 border border-dark-600 rounded-xl font-semibold text-lg hover:border-primary-500 transition-colors">
              Already have an account? Log in
            </button>
          </div>
        </div>
      </div>

      {/* Why IonMan? */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">Why IonMan DNS?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Shield, title: 'Block Everything', desc: 'Ads, trackers, malware, social media, streaming, gambling, adult content — all blocked at DNS level before reaching your device.' },
            { icon: Wifi, title: 'Built-in WireGuard VPN', desc: 'Unlike Pi-hole or AdGuard, IonMan includes a full WireGuard VPN. Protect your DNS even on public WiFi or mobile data.' },
            { icon: Zap, title: 'Category Blocking', desc: 'One-click block entire categories like Social Media, Streaming, Gaming. Toggle individual brands — block TikTok but keep Facebook.' },
            { icon: Globe, title: 'Works Everywhere', desc: 'Connect from your phone, laptop, or tablet. Works on any network — home WiFi, mobile data, coffee shop, travel.' },
            { icon: Lock, title: 'Privacy First', desc: 'Your DNS queries stay private. No third-party analytics, no data selling. Self-hosted option available for full control.' },
            { icon: Smartphone, title: 'Android App', desc: 'Download the IonMan DNS app for Android. Auto-configure WireGuard, manage your subscription, one-tap connect.' },
          ].map((f, i) => (
            <div key={i} className="bg-dark-900 border border-dark-700 rounded-xl p-6">
              <f.icon className="w-8 h-8 text-primary-400 mb-3" />
              <h3 className="text-white font-semibold mb-2">{f.title}</h3>
              <p className="text-dark-400 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <button onClick={() => setShowComparison(!showComparison)} className="w-full flex items-center justify-between p-4 bg-dark-900 border border-dark-700 rounded-xl hover:border-primary-500 transition-colors">
          <h2 className="text-xl font-bold">IonMan vs Pi-hole vs AdGuard Home</h2>
          <ChevronDown className={`w-5 h-5 text-dark-400 transition-transform ${showComparison ? 'rotate-180' : ''}`} />
        </button>
        {showComparison && (
          <div className="mt-4 bg-dark-900 border border-dark-700 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left p-3 text-dark-400">Feature</th>
                  <th className="p-3 text-primary-400">IonMan DNS</th>
                  <th className="p-3 text-dark-400">Pi-hole</th>
                  <th className="p-3 text-dark-400">AdGuard Home</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, i) => (
                  <tr key={i} className="border-b border-dark-800">
                    <td className="p-3 text-dark-300">{row.feature}</td>
                    <td className="p-3 text-center">{row.ionman ? <CheckCircle className="w-5 h-5 text-green-400 mx-auto" /> : <XCircle className="w-5 h-5 text-dark-600 mx-auto" />}</td>
                    <td className="p-3 text-center">{row.pihole ? <CheckCircle className="w-5 h-5 text-green-400 mx-auto" /> : <XCircle className="w-5 h-5 text-dark-600 mx-auto" />}</td>
                    <td className="p-3 text-center">{row.adguard ? <CheckCircle className="w-5 h-5 text-green-400 mx-auto" /> : <XCircle className="w-5 h-5 text-dark-600 mx-auto" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pricing */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">Pricing</h2>
        <p className="text-dark-400 text-center mb-8">Start free, upgrade anytime. Pay via GCash.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map(plan => {
            const durationLabel = plan.duration || `${plan.duration_value} ${plan.duration_type}${plan.duration_value > 1 ? 's' : ''}`;
            const phpPrice = plan.price_php !== undefined ? `₱${Number(plan.price_php).toFixed(2)}` : plan.php;
            const usdPrice = plan.price_usd !== undefined ? `$${Number(plan.price_usd).toFixed(2)}` : plan.price;
            return (
            <div key={plan.id} className={`relative bg-dark-900 border ${plan.is_recommended ? 'border-primary-400 ring-1 ring-primary-400/30' : 'border-dark-700'} rounded-xl p-6`}>
              {plan.badge && (
                <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r ${plan.color} rounded-full text-xs font-bold`}>
                  {plan.badge}
                </span>
              )}
              <h3 className="text-white font-bold text-lg mt-2">{plan.name}</h3>
              <p className="text-3xl font-bold text-white mt-2">{phpPrice}</p>
              <p className="text-dark-500 text-sm">{usdPrice} • {durationLabel}{plan.speed_limit_mbps ? ` • ${plan.speed_limit_mbps} Mbps` : ''}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-dark-300">
                    <CheckCircle className="w-4 h-4 text-primary-400 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => { setView('register'); }} className={`w-full mt-6 py-3 rounded-xl font-semibold text-sm ${plan.is_recommended ? 'bg-gradient-to-r from-primary-600 to-primary-400 text-white' : 'bg-dark-800 border border-dark-600 text-dark-300 hover:border-primary-500'} transition-colors`}>
                {plan.is_trial ? 'Start Free Trial' : 'Subscribe Now'}
              </button>
            </div>
            );
          })}
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Register', desc: 'Create an account with your email. Get 10-minute free trial instantly.' },
            { step: '2', title: 'Get Config', desc: 'Receive your WireGuard VPN config. Scan QR code or copy to clipboard.' },
            { step: '3', title: 'Connect', desc: 'Import config into WireGuard app. Toggle on — you\'re protected!' },
            { step: '4', title: 'Subscribe', desc: 'Love it? Pay via GCash or card — instantly activated. $25/mo.' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 bg-primary-400/10 border border-primary-400/30 rounded-full flex items-center justify-center text-primary-400 font-bold text-lg mx-auto mb-3">{s.step}</div>
              <h3 className="text-white font-semibold mb-1">{s.title}</h3>
              <p className="text-dark-400 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Android App */}
      <div className="max-w-5xl mx-auto px-4 py-12 border-t border-dark-800">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">📱 Get the Android App</h2>
        <p className="text-dark-400 text-center mb-6">Install the IonMan DNS app on your phone. Sign in with your subscriber account and the VPN configures automatically.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <a href="/dns/api/subscribe/apk" className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-400 text-black font-semibold rounded-xl hover:opacity-90 flex items-center gap-2">
            <Smartphone className="w-5 h-5" /> Download APK
          </a>
          <a href="https://play.google.com/store/apps/details?id=com.wireguard.android" target="_blank" className="px-6 py-3 bg-dark-800 border border-dark-600 text-dark-300 rounded-xl hover:bg-dark-700 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Also install WireGuard App
          </a>
        </div>
        <div className="mt-6 text-center text-dark-500 text-xs space-y-1">
          <p>1. Install the IonMan DNS APK → 2. Sign in with your email → 3. Tap "Connect VPN"</p>
          <p>The app automatically fetches your WireGuard config and imports it. No manual setup needed.</p>
        </div>
      </div>

      <div className="text-center py-8 text-dark-500 text-sm border-t border-dark-800">
        IonMan DNS+WireGuard • A Pi-hole + AdGuard Home Alternative
      </div>
    </div>
  );

  // ─── REGISTER FORM ───────────────────────────────
  if (view === 'register') return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-primary-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-dark-400 text-sm mt-1">Start your 10-minute free trial</p>
        </div>
        <form onSubmit={handleRegister} className="bg-dark-900 border border-dark-700 rounded-xl p-6 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-dark-400 text-xs mb-1">Full Name *</label>
            <input type="text" required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Juan Dela Cruz" className={inputClass} />
          </div>
          <div>
            <label className="block text-dark-400 text-xs mb-1">Email *</label>
            <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="juan@email.com" className={inputClass} />
          </div>
          <div className="relative">
            <label className="block text-dark-400 text-xs mb-1">Password *</label>
            <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" className={inputClass} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-7 text-dark-500">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div>
            <label className="block text-dark-400 text-xs mb-1">Phone Number *</label>
            <input type="tel" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="09XX XXX XXXX" className={inputClass} />
          </div>
          <PhAddressSelector onChange={({ region, province, city, barangay }) => setForm(f => ({ ...f, region, province, city, barangay }))} />
          <div>
            <label className="block text-dark-400 text-xs mb-1">Street / House No.</label>
            <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Street, Purok, House No." className={inputClass} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-400 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Creating account...' : 'Start Free Trial →'}
          </button>
          <p className="text-center text-dark-500 text-sm">
            Already have an account?{' '}
            <button type="button" onClick={() => { setView('login'); setError(''); }} className="text-primary-400 hover:underline">Log in</button>
          </p>
        </form>
        <button onClick={() => setView('landing')} className="w-full mt-4 text-dark-500 text-sm hover:text-dark-300">← Back to Home</button>
      </div>
    </div>
  );

  // ─── LOGIN FORM ──────────────────────────────────
  if (view === 'login') return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-primary-400 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
          <p className="text-dark-400 text-sm mt-1">Log in to your IonMan DNS account</p>
        </div>
        <form onSubmit={handleLogin} className="bg-dark-900 border border-dark-700 rounded-xl p-6 space-y-4">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          <div>
            <label className="block text-dark-400 text-xs mb-1">Email</label>
            <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="juan@email.com" className={inputClass} />
          </div>
          <div className="relative">
            <label className="block text-dark-400 text-xs mb-1">Password</label>
            <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Your password" className={inputClass} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-7 text-dark-500">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-400 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
          <p className="text-center text-dark-500 text-sm">
            New here?{' '}
            <button type="button" onClick={() => { setView('register'); setError(''); }} className="text-primary-400 hover:underline">Create account</button>
          </p>
        </form>
        <button onClick={() => setView('landing')} className="w-full mt-4 text-dark-500 text-sm hover:text-dark-300">← Back to Home</button>
      </div>
    </div>
  );

  // ─── SUBSCRIBER DASHBOARD ────────────────────────
  if (view === 'dashboard') return (
    <div className="min-h-screen bg-dark-950 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary-400" />
            <div>
              <h1 className="text-white font-bold text-lg">IonMan DNS</h1>
              <p className="text-dark-500 text-xs">Subscriber Dashboard</p>
            </div>
          </div>
          <button onClick={logout} className="text-dark-500 hover:text-dark-300 text-sm">Logout</button>
        </div>

        {success && <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm mb-4">{success}</div>}
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">{error}</div>}

        {/* Status Card */}
        {status && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                {status.active ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                Subscription Status
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.active ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                {status.status?.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-dark-500">Name</p>
                <p className="text-white">{status.subscriber?.name}</p>
              </div>
              <div>
                <p className="text-dark-500">Plan</p>
                <p className="text-white capitalize">{status.subscriber?.plan}</p>
              </div>
              <div>
                <p className="text-dark-500">Expires</p>
                <p className="text-white">{status.expires ? new Date(status.expires).toLocaleString() : 'N/A'}</p>
              </div>
              <div>
                <p className="text-dark-500">Remaining</p>
                <p className="text-white">{status.remaining_text || 'Expired'}</p>
              </div>
            </div>
          </div>
        )}

        {/* WireGuard Config (only if active) */}
        {status?.active && wgConfig && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 mb-4">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-primary-400" /> WireGuard Config
            </h2>
            <div className="bg-dark-950 border border-dark-800 rounded-lg p-3 mb-3">
              <pre className="text-xs text-dark-300 font-mono whitespace-pre-wrap break-all">{wgConfig}</pre>
            </div>
            <div className="flex gap-2">
              <button onClick={copyConfig} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
                <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy Config'}
              </button>
              {qrCode && (
                <button onClick={() => { const w = window.open(); w.document.write(`<img src="${qrCode}" />`); }} className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 text-white rounded-lg text-sm hover:border-primary-500">
                  <QrCode className="w-4 h-4" /> QR Code
                </button>
              )}
            </div>
            <p className="text-dark-500 text-xs mt-3">
              Import this config into the <a href="https://play.google.com/store/apps/details?id=com.wireguard.android" target="_blank" className="text-primary-400 hover:underline">WireGuard app</a> on your phone.
            </p>
          </div>
        )}

        {/* Payment Form (if expired or trial) */}
        {status && (!status.active || status.status === 'trial') && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5 mb-4">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-400" />
              {status.active ? 'Upgrade Your Plan' : 'Renew Subscription'}
            </h2>
            {/* Payment Method Toggle */}
            <div className="flex gap-2 mb-4">
              <button type="button" onClick={() => setPayMethod('gcash')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${payMethod === 'gcash' ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:text-white'}`}>
                GCash
              </button>
              <button type="button" onClick={() => setPayMethod('card')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${payMethod === 'card' ? 'bg-blue-600 text-white' : 'bg-dark-800 text-dark-400 hover:text-white'}`}>
                Credit/Debit Card
              </button>
            </div>

            {payMethod === 'gcash' && (
              <div className="bg-primary-400/5 border border-primary-400/20 rounded-lg p-4 mb-4">
                <p className="text-primary-400 font-semibold text-sm mb-2">Send payment via GCash</p>
                <p className="text-white text-lg font-mono">09626616298</p>
                <p className="text-dark-400 text-sm">Account Name: IonMan</p>
                <p className="text-green-400 text-xs mt-2">After sending, enter the reference number below for instant activation.</p>
              </div>
            )}

            <form onSubmit={handlePayment} className="space-y-3">
              <div>
                <label className="block text-dark-400 text-xs mb-1">Select Plan</label>
                <select value={paymentForm.plan} onChange={e => setPaymentForm({...paymentForm, plan: e.target.value})} className={inputClass}>
                  {plans.filter(p => !p.is_trial).map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ₱{Number(p.price_php).toFixed(2)}</option>
                  ))}
                </select>
              </div>

              {payMethod === 'gcash' ? (
                <>
                  <div>
                    <label className="block text-dark-400 text-xs mb-1">GCash Reference Number *</label>
                    <input type="text" required value={paymentForm.gcash_reference} onChange={e => setPaymentForm({...paymentForm, gcash_reference: e.target.value})} placeholder="e.g. 1234 5678 9012" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-dark-400 text-xs mb-1">GCash Sender Name</label>
                    <input type="text" value={paymentForm.gcash_sender_name} onChange={e => setPaymentForm({...paymentForm, gcash_sender_name: e.target.value})} placeholder="Name on your GCash" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-dark-400 text-xs mb-1">GCash Number</label>
                    <input type="tel" value={paymentForm.gcash_sender_number} onChange={e => setPaymentForm({...paymentForm, gcash_sender_number: e.target.value})} placeholder="09XX XXX XXXX" className={inputClass} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-dark-400 text-xs mb-1">Cardholder Name *</label>
                    <input type="text" required value={paymentForm.card_name} onChange={e => setPaymentForm({...paymentForm, card_name: e.target.value})} placeholder="Name on card" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-dark-400 text-xs mb-1">Card Number *</label>
                    <input type="text" required value={paymentForm.card_number} onChange={e => setPaymentForm({...paymentForm, card_number: e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim()})} placeholder="1234 5678 9012 3456" maxLength="19" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-dark-400 text-xs mb-1">Expiry *</label>
                      <input type="text" required value={paymentForm.card_expiry} onChange={e => { let v = e.target.value.replace(/\D/g, ''); if (v.length >= 2) v = v.slice(0,2) + '/' + v.slice(2,4); setPaymentForm({...paymentForm, card_expiry: v}); }} placeholder="MM/YY" maxLength="5" className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-dark-400 text-xs mb-1">CVV *</label>
                      <input type="password" required value={paymentForm.card_cvv} onChange={e => setPaymentForm({...paymentForm, card_cvv: e.target.value.replace(/\D/g, '').slice(0,4)})} placeholder="•••" maxLength="4" className={inputClass} />
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-green-600 to-green-400 rounded-xl font-semibold hover:opacity-90 disabled:opacity-50">
                {loading ? 'Processing...' : 'Pay & Activate Instantly'}
              </button>
            </form>
            <p className="text-green-400/70 text-xs mt-3 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Your subscription activates instantly after payment — no waiting.
            </p>
          </div>
        )}

        {/* Payment History */}
        {status?.payments?.length > 0 && (
          <div className="bg-dark-900 border border-dark-700 rounded-xl p-5">
            <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-400" /> Payment History
            </h2>
            <div className="space-y-2">
              {status.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                  <div>
                    <p className="text-white text-sm">${p.amount_usd} (₱{p.amount_php})</p>
                    <p className="text-dark-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'verified' ? 'bg-green-400/10 text-green-400' : p.status === 'pending' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-red-400/10 text-red-400'}`}>
                    {p.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
