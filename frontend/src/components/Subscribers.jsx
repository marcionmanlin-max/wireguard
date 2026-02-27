import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import { Users, CheckCircle, XCircle, Clock, CreditCard, AlertTriangle, RefreshCw, Ban, Zap, ChevronDown, ChevronUp, UserPlus, Eye, EyeOff, Trash2, Edit3 } from 'lucide-react';
import Modal from './Modal';
import PhAddressSelector from './PhAddressSelector';

export default function Subscribers() {
  const [data, setData] = useState({ subscribers: [], pending_payments: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [modal, setModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: null });

  // Create account state
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => { load(); }, [load]);

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
          <button onClick={() => setShowCreate(!showCreate)} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 flex items-center gap-1.5">
            <UserPlus className="w-4 h-4" /> Create
          </button>
          <button onClick={load} className="p-2 text-dark-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Create Account Form */}
      {showCreate && (
        <div className="bg-dark-900 border border-primary-500/30 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-400" /> Create Subscriber Account
          </h2>
          <form onSubmit={createAccount} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <option value="client">Client ($5/mo)</option>
                  <option value="selfhost">Self-Host ($50/mo)</option>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                          <div><span className="text-dark-500">Registered:</span> <span className="text-white">{new Date(detail.created_at).toLocaleDateString()}</span></div>
                        </div>
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

      <Modal open={modal.open} onClose={closeModal} onConfirm={modal.onConfirm} title={modal.title} message={modal.message} type={modal.type} confirmText={modal.onConfirm ? 'Confirm' : undefined} />
    </div>
  );
}
