import { create } from 'zustand';
import {
  Bill,
  Customer,
  Expense,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  Settings,
  Staff,
  Transaction,
  WaiterCall,
} from '@/types';
import { getNepalTimestamp, isToday } from '@/lib/nepalTime';
import { billsApi, customersApi, ordersApi, menuApi, settingsApi, expensesApi, waiterCallsApi, staffApi, transactionsApi } from '@/lib/apiClient';

const generateId = () => Math.random().toString(36).substring(2, 11);

// All actions sync to backend with retry logic
const syncToBackend = async (fn: () => Promise<unknown>, retries = 2) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      console.error(`[Store] Backend sync failed (attempt ${attempt + 1}/${retries + 1}):`, err);
      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
};

const defaultSettings: Settings = {
  restaurantName: 'Chiyadani',
  tableCount: 10,
  wifiSSID: '',
  wifiPassword: '',
  baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
};

const defaultStaff: Staff[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Administrator',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    username: 'counter',
    password: 'counter123',
    role: 'counter',
    name: 'Counter Staff',
    createdAt: new Date().toISOString(),
  },
];

interface AuthState {
  isAuthenticated: boolean;
  currentUser: Staff | null;
}

interface StoreState extends AuthState {
  // Data loading state
  isDataLoaded: boolean;
  setDataLoaded: (loaded: boolean) => void;

  // Auth
  login: (username: string, password: string) => boolean;
  logout: () => void;

  // Menu
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
  toggleItemAvailability: (id: string) => void;
  bulkToggleAvailability: (ids: string[], available: boolean) => void;

  // Orders
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addOrder: (tableNumber: number, customerPhone: string, items: OrderItem[], notes?: string) => Order;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  getOrdersByTable: (tableNumber: number) => Order[];
  getOrdersByPhone: (phone: string) => Order[];
  getPendingOrders: () => Order[];
  getActiveOrders: () => Order[];

  // Bills
  bills: Bill[];
  setBills: (bills: Bill[]) => void;
  createBill: (tableNumber: number, orderIds: string[], discount?: number) => Bill;
  payBill: (billId: string, paymentMethod: 'cash' | 'fonepay') => void;
  redeemPoints: (phone: string, points: number) => void;
  getUnpaidOrdersByTable: (tableNumber: number) => Order[];

  // Transactions
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;

  // Customers
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  getCustomerPoints: (phone: string) => number;
  addOrUpdateCustomer: (phone: string, amount: number) => void;

  // Staff
  staff: Staff[];
  setStaff: (staff: Staff[]) => void;
  addStaff: (staff: Omit<Staff, 'id' | 'createdAt'>) => void;
  updateStaff: (id: string, staff: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;

  // Settings
  settings: Settings;
  setSettings: (settings: Settings) => void;
  updateSettings: (settings: Partial<Settings>) => void;

  // Expenses
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => void;
  deleteExpense: (id: string) => void;
  getExpensesByDateRange: (start: string, end: string) => Expense[];

  // Waiter Calls
  waiterCalls: WaiterCall[];
  setWaiterCalls: (calls: WaiterCall[]) => void;
  callWaiter: (tableNumber: number, customerPhone: string) => void;
  acknowledgeWaiterCall: (id: string) => void;
  dismissWaiterCall: (id: string) => void;
  getPendingWaiterCalls: () => WaiterCall[];

  // Stats
  getTodayStats: () => { revenue: number; orders: number; activeOrders: number; activeTables: number };
}

export const useStore = create<StoreState>()((set, get) => ({
  // Data loading state
  isDataLoaded: false,
  setDataLoaded: (loaded) => set({ isDataLoaded: loaded }),

  // Auth - persisted separately in localStorage
  isAuthenticated: JSON.parse(localStorage.getItem('chiyadani_auth') || 'false'),
  currentUser: JSON.parse(localStorage.getItem('chiyadani_user') || 'null'),

  login: (username, password) => {
    const user = get().staff.find(
      s => s.username === username && s.password === password
    );
    if (user) {
      localStorage.setItem('chiyadani_auth', 'true');
      localStorage.setItem('chiyadani_user', JSON.stringify(user));
      set({ isAuthenticated: true, currentUser: user });
      return true;
    }
    return false;
  },

  logout: () => {
    localStorage.removeItem('chiyadani_auth');
    localStorage.removeItem('chiyadani_user');
    set({ isAuthenticated: false, currentUser: null });
  },

  // Menu - starts empty, loaded from backend
  menuItems: [],
  setMenuItems: (items) => set({ menuItems: items }),

  addMenuItem: (item) => {
    const newItem = { 
      id: generateId(),
      name: item.name,
      price: item.price,
      category: item.category,
      available: item.available ?? true,
      description: item.description || '',
      image: item.image || ''
    };
    set((state) => ({ menuItems: [...state.menuItems, newItem] }));
    syncToBackend(() => menuApi.create(newItem));
  },

  updateMenuItem: (id, item) => {
    const currentItem = get().menuItems.find(m => m.id === id);
    if (!currentItem) return;
    const updatedItem = { ...currentItem, ...item };
    set((state) => ({
      menuItems: state.menuItems.map(m => m.id === id ? updatedItem : m)
    }));
    syncToBackend(() => menuApi.update(id, updatedItem));
  },

  deleteMenuItem: (id) => {
    set((state) => ({ menuItems: state.menuItems.filter(m => m.id !== id) }));
    syncToBackend(() => menuApi.delete(id));
  },

  toggleItemAvailability: (id) => {
    const item = get().menuItems.find(m => m.id === id);
    if (!item) return;
    const updatedItem = { ...item, available: !item.available };
    set((state) => ({
      menuItems: state.menuItems.map(m =>
        m.id === id ? updatedItem : m
      )
    }));
    syncToBackend(() => menuApi.update(id, updatedItem));
  },

  bulkToggleAvailability: (ids, available) => {
    set((state) => ({
      menuItems: state.menuItems.map(m =>
        ids.includes(m.id) ? { ...m, available } : m
      )
    }));
    const items = get().menuItems.filter(m => ids.includes(m.id));
    items.forEach(item => {
      syncToBackend(() => menuApi.update(item.id, { ...item, available }));
    });
  },

  // Orders - starts empty, loaded from backend
  orders: [],
  setOrders: (orders) => set({ orders }),

  addOrder: (tableNumber, customerPhone, items, notes) => {
    const now = getNepalTimestamp();
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    // Ensure all order items have required fields
    const orderItems = items.map(item => ({
      id: item.id || generateId(),
      menuItemId: item.menuItemId,
      name: item.name,
      qty: item.qty,
      price: item.price
    }));
    const newOrder: Order = {
      id: generateId(),
      tableNumber,
      customerPhone,
      items: orderItems,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      total,
      notes: notes || '',
    };
    set((state) => ({ orders: [...state.orders, newOrder] }));
    syncToBackend(() => ordersApi.create(newOrder));
    get().addOrUpdateCustomer(customerPhone, 0);
    return newOrder;
  },

  updateOrderStatus: (id, status) => set((state) => {
    syncToBackend(() => ordersApi.updateStatus(id, status));
    return {
      orders: state.orders.map(o =>
        o.id === id ? { ...o, status, updatedAt: getNepalTimestamp() } : o
      )
    };
  }),

  getOrdersByTable: (tableNumber) =>
    get().orders.filter(o => o.tableNumber === tableNumber && o.status !== 'cancelled'),

  getOrdersByPhone: (phone) =>
    get().orders.filter(o => o.customerPhone === phone),

  getPendingOrders: () =>
    get().orders.filter(o => o.status === 'pending'),

  getActiveOrders: () =>
    get().orders.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)),

  // Bills - starts empty, loaded from backend
  bills: [],
  setBills: (bills) => set({ bills }),

  createBill: (tableNumber, orderIds, discount = 0) => {
    const orders = get().orders.filter(o => orderIds.includes(o.id));
    const customerPhones = [...new Set(orders.map(o => o.customerPhone))];
    const subtotal = orders.reduce((sum, o) => sum + o.total, 0);

    const bill: Bill = {
      id: generateId(),
      tableNumber,
      orders,
      customerPhones,
      subtotal,
      discount,
      total: subtotal - discount,
      status: 'unpaid',
      createdAt: getNepalTimestamp(),
    };

    set((state) => ({ bills: [...state.bills, bill] }));
    syncToBackend(() => billsApi.create(bill));
    return bill;
  },

  payBill: (billId, paymentMethod) => {
    const bill = get().bills.find(b => b.id === billId);
    if (!bill) return;

    const paidAt = getNepalTimestamp();

    const transaction: Transaction = {
      id: generateId(),
      billId,
      tableNumber: bill.tableNumber,
      customerPhones: bill.customerPhones,
      total: bill.total,
      discount: bill.discount,
      paymentMethod,
      paidAt,
      items: bill.orders.flatMap(o => o.items),
    };

    set((state) => ({
      bills: state.bills.map(b =>
        b.id === billId ? { ...b, status: 'paid' as const, paymentMethod, paidAt } : b
      ),
      orders: state.orders.map(o =>
        bill.orders.some(bo => bo.id === o.id) ? { ...o, status: 'served' as OrderStatus } : o
      ),
      transactions: [...state.transactions, transaction],
    }));

    syncToBackend(() => billsApi.pay(billId, paymentMethod));
    syncToBackend(() => transactionsApi.create(transaction));

    bill.customerPhones.forEach(phone => {
      get().addOrUpdateCustomer(phone, bill.total / bill.customerPhones.length);
    });

    if (bill.discount > 0) {
      bill.customerPhones.forEach(phone => {
        get().redeemPoints(phone, bill.discount);
      });
    }
  },

  getUnpaidOrdersByTable: (tableNumber) =>
    get().orders.filter(o =>
      o.tableNumber === tableNumber &&
      ['accepted', 'preparing', 'ready', 'served'].includes(o.status) &&
      !get().bills.some(b => b.status === 'paid' && b.orders.some(bo => bo.id === o.id))
    ),

  // Transactions - starts empty, loaded from backend
  transactions: [],
  setTransactions: (transactions) => set({ transactions }),

  // Customers - starts empty, loaded from backend
  customers: [],
  setCustomers: (customers) => set({ customers }),

  getCustomerPoints: (phone) => {
    const customer = get().customers.find(c => c.phone === phone);
    return customer?.points || 0;
  },

  addOrUpdateCustomer: (phone, amount) => set((state) => {
    const existing = state.customers.find(c => c.phone === phone);
    const newPoints = Math.floor(amount / 10);

    const nextCustomers: Customer[] = existing
      ? state.customers.map(c =>
        c.phone === phone
          ? {
            ...c,
            totalOrders: c.totalOrders + (amount > 0 ? 1 : 0),
            totalSpent: c.totalSpent + amount,
            points: c.points + newPoints,
            lastVisit: getNepalTimestamp(),
          }
          : c
      )
      : [...state.customers, {
        phone,
        name: '',
        totalOrders: amount > 0 ? 1 : 0,
        totalSpent: amount,
        points: newPoints,
        lastVisit: getNepalTimestamp(),
      }];

    const payload = nextCustomers.find(c => c.phone === phone);
    if (payload) {
      // Ensure name field exists for backend
      const customerPayload = { ...payload, name: payload.name || '' };
      syncToBackend(() => customersApi.upsert(customerPayload));
    }

    return { customers: nextCustomers };
  }),

  redeemPoints: (phone, points) => set((state) => {
    const existing = state.customers.find(c => c.phone === phone);
    if (!existing) return {};
    const updatedCustomer = { ...existing, points: Math.max(0, existing.points - points) };
    // Sync redeemed points to backend
    syncToBackend(() => customersApi.upsert({ ...updatedCustomer, name: updatedCustomer.name || '' }));
    return {
      customers: state.customers.map(c =>
        c.phone === phone ? updatedCustomer : c
      )
    };
  }),

  // Staff - uses defaults until loaded from backend
  staff: defaultStaff,
  setStaff: (staff) => set({ staff: staff.length > 0 ? staff : defaultStaff }),

  addStaff: (staffData) => {
    const newStaff = { ...staffData, id: generateId(), createdAt: getNepalTimestamp() };
    set((state) => ({ staff: [...state.staff, newStaff] }));
    syncToBackend(() => staffApi.create(newStaff));
  },

  updateStaff: (id, staffData) => {
    const currentStaff = get().staff.find(s => s.id === id);
    if (!currentStaff) return;
    const updatedStaff = { ...currentStaff, ...staffData };
    set((state) => ({
      staff: state.staff.map(s => s.id === id ? updatedStaff : s)
    }));
    syncToBackend(() => staffApi.update(id, updatedStaff));
  },

  deleteStaff: (id) => {
    set((state) => ({ staff: state.staff.filter(s => s.id !== id) }));
    syncToBackend(() => staffApi.delete(id));
  },

  // Settings - uses defaults until loaded from backend
  settings: defaultSettings,
  setSettings: (settings) => set({ settings: settings || defaultSettings }),

  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    }));
    const updated = { ...get().settings, ...newSettings };
    syncToBackend(() => settingsApi.update(updated));
  },

  // Expenses - starts empty, loaded from backend
  expenses: [],
  setExpenses: (expenses) => set({ expenses }),

  addExpense: (expense) => {
    const newExpense = { 
      id: generateId(), 
      amount: expense.amount,
      description: expense.description || '',
      category: expense.category,
      createdAt: getNepalTimestamp(),
      createdBy: expense.createdBy || ''
    };
    set((state) => ({ expenses: [...state.expenses, newExpense] }));
    syncToBackend(() => expensesApi.create(newExpense));
  },

  deleteExpense: (id) => {
    set((state) => ({ expenses: state.expenses.filter(e => e.id !== id) }));
    syncToBackend(() => expensesApi.delete(id));
  },

  getExpensesByDateRange: (start, end) => {
    return get().expenses.filter(e => {
      const date = new Date(e.createdAt);
      return date >= new Date(start) && date <= new Date(end + 'T23:59:59');
    });
  },

  // Waiter Calls - starts empty, loaded from backend
  waiterCalls: [],
  setWaiterCalls: (calls) => set({ waiterCalls: calls }),

  callWaiter: (tableNumber, customerPhone) => {
    const existingCall = get().waiterCalls.find(
      c => c.tableNumber === tableNumber && c.status === 'pending'
    );
    if (existingCall) return;

    const newCall: WaiterCall = {
      id: generateId(),
      tableNumber,
      customerPhone,
      status: 'pending',
      createdAt: getNepalTimestamp(),
    };
    set((state) => ({ waiterCalls: [...state.waiterCalls, newCall] }));
    syncToBackend(() => waiterCallsApi.create(newCall));
  },

  acknowledgeWaiterCall: (id) => {
    set((state) => ({
      waiterCalls: state.waiterCalls.map(c =>
        c.id === id ? { ...c, status: 'acknowledged' as const, acknowledgedAt: getNepalTimestamp() } : c
      )
    }));
    syncToBackend(() => waiterCallsApi.acknowledge(id));
  },

  dismissWaiterCall: (id) => {
    set((state) => ({ waiterCalls: state.waiterCalls.filter(c => c.id !== id) }));
    syncToBackend(() => waiterCallsApi.dismiss(id));
  },

  getPendingWaiterCalls: () => get().waiterCalls.filter(c => c.status === 'pending'),

  // Stats
  getTodayStats: () => {
    const todayTransactions = get().transactions.filter(t => isToday(t.paidAt));
    const activeOrders = get().getActiveOrders();
    const activeTables = new Set(activeOrders.map(o => o.tableNumber)).size;

    return {
      revenue: todayTransactions.reduce((sum, t) => sum + t.total, 0),
      orders: todayTransactions.length,
      activeOrders: activeOrders.length,
      activeTables,
    };
  },
}));
