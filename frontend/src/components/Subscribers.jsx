import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { Users, CheckCircle, XCircle, Clock, CreditCard, AlertTriangle, RefreshCw, Ban, Zap, ChevronDown, ChevronUp, UserPlus, Eye, EyeOff, Trash2, Edit3, Package, Plus, Save, X } from 'lucide-react';
import Modal from './Modal';
import PhAddressSelector from './PhAddressSelector';

export default function Subscribers() {
  const [data, setData] = useState({ subscribers: [], pending_payments: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [modal, setModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: null });
  const [tab, setTab] = useState('subscribers'); // 'subscribers' | 'plans'

  // Plans state
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [editPlan, setEditPlan] = useState(null); // null = list, object = editing
  const [planSaving, setPlanSaving] = useState(false);

  // Create account state
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [speedInputs, setSpeedInputs] = useState({}); // { [sub_id]: string }
  const [createForm, setCreateForm] = useState({
    email: '', password: '', full_name: '', phone: '',
    address: '', city: '', barangay: '', province: '', region: '',
    plan: 'client', days: 30,
  });

  const showError = (msg) => setModal({ open: true, title: 'Error', message: msg, type: 'danger', onConfirm: null });
  const showSuccess = (msg) => setModal({ open: true, title: 'Success', message: msg, type: 'info', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setModal({ open: true, title, message, type: 'danger', onConfirm });
  const closeModal = () => setModal(m => ({ ...m, open: false }));

  const load = useCallback(async () => {
    try {
      const res = await api.get('/subscribers');
      setData(res);
    } catch (e) {}
    setLoading(false);
  }, []);

  // Plans CRUD
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await api.getPlans(true);
      setPlans(res.plans || []);
    } catch (e) {}
    setPlansLoading(false);
  }, []);

  useEffect(() => { load(); loadPlans(); }, [load, loadPlans]);

  const loadDetail = async (id) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return; }
    try {
      const res = await api.get(`/subscribers/${id}`);
      setDetail(res);
      setExpanded(id);
    } catch (e) {}
  };

  const verifyPayment = async (paymentId) => {
    setActionLoading(`verify-${paymentId}`);
    try {
      await api.post('/subscribers/verify-payment', { payment_id: paymentId });
      load();
    } catch (e) { showError(e.message); }
    setActionLoading('');
  };

  const rejectPayment = (paymentId) => {
    showConfirm('Reject Payment', 'Reject this payment?', async () => {
      setActionLoading(`reject-${paymentId}`);
      try {
        await api.post('/subscribers/reject-payment', { payment_id: paymentId, reason: 'Payment not confirmed' });
        load();
      } catch (e) { showError(e.message); }
      setActionLoading('');
    });
  };

  const suspendUser = (id) => {
    showConfirm('Suspend Subscriber', 'Suspend this subscriber? Their VPN will be disconnected.', async () => {
      setActionLoading(`suspend-${id}`);
      try {
        await api.post(`/subscribers/suspend/${id}`);
        load();
      } catch (e) { showError(e.message); }
      setActionLoading('');
    });
  };

  const activateUser = async (id) => {
    setActionLoading(`activate-${id}`);
    try {
      await api.post(`/subscribers/activate/${id}`, { days: 30, plan: 'client' });
      load();
    } catch (e) { showError(e.message); }
    setActionLoading('');
  };

  const deleteUser = (id, name) => {
    showConfirm('Delete Subscriber', `Permanently delete ${name}? This will remove their WireGuard peer and all data.`, async () => {
      setActionLoading(`delete-${id}`);
      try {
        await api.del(`/subscribers/${id}`);
        load();
      } catch (e) { showError(e.message); }
      setActionLoading('');
    });
  };

  const setSpeedLimit = async (subscriberId, kbps) => {
    setActionLoading(`speed-${subscriberId}`);
    try {
      await api.post('/subscribers/speed-limit', { subscriber_id: subscriberId, speed_kbps: kbps === '' ? null : Number(kbps) });
      showSuccess(kbps === '' || kbps === null ? 'Speed limit removed (unlimited)' : `Speed limit set to ${kbps} Kbps`);
      const res = await api.get(`/subscribers/${subscriberId}`);
      setDetail(res);
    } catch (e) { showError(e.message); }
    setActionLoading('');
  };

  const extendUser = async (id, days) => {
    setActionLoading(`extend-${id}`);
    try {
      await api.post(`/subscribers/activate/${id}`, { days, plan: 'client' });
      showSuccess(`Subscription extended by ${days} days`);
      load();
    } catch (e) { showError(e.message); }
    setActionLoading('');
  };

  const createAccount = async (e) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password || !createForm.full_name || !createForm.phone) {
      showError('Please fill in all required fields'); return;
    }
    setCreateLoading(true);
    try {
      await api.post('/subscribers/create', createForm);
      showSuccess('Subscriber created successfully!');
      setShowCreate(false);
      setCreateForm({ email: '', password: '', full_name: '', phone: '', address: '', city: '', barangay: '', province: '', region: '', plan: 'client', days: 30 });
      load();
    } catch (e) { showError(e.message); }
    setCreateLoading(false);
  };

  const handleAddressChange = (addr) => {
    setCreateForm(f => ({
      ...f,
      region: addr.region,
      province: addr.province,
      city: addr.city,
      barangay: addr.barangay,
    }));
  };

  useEffect(() => { if (tab === 'plans') loadPlans(); }, [tab, loadPlans]);

  const newPlan = () => setEditPlan({
    name: '', slug: '', duration_type: 'month', duration_value: 1,
    price_php: 0, price_usd: 0, speed_limit_mbps: '',
    description: '', features: [''], is_trial: false, is_active: true,
    is_recommended: false, sort_order: plans.length,
  });

  const savePlan = async () => {
    if (!editPlan.name) { showError('Plan name is required'); return; }
    setPlanSaving(true);
    try {
      const payload = { ...editPlan, features: editPlan.features?.filter(f => f.trim()) || [] };
      if (editPlan.id) {
        await api.updatePlan(editPlan.id, payload);
        showSuccess('Plan updated');
      } else {
        await api.createPlan(payload);
        showSuccess('Plan created');
      }
      setEditPlan(null);
      loadPlans();
    } catch (e) { showError(e.message); }
    setPlanSaving(false);
  };

  const deletePlan = (plan) => {
    showConfirm('Delete Plan', `Delete "${plan.name}"? If subscribers use it, it will be deactivated instead.`, async () => {
      try {
        const res = await api.deletePlan(plan.id);
        showSuccess(res.message || 'Done');
        loadPlans();
      } catch (e) { showError(e.message); }
    });
  };

  const statusBadge = (s) => {
    const map = {
      trial: 'bg-blue-400/10 text-blue-400',
      active: 'bg-green-400/10 text-green-400',
      expired: 'bg-red-400/10 text-red-400',
      suspended: 'bg-orange-400/10 text-orange-400',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[s] || 'bg-dark-700 text-dark-400'}`}>{s?.toUpperCase()}</span>;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-primary-400 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-primary-400" /> Subscribers</h1>
        <div className="flex items-center gap-2">
          {tab === 'subscribers' && (
            <button onClick={() => setShowCreate(!showCreate)} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Create
            </button>
          )}
          {tab === 'plans' && (
            <button onClick={newPlan} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          )}
          <button onClick={tab === 'plans' ? loadPlans : load} className="p-2 text-dark-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg w-fit">
        <button onClick={() => setTab('subscribers')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'subscribers' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'}`}>
          <Users className="w-4 h-4 inline mr-1.5" />Subscribers
        </button>
        <button onClick={() => setTab('plans')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'plans' ? 'bg-primary-600 text-white' : 'text-dark-400 hover:text-white'}`}>
          <Package className="w-4 h-4 inline mr-1.5" />Plans
        </button>
      </div>

      {tab === 'plans' ? (
        /* ─── Plans Management ─────────────────── */
        <div className="space-y-4">
          {editPlan ? (
            <div className="bg-dark-900 border border-primary-500/30 rounded-xl p-5 space-y-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-400" /> {editPlan.id ? 'Edit Plan' : 'New Plan'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Plan Name *</label>
                  <input value={editPlan.name} onChange={e => setEditPlan(p => ({ ...p, name: e.target.value }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Monthly" />
                </div>
                <div>
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Slug</label>
                  <input value={editPlan.slug} onChange={e => setEditPlan(p => ({ ...p, slug: e.target.value }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="auto-generated" />
                </div>
                <div>
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Duration Type</label>
                  <select value={editPlan.duration_type} onChange={e => setEditPlan(p => ({ ...p, duration_type: e.target.value }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white">
                    <option value="minutes">Minutes</option>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>
                <div>
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Duration Value</label>
                  <input type="number" min="1" value={editPlan.duration_value} onChange={e => setEditPlan(p => ({ ...p, duration_value: parseInt(e.target.value) || 1 }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Price (PHP ₱)</label>
                  <input type="number" step="0.01" min="0" value={editPlan.price_php} onChange={e => setEditPlan(p => ({ ...p, price_php: parseFloat(e.target.value) || 0 }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Price (USD $)</label>
                  <input type="number" step="0.01" min="0" value={editPlan.price_usd} onChange={e => setEditPlan(p => ({ ...p, price_usd: parseFloat(e.target.value) || 0 }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Speed Limit (Mbps)</label>
                  <input type="number" min="0" value={editPlan.speed_limit_mbps} onChange={e => setEditPlan(p => ({ ...p, speed_limit_mbps: e.target.value }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Blank = unlimited" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-dark-400 text-xs font-medium mb-1 block">Description</label>
                  <input value={editPlan.description} onChange={e => setEditPlan(p => ({ ...p, description: e.target.value }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Plan description" />
                </div>
              </div>
              <div>
                <label className="text-dark-400 text-xs font-medium mb-1 block">Features (one per line)</label>
                <div className="space-y-1">
                  {(editPlan.features || ['']).map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={f} onChange={e => { const ff = [...(editPlan.features || [])]; ff[i] = e.target.value; setEditPlan(p => ({ ...p, features: ff })); }} className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-xs text-white" placeholder="Feature text" />
                      <button onClick={() => { const ff = (editPlan.features || []).filter((_, j) => j !== i); setEditPlan(p => ({ ...p, features: ff.length ? ff : [''] })); }} className="text-red-400 hover:text-red-300 p-1"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => setEditPlan(p => ({ ...p, features: [...(p.features || []), ''] }))} className="text-xs text-primary-400 hover:text-primary-300 mt-1">+ Add feature</button>
                </div>
              </div>
              <div className="flex gap-4 items-center flex-wrap">
                <label className="flex items-center gap-2 text-xs text-dark-400">
                  <input type="checkbox" checked={editPlan.is_trial} onChange={e => setEditPlan(p => ({ ...p, is_trial: e.target.checked }))} className="accent-primary-400" /> Trial plan
                </label>
                <label className="flex items-center gap-2 text-xs text-dark-400">
                  <input type="checkbox" checked={editPlan.is_active} onChange={e => setEditPlan(p => ({ ...p, is_active: e.target.checked }))} className="accent-primary-400" /> Active
                </label>
                <label className="flex items-center gap-2 text-xs text-dark-400">
                  <input type="checkbox" checked={editPlan.is_recommended} onChange={e => setEditPlan(p => ({ ...p, is_recommended: e.target.checked }))} className="accent-primary-400" /> Recommended
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-dark-400">Sort:</label>
                  <input type="number" min="0" value={editPlan.sort_order} onChange={e => setEditPlan(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} className="w-16 bg-dark-800 border border-dark-600 rounded-lg px-2 py-1 text-xs text-white text-center" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={savePlan} disabled={planSaving} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5">
                  {planSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
                <button onClick={() => setEditPlan(null)} className="px-4 py-2 bg-dark-700 text-dark-300 rounded-lg text-sm hover:bg-dark-600">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
              {plansLoading ? (
                <div className="flex items-center justify-center py-12"><RefreshCw className="w-5 h-5 text-primary-400 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-700 text-dark-400 text-xs">
                        <th className="text-left p-3">#</th>
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Duration</th>
                        <th className="text-right p-3">₱ PHP</th>
                        <th className="text-right p-3 hidden sm:table-cell">$ USD</th>
                        <th className="text-left p-3 hidden sm:table-cell">Speed</th>
                        <th className="text-center p-3">Status</th>
                        <th className="text-center p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map(p => (
                        <tr key={p.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                          <td className="p-3 text-dark-500">{p.sort_order}</td>
                          <td className="p-3 text-white font-medium">
                            {p.name}
                            {p.is_trial && <span className="ml-2 px-1.5 py-0.5 bg-blue-400/10 text-blue-400 rounded text-[10px]">TRIAL</span>}
                            {p.is_recommended && <span className="ml-2 px-1.5 py-0.5 bg-green-400/10 text-green-400 rounded text-[10px]">★</span>}
                          </td>
                          <td className="p-3 text-dark-300">{p.duration_value} {p.duration_type}{p.duration_value > 1 ? 's' : ''}</td>
                          <td className="p-3 text-right text-white font-mono">₱{Number(p.price_php).toFixed(2)}</td>
                          <td className="p-3 text-right text-dark-400 font-mono hidden sm:table-cell">${Number(p.price_usd).toFixed(2)}</td>
                          <td className="p-3 text-dark-400 hidden sm:table-cell">{p.speed_limit_mbps ? `${p.speed_limit_mbps} Mbps` : '∞'}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.is_active ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>{p.is_active ? 'ACTIVE' : 'OFF'}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => setEditPlan({ ...p, features: p.features || [''] })} className="p-1.5 text-dark-400 hover:text-primary-400"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deletePlan(p)} className="p-1.5 text-dark-400 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {plans.length === 0 && !plansLoading && (
                <div className="p-8 text-center text-dark-500">
                  <Package className="w-8 h-8 mx-auto mb-2 text-dark-600" />
                  <p>No plans configured</p>
                  <button onClick={newPlan} className="text-primary-400 text-sm mt-2 hover:text-primary-300">Create your first plan</button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
      /* ─── Subscribers Tab ─────────────────── */
      <>
      {/* Create Account Form */}
      {showCreate && (
        <div className="bg-dark-900 border border-primary-500/30 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-400" /> Create Subscriber Account
          </h2>
          <form onSubmit={createAccount} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="text-dark-400 text-xs font-medium mb-1 block">Full Name *</label>
                <input type="text" value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Juan Dela Cruz" className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" required />
              </div>
              <div>
                <label className="text-dark-400 text-xs font-medium mb-1 block">Email *</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" required />
              </div>
              <div>
                <label className="text-dark-400 text-xs font-medium mb-1 block">Password *</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 pr-10" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-dark-500 hover:text-white">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-dark-400 text-xs font-medium mb-1 block">Phone *</label>
                <input type="tel" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="09171234567" className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" required />
              </div>
              <div>
                <label className="text-dark-400 text-xs font-medium mb-1 block">Plan</label>
                <select value={createForm.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value }))} className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
                  {plans.filter(p => !p.is_trial && p.is_active).map(p => (
                    <option key={p.slug} value={p.slug}>{p.name} (₱{Number(p.price_php).toFixed(2)})</option>
                  ))}
                  {plans.length === 0 && <>
                    <option value="monthly">Monthly (₱100)</option>
                    <option value="selfhost">Self-Host (₱500)</option>
                  </>}
                </select>
              </div>
              <div>
                <label className="text-dark-400 text-xs font-medium mb-1 block">Duration (days)</label>
                <input type="number" value={createForm.days} onChange={e => setCreateForm(f => ({ ...f, days: parseInt(e.target.value) || 30 }))} min="1" max="3650" className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
              </div>
            </div>

            <PhAddressSelector onChange={handleAddressChange} />

            <div>
              <label className="text-dark-400 text-xs font-medium mb-1 block">Street / House No.</label>
              <input type="text" value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St." className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={createLoading} className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">
                {createLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {createLoading ? 'Creating...' : 'Create Account'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2.5 bg-dark-700 text-dark-300 rounded-lg text-sm hover:bg-dark-600">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: data.subscribers.length, icon: Users, color: 'text-primary-400' },
          { label: 'Active', value: data.subscribers.filter(s => s.status === 'active').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Trial', value: data.subscribers.filter(s => s.status === 'trial').length, icon: Clock, color: 'text-blue-400' },
          { label: 'Pending $', value: data.pending_payments.length, icon: CreditCard, color: 'text-yellow-400' },
        ].map((s, i) => (
          <div key={i} className="bg-dark-900 border border-dark-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><s.icon className={`w-4 h-4 ${s.color}`} /><span className="text-dark-400 text-xs">{s.label}</span></div>
            <p className="text-white font-bold text-lg">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Payments */}
      {data.pending_payments.length > 0 && (
        <div className="bg-dark-900 border border-yellow-500/30 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" /> Pending Payments ({data.pending_payments.length})
          </h2>
          <div className="space-y-3">
            {data.pending_payments.map(p => (
              <div key={p.id} className="bg-dark-800 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{p.full_name} — <span className="text-primary-400">${p.amount_usd}</span> (₱{p.amount_php})</p>
                    <p className="text-dark-400 text-xs mt-1">
                      GCash Ref: <span className="text-white font-mono">{p.gcash_reference}</span> • 
                      Sender: {p.gcash_sender_name} ({p.gcash_sender_number}) •
                      {new Date(p.created_at).toLocaleString()}
                    </p>
                    <p className="text-dark-500 text-xs">{p.email} • {p.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => verifyPayment(p.id)}
                      disabled={actionLoading === `verify-${p.id}`}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4" /> {actionLoading === `verify-${p.id}` ? '...' : 'Verify'}
                    </button>
                    <button
                      onClick={() => rejectPayment(p.id)}
                      disabled={actionLoading === `reject-${p.id}`}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscribers List */}
      <div className="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700 text-dark-400 text-xs">
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3 hidden sm:table-cell">Email</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3 hidden sm:table-cell">Expires</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.subscribers.map(sub => (
                <>
                  <tr key={sub.id} className="border-b border-dark-800 hover:bg-dark-800/50 cursor-pointer" onClick={() => loadDetail(sub.id)}>
                    <td className="p-3 text-white">
                      {sub.full_name}
                      {sub.pending_payments > 0 && <span className="ml-2 px-1.5 py-0.5 bg-yellow-400/10 text-yellow-400 rounded text-[10px]">{sub.pending_payments} pending</span>}
                    </td>
                    <td className="p-3 text-dark-400 hidden sm:table-cell">{sub.email}</td>
                    <td className="p-3 capitalize">{sub.plan}</td>
                    <td className="p-3">{statusBadge(sub.status)}</td>
                    <td className="p-3 text-dark-400 text-xs hidden sm:table-cell">
                      {sub.subscription_expires_at ? new Date(sub.subscription_expires_at).toLocaleDateString() : sub.trial_expires_at ? new Date(sub.trial_expires_at).toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-center">
                      {expanded === sub.id ? <ChevronUp className="w-4 h-4 text-dark-400 mx-auto" /> : <ChevronDown className="w-4 h-4 text-dark-400 mx-auto" />}
                    </td>
                  </tr>
                  {expanded === sub.id && detail && (
                    <tr key={`detail-${sub.id}`}>
                      <td colSpan="6" className="p-4 bg-dark-800/50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                          <div><span className="text-dark-500">Phone:</span> <span className="text-white">{detail.phone}</span></div>
                          <div><span className="text-dark-500">Address:</span> <span className="text-white">{[detail.address, detail.barangay, detail.city, detail.province, detail.region].filter(Boolean).join(', ') || '—'}</span></div>
                          <div><span className="text-dark-500">Peer ID:</span> <span className="text-white">{detail.wg_peer_id || 'None'}</span></div>
                          <div><span className="text-dark-500">Speed Limit:</span> <span className="text-white">{detail.speed_limit_kbps ? `${detail.speed_limit_kbps >= 1024 ? (detail.speed_limit_kbps/1024).toFixed(1)+' Mbps' : detail.speed_limit_kbps+' Kbps'}` : 'Unlimited'}</span></div>
                          <div><span className="text-dark-500">Registered:</span> <span className="text-white">{new Date(detail.created_at).toLocaleDateString()}</span></div>
                        </div>
                        {detail.wg_peer_id && (
                          <div className="flex items-center gap-2 mb-3 p-2.5 bg-dark-700/50 rounded-lg border border-dark-600">
                            <span className="text-dark-400 text-xs whitespace-nowrap">⚡ Speed Limit</span>
                            <input
                              type="number" min="0" placeholder="e.g. 10240 = 10 Mbps (blank = unlimited)"
                              value={speedInputs[sub.id] !== undefined ? speedInputs[sub.id] : (detail.speed_limit_kbps || '')}
                              onChange={e => setSpeedInputs(s => ({...s, [sub.id]: e.target.value}))}
                              onClick={e => e.stopPropagation()}
                              className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-primary-400"
                            />
                            <span className="text-dark-500 text-xs">Kbps</span>
                            <button
                              onClick={e => { e.stopPropagation(); const v = speedInputs[sub.id]; setSpeedLimit(sub.id, v === undefined ? (detail.speed_limit_kbps || '') : v); }}
                              disabled={actionLoading === `speed-${sub.id}`}
                              className="px-3 py-1.5 bg-primary-400/15 text-primary-400 border border-primary-400/30 rounded-lg text-xs hover:bg-primary-400/25 disabled:opacity-50 whitespace-nowrap"
                            >
                              {actionLoading === `speed-${sub.id}` ? 'Saving…' : 'Set Limit'}
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {sub.status !== 'active' && (
                            <button onClick={(e) => { e.stopPropagation(); activateUser(sub.id); }} disabled={actionLoading === `activate-${sub.id}`} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> Activate 30d
                            </button>
                          )}
                          {sub.status === 'active' && (
                            <button onClick={(e) => { e.stopPropagation(); extendUser(sub.id, 30); }} disabled={actionLoading === `extend-${sub.id}`} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> +30 Days
                            </button>
                          )}
                          {sub.status !== 'suspended' && (
                            <button onClick={(e) => { e.stopPropagation(); suspendUser(sub.id); }} disabled={actionLoading === `suspend-${sub.id}`} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                              <Ban className="w-3 h-3" /> Suspend
                            </button>
                          )}
                          {sub.status === 'suspended' && (
                            <button onClick={(e) => { e.stopPropagation(); activateUser(sub.id); }} disabled={actionLoading === `activate-${sub.id}`} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Unsuspend
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); deleteUser(sub.id, sub.full_name); }} disabled={actionLoading === `delete-${sub.id}`} className="px-3 py-1.5 bg-dark-700 border border-red-500/30 text-red-400 rounded-lg text-xs hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1 ml-auto">
                            {actionLoading === `delete-${sub.id}` ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete
                          </button>
                        </div>
                        {detail.payments?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-dark-400 text-xs font-semibold mb-1">Payment History:</p>
                            {detail.payments.map(p => (
                              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-dark-700 text-xs">
                                <span className="text-white">${p.amount_usd} — Ref: {p.gcash_reference || 'N/A'}</span>
                                <span className={`${p.status === 'verified' ? 'text-green-400' : p.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}`}>{p.status}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {data.subscribers.length === 0 && (
          <div className="p-8 text-center text-dark-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-dark-600" />
            <p>No subscribers yet</p>
            <p className="text-xs mt-1">Share your subscribe page: <span className="text-primary-400 font-mono">/dns/subscribe</span></p>
          </div>
        )}
      </div>
      </>
      )}

      <Modal open={modal.open} onClose={closeModal} onConfirm={modal.onConfirm} title={modal.title} message={modal.message} type={modal.type} confirmText={modal.onConfirm ? 'Confirm' : undefined} />
    </div>
  );
}
