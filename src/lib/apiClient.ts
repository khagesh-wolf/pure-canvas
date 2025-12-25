// API Client for SQLite Backend
// Auto-detects local IP from current browser location

const BACKEND_PORT = 3001;

// Check if hostname is mDNS (.local)
const isMdnsHostname = (hostname: string): boolean => {
  return hostname.endsWith('.local');
};

// Auto-detect the API base URL from current window location
const getAutoDetectedUrl = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  
  const { hostname } = window.location;
  
  // For mDNS hostnames, check if we have a cached working IP
  // mDNS resolution can fail on some devices (especially Android with Private DNS)
  if (isMdnsHostname(hostname)) {
    const cachedIp = localStorage.getItem('mdns_fallback_ip');
    if (cachedIp) {
      return `http://${cachedIp}:${BACKEND_PORT}`;
    }
  }
  
  // Always use HTTP since the backend doesn't support HTTPS
  return `http://${hostname}:${BACKEND_PORT}`;
};

export const setApiBaseUrl = (url: string) => {
  localStorage.setItem('api_base_url', url);
  window.location.reload();
};

// Set a fallback IP for mDNS resolution issues
export const setMdnsFallbackIp = (ip: string) => {
  localStorage.setItem('mdns_fallback_ip', ip);
};

export const getMdnsFallbackIp = (): string | null => {
  return localStorage.getItem('mdns_fallback_ip');
};

export const clearMdnsFallbackIp = () => {
  localStorage.removeItem('mdns_fallback_ip');
};

export const getApiBaseUrl = () => {
  // If user has manually set a URL, use that; otherwise auto-detect
  const manualUrl = localStorage.getItem('api_base_url');
  if (manualUrl) return manualUrl;
  
  return getAutoDetectedUrl();
};

// Check if current access is via mDNS
export const isAccessingViaMdns = (): boolean => {
  if (typeof window === 'undefined') return false;
  return isMdnsHostname(window.location.hostname);
};

// Generic fetch wrapper with error handling
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Categories API
export const categoriesApi = {
  getAll: () => apiFetch<any[]>('/api/categories'),
  create: (category: any) => apiFetch<any>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(category),
  }),
  update: (id: string, category: any) => apiFetch<any>(`/api/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(category),
  }),
  delete: (id: string) => apiFetch<void>(`/api/categories/${id}`, {
    method: 'DELETE',
  }),
};

// Menu Items API
export const menuApi = {
  getAll: () => apiFetch<any[]>('/api/menu'),
  create: (item: any) => apiFetch<any>('/api/menu', {
    method: 'POST',
    body: JSON.stringify(item),
  }),
  update: (id: string, item: any) => apiFetch<any>(`/api/menu/${id}`, {
    method: 'PUT',
    body: JSON.stringify(item),
  }),
  delete: (id: string) => apiFetch<void>(`/api/menu/${id}`, {
    method: 'DELETE',
  }),
};

// Orders API
export const ordersApi = {
  getAll: () => apiFetch<any[]>('/api/orders'),
  create: (order: any) => apiFetch<any>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  }),
  updateStatus: (id: string, status: string) => apiFetch<any>(`/api/orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
};

// Bills API
export const billsApi = {
  getAll: () => apiFetch<any[]>('/api/bills'),
  create: (bill: any) => apiFetch<any>('/api/bills', {
    method: 'POST',
    body: JSON.stringify(bill),
  }),
  pay: (id: string, paymentMethod: string) => apiFetch<any>(`/api/bills/${id}/pay`, {
    method: 'PUT',
    body: JSON.stringify({ paymentMethod, paidAt: new Date().toISOString() }),
  }),
};

// Customers API
export const customersApi = {
  getAll: () => apiFetch<any[]>('/api/customers'),
  getByPhone: (phone: string) => apiFetch<any>(`/api/customers/${phone}`),
  upsert: (customer: any) => apiFetch<any>('/api/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  }),
};

// Staff API
export const staffApi = {
  getAll: () => apiFetch<any[]>('/api/staff'),
  create: (staff: any) => apiFetch<any>('/api/staff', {
    method: 'POST',
    body: JSON.stringify(staff),
  }),
  update: (id: string, staff: any) => apiFetch<any>(`/api/staff/${id}`, {
    method: 'PUT',
    body: JSON.stringify(staff),
  }),
  delete: (id: string) => apiFetch<void>(`/api/staff/${id}`, {
    method: 'DELETE',
  }),
};

// Settings API
export const settingsApi = {
  get: () => apiFetch<any>('/api/settings'),
  update: (settings: any) => apiFetch<any>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),
};

// Expenses API
export const expensesApi = {
  getAll: () => apiFetch<any[]>('/api/expenses'),
  create: (expense: any) => apiFetch<any>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  }),
  delete: (id: string) => apiFetch<void>(`/api/expenses/${id}`, {
    method: 'DELETE',
  }),
};

// Waiter Calls API
export const waiterCallsApi = {
  getAll: () => apiFetch<any[]>('/api/waiter-calls'),
  create: (call: any) => apiFetch<any>('/api/waiter-calls', {
    method: 'POST',
    body: JSON.stringify(call),
  }),
  acknowledge: (id: string) => apiFetch<any>(`/api/waiter-calls/${id}/acknowledge`, {
    method: 'PUT',
  }),
  dismiss: (id: string) => apiFetch<void>(`/api/waiter-calls/${id}`, {
    method: 'DELETE',
  }),
};

// Transactions API
export const transactionsApi = {
  getAll: () => apiFetch<any[]>('/api/transactions'),
  create: (transaction: any) => apiFetch<any>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(transaction),
  }),
};

// Health check
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    await apiFetch<{ status: string }>('/api/health');
    return true;
  } catch {
    return false;
  }
};
