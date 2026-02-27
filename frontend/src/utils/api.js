const API_BASE = '/dns/api';

function getToken() {
  return localStorage.getItem('ionman_token');
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}/${endpoint}`;
  const token = getToken();
  const config = {
    headers: { 
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    ...options,
  };

  const response = await fetch(url, config);
  const data = await response.json();
  
  if (!response.ok) {
    if (response.status === 401 && data.authenticated === false && endpoint !== 'auth/login') {
      localStorage.removeItem('ionman_token');
      window.dispatchEvent(new Event('ionman-logout'));
    }
    throw new Error(data.error || `API error: ${response.status}`);
  }
  
  return data;
}

export const api = {
  // Auth
  login: (password) => apiFetch('auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => apiFetch('auth/logout', { method: 'POST' }),
  checkAuth: () => apiFetch('auth'),
  changePassword: (new_password) => apiFetch('auth/change-password', { method: 'POST', body: JSON.stringify({ new_password }) }),

  // Stats
  getStats: () => apiFetch('stats'),
  getSystem: () => apiFetch('system'),
  getPublicIp: () => apiFetch('public-ip'),

  // Categories
  getCategories: () => apiFetch('categories'),
  toggleCategory: (key, enabled) => apiFetch('categories', { method: 'PUT', body: JSON.stringify({ key, enabled }) }),
  toggleCategoryDomain: (key, domain, blocked) => apiFetch('categories', { method: 'PATCH', body: JSON.stringify({ key, domain, blocked }) }),

  // Regex / Wildcard blocking
  getRegexPatterns: () => apiFetch('regex'),
  addRegexPattern: (data) => apiFetch('regex', { method: 'POST', body: JSON.stringify(data) }),
  updateRegexPattern: (id, data) => apiFetch(`regex/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRegexPattern: (id) => apiFetch(`regex/${id}`, { method: 'DELETE' }),
  toggleRegexPattern: (id) => apiFetch(`regex/${id}/toggle`, { method: 'POST' }),
  applyRegexPatterns: () => apiFetch('regex/apply', { method: 'POST' }),

  // Blocklists
  getBlocklists: () => apiFetch('blocklists'),
  addBlocklist: (data) => apiFetch('blocklists', { method: 'POST', body: JSON.stringify(data) }),
  deleteBlocklist: (id) => apiFetch(`blocklists/${id}`, { method: 'DELETE' }),
  toggleBlocklist: (id) => apiFetch(`blocklists/${id}/toggle`, { method: 'POST' }),
  updateBlocklist: (id) => apiFetch(`blocklists/${id}/update`, { method: 'POST' }),

  // Domains (whitelist/blacklist)
  getDomains: (type, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`domains/${type}${qs ? '?' + qs : ''}`);
  },
  addDomain: (type, data) => apiFetch(`domains/${type}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteDomain: (type, id) => apiFetch(`domains/${type}/${id}`, { method: 'DELETE' }),

  // Query Log
  getQueryLog: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`querylog${qs ? '?' + qs : ''}`);
  },

  // Settings
  getSettings: () => apiFetch('settings'),
  updateSettings: (data) => apiFetch('settings', { method: 'PUT', body: JSON.stringify(data) }),

  // WireGuard
  getWgPeers: () => apiFetch('wireguard'),
  getWgStatus: () => apiFetch('wireguard/status'),
  getWgPeerConfig: (id) => apiFetch(`wireguard/config/${id}`),
  addWgPeer: (data) => apiFetch('wireguard', { method: 'POST', body: JSON.stringify(data) }),
  deleteWgPeer: (id) => apiFetch(`wireguard/${id}`, { method: 'DELETE' }),
  renamePeer: (id, name) => apiFetch(`wireguard/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  setupWg: () => apiFetch('wireguard/setup', { method: 'POST' }),

  // Per-Peer Category Blocking
  getPeerBlocking: () => apiFetch('peer-blocking'),
  getPeerBlockingCategories: () => apiFetch('peer-blocking/categories'),
  getPeerCategories: (id) => apiFetch(`peer-blocking/${id}`),
  getPeerCategoryDomains: (id, categoryKey) => apiFetch(`peer-blocking/${id}/domains/${categoryKey}`),
  togglePeerDomain: (id, category, brand, blocked) => apiFetch(`peer-blocking/${id}/domains`, { method: 'PATCH', body: JSON.stringify({ category, brand, blocked }) }),
  setPeerCategories: (id, categories) => apiFetch(`peer-blocking/${id}`, { method: 'PUT', body: JSON.stringify({ categories }) }),
  bulkSetCategories: (peer_ids, categories) => apiFetch('peer-blocking/bulk', { method: 'POST', body: JSON.stringify({ peer_ids, categories }) }),
  resetPeerCategories: (id) => apiFetch(`peer-blocking/${id}/reset`, { method: 'POST' }),
  getBlockingGroups: () => apiFetch('peer-blocking/groups'),
  createBlockingGroup: (data) => apiFetch('peer-blocking/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateBlockingGroup: (id, data) => apiFetch(`peer-blocking/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBlockingGroup: (id) => apiFetch(`peer-blocking/groups/${id}`, { method: 'DELETE' }),
  setGroupMembers: (id, peer_ids) => apiFetch(`peer-blocking/groups/${id}/members`, { method: 'POST', body: JSON.stringify({ peer_ids }) }),

  // Control
  enableBlocking: () => apiFetch('control/enable', { method: 'POST' }),
  disableBlocking: () => apiFetch('control/disable', { method: 'POST' }),
  restartDns: () => apiFetch('control/restart', { method: 'POST' }),
  updateAllLists: () => apiFetch('control/update', { method: 'POST' }),
  flushLogs: () => apiFetch('control/flush', { method: 'POST' }),
  restartWg: () => apiFetch('control/wg-restart', { method: 'POST' }),

  // Generic HTTP helpers (used by Subscribers and other components)
  get: (path, params = {}) => {
    const p = path.replace(/^\//, '');
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch(p + qs);
  },
  post: (path, data = {}) => apiFetch(path.replace(/^\//, ''), { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data = {}) => apiFetch(path.replace(/^\//, ''), { method: 'PUT', body: JSON.stringify(data) }),
  del: (path) => apiFetch(path.replace(/^\//, ''), { method: 'DELETE' }),

  // Port Blocking (game ports via iptables)
  getPortBlocking: () => apiFetch('port-blocking'),
  getPortBlockingGames: () => apiFetch('port-blocking/games'),
  getClientPortBlocks: (ip) => apiFetch(`port-blocking/${ip}`),
  setClientPortBlocks: (ip, games) => apiFetch(`port-blocking/${ip}`, { method: 'PUT', body: JSON.stringify({ games }) }),
  bulkPortBlocks: (client_ips, games) => apiFetch('port-blocking/bulk', { method: 'POST', body: JSON.stringify({ client_ips, games }) }),
  setGlobalPortBlocks: (games) => apiFetch('port-blocking/global', { method: 'PUT', body: JSON.stringify({ games }) }),
  syncPortRules: () => apiFetch('port-blocking/sync', { method: 'POST' }),
  getPortBlockingClients: () => apiFetch('port-blocking/clients'),
  addLanClient: (data) => apiFetch('port-blocking/clients', { method: 'POST', body: JSON.stringify(data) }),
  deleteLanClient: (id) => apiFetch(`port-blocking/clients/${id}`, { method: 'DELETE' }),
  detectNewGames: () => apiFetch('port-blocking/detect'),

  // IonMan Resolver
  getResolverStatus: () => apiFetch('resolver?action=status'),
  getResolverConfig: () => apiFetch('resolver?action=config'),
  saveResolverConfig: (config) => apiFetch('resolver?action=config', { method: 'POST', body: JSON.stringify(config) }),
  resolverStart: () => apiFetch('resolver?action=start', { method: 'POST' }),
  resolverStop: () => apiFetch('resolver?action=stop', { method: 'POST' }),
  resolverRestart: () => apiFetch('resolver?action=restart', { method: 'POST' }),
  resolverFlush: () => apiFetch('resolver?action=flush', { method: 'POST' }),
  resolverLookup: (domain, type = 'A') => apiFetch(`resolver?action=lookup&domain=${encodeURIComponent(domain)}&type=${type}`),
  getResolverLog: (limit = 50) => apiFetch(`resolver?action=log&limit=${limit}`),
};
