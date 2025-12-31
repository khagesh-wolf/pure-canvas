import { create } from 'zustand';
import {
  Bill,
  Category,
  Customer,
  Expense,
  MenuItem,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  Settings,
  Staff,
  StaffRole,
  Transaction,
  WaiterCall,
  InventoryCategory,
  InventoryItem,
  InventoryTransaction,
  PortionOption,
  LowStockItem,
  InventoryUnitType,
} from '@/types';
import { getNepalTimestamp, isToday } from '@/lib/nepalTime';
import { 
  billsApi, customersApi, ordersApi, menuApi, settingsApi, expensesApi, waiterCallsApi, staffApi, transactionsApi, categoriesApi,
  inventoryCategoriesApi, inventoryItemsApi, inventoryTransactionsApi, portionOptionsApi, getLowStockItems
} from '@/lib/apiClient';

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
  restaurantName: 'Sajilo Orders',
  restaurantSubName: '',
  tableCount: 10,
  wifiSSID: '',
  wifiPassword: '',
  baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
  counterAsAdmin: false,
  kotPrintingEnabled: false,
  kdsEnabled: false,
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
  loginWithPin: (pin: string) => boolean; // PIN-based login for waiters/kitchen
  logout: () => void;

  // Categories
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  addCategory: (name: string, prepTime?: number) => void;
  updateCategory: (id: string, name: string, prepTime?: number) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (fromIndex: number, toIndex: number) => void;

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
  addWaiterOrder: (tableNumber: number, items: OrderItem[], notes?: string) => Order; // Auto-accepted waiter order
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  updateOrderItemStatus: (orderId: string, itemId: string, status: OrderItemStatus, completedQty?: number) => void;
  setOrderPriority: (orderId: string, priority: 'normal' | 'rush') => void;
  getOrdersByTable: (tableNumber: number) => Order[];
  getOrdersByPhone: (phone: string) => Order[];
  getOrdersByWaiter: (staffId: string) => Order[];
  getPendingOrders: () => Order[];
  getActiveOrders: () => Order[];
  getKitchenOrders: () => Order[]; // Orders for kitchen display

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
  updateCustomerPhone: (oldPhone: string, newPhone: string) => Promise<void>;

  // Staff
  staff: Staff[];
  setStaff: (staff: Staff[]) => void;
  addStaff: (staff: Omit<Staff, 'id' | 'createdAt'>) => void;
  updateStaff: (id: string, staff: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;

  // Settings
  settings: Settings;
  setSettings: (settings: Settings) => void;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;

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

  // Inventory
  inventoryCategories: InventoryCategory[];
  setInventoryCategories: (cats: InventoryCategory[]) => void;
  addInventoryCategory: (cat: Omit<InventoryCategory, 'id' | 'createdAt'>) => void;
  updateInventoryCategory: (id: string, cat: Partial<InventoryCategory>) => void;
  deleteInventoryCategory: (id: string) => void;
  
  inventoryItems: InventoryItem[];
  setInventoryItems: (items: InventoryItem[]) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateInventoryItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  addStock: (menuItemId: string, quantity: number, unit: InventoryUnitType, notes?: string) => void;
  deductStock: (menuItemId: string, quantity: number, unit: InventoryUnitType, orderId?: string) => void;
  getInventoryByMenuItemId: (menuItemId: string) => InventoryItem | undefined;
  
  inventoryTransactions: InventoryTransaction[];
  setInventoryTransactions: (txs: InventoryTransaction[]) => void;
  
  portionOptions: PortionOption[];
  setPortionOptions: (options: PortionOption[]) => void;
  addPortionOption: (option: Omit<PortionOption, 'id' | 'createdAt'>) => void;
  updatePortionOption: (id: string, option: Partial<PortionOption>) => void;
  deletePortionOption: (id: string) => void;
  getPortionsByCategory: (categoryName: string) => PortionOption[];
  
  lowStockItems: LowStockItem[];
  setLowStockItems: (items: LowStockItem[]) => void;
  refreshLowStockItems: () => Promise<void>;
  isInventoryCategory: (categoryId: string) => boolean;

  // Stats
  getTodayStats: () => { revenue: number; orders: number; activeOrders: number; activeTables: number };
}

export const useStore = create<StoreState>()((set, get) => ({
  // Data loading state
  isDataLoaded: false,
  setDataLoaded: (loaded) => set({ isDataLoaded: loaded }),

  // Auth - persisted separately in localStorage
  isAuthenticated: JSON.parse(localStorage.getItem('sajilo_auth') || 'false'),
  currentUser: JSON.parse(localStorage.getItem('sajilo_user') || 'null'),

  login: (username, password) => {
    const user = get().staff.find(
      s => s.username === username && s.password === password
    );
    if (user) {
      localStorage.setItem('sajilo_auth', 'true');
      localStorage.setItem('sajilo_user', JSON.stringify(user));
      set({ isAuthenticated: true, currentUser: user });
      return true;
    }
    return false;
  },

  loginWithPin: (pin) => {
    const user = get().staff.find(s => s.pin === pin);
    if (user) {
      localStorage.setItem('sajilo_auth', 'true');
      localStorage.setItem('sajilo_user', JSON.stringify(user));
      set({ isAuthenticated: true, currentUser: user });
      return true;
    }
    return false;
  },

  logout: () => {
    localStorage.removeItem('sajilo_auth');
    localStorage.removeItem('sajilo_user');
    set({ isAuthenticated: false, currentUser: null });
  },

  // Categories - starts empty, loaded from backend
  categories: [],
  setCategories: (categories) => set({ categories }),

  addCategory: (name, prepTime) => {
    const maxOrder = Math.max(0, ...get().categories.map(c => c.sortOrder));
    const newCategory = { id: generateId(), name, sortOrder: maxOrder + 1, prepTime: prepTime || 5 };
    set((state) => ({ categories: [...state.categories, newCategory] }));
    syncToBackend(() => categoriesApi.create(newCategory));
  },

  updateCategory: (id, name, prepTime) => {
    const category = get().categories.find(c => c.id === id);
    if (!category) return;
    const updated = { ...category, name, prepTime: prepTime !== undefined ? prepTime : category.prepTime };
    set((state) => ({
      categories: state.categories.map(c => c.id === id ? updated : c)
    }));
    syncToBackend(() => categoriesApi.update(id, updated));
  },

  deleteCategory: (id) => {
    set((state) => ({ categories: state.categories.filter(c => c.id !== id) }));
    syncToBackend(() => categoriesApi.delete(id));
  },

  reorderCategories: (fromIndex, toIndex) => {
    const cats = [...get().categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const [moved] = cats.splice(fromIndex, 1);
    cats.splice(toIndex, 0, moved);
    
    // Update sortOrder for all categories
    const updated = cats.map((cat, i) => ({ ...cat, sortOrder: i + 1 }));
    set({ categories: updated });
    
    // Sync all updated categories to backend
    updated.forEach(cat => {
      syncToBackend(() => categoriesApi.update(cat.id, cat));
    });
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

  addWaiterOrder: (tableNumber, items, notes) => {
    const now = getNepalTimestamp();
    const currentUser = get().currentUser;
    const settings = get().settings;
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    
    // Determine order status based on KDS and Kitchen KOT settings
    // If KDS is ON AND Kitchen KOT printing is ON: auto-accept (Kitchen handles it)
    // Otherwise: set to pending (Counter needs to accept and print)
    const shouldAutoAccept = settings.kdsEnabled && settings.kotPrintingEnabled;
    const orderStatus: OrderStatus = shouldAutoAccept ? 'accepted' : 'pending';
    
    // Ensure all order items have required fields with pending status
    const orderItems = items.map(item => ({
      id: item.id || generateId(),
      menuItemId: item.menuItemId,
      name: item.name,
      qty: item.qty,
      price: item.price,
      status: 'pending' as OrderItemStatus,
      completedQty: 0
    }));
    const newOrder: Order = {
      id: generateId(),
      tableNumber,
      customerPhone: `waiter-${currentUser?.name || 'staff'}`,
      items: orderItems,
      status: orderStatus,
      createdAt: now,
      updatedAt: now,
      total,
      notes: notes || '',
      createdBy: currentUser?.id,
      isWaiterOrder: true,
      priority: 'normal'
    };
    set((state) => ({ orders: [...state.orders, newOrder] }));
    syncToBackend(() => ordersApi.create(newOrder));
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

  updateOrderItemStatus: (orderId, itemId, status, completedQty) => set((state) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return {};
    
    const updatedItems = order.items.map(item => 
      item.id === itemId 
        ? { ...item, status, completedQty: completedQty !== undefined ? completedQty : item.completedQty }
        : item
    );
    
    // Check if all items are ready
    const allReady = updatedItems.every(item => item.status === 'ready' || (item.completedQty || 0) >= item.qty);
    
    return {
      orders: state.orders.map(o =>
        o.id === orderId 
          ? { 
              ...o, 
              items: updatedItems, 
              updatedAt: getNepalTimestamp(),
              // Auto-update order status if all items ready
              status: allReady ? 'ready' : o.status
            } 
          : o
      )
    };
  }),

  setOrderPriority: (orderId, priority) => set((state) => ({
    orders: state.orders.map(o =>
      o.id === orderId ? { ...o, priority, updatedAt: getNepalTimestamp() } : o
    )
  })),

  getOrdersByTable: (tableNumber) =>
    get().orders.filter(o => o.tableNumber === tableNumber && o.status !== 'cancelled'),

  getOrdersByPhone: (phone) =>
    get().orders.filter(o => o.customerPhone === phone),

  getOrdersByWaiter: (staffId) =>
    get().orders.filter(o => o.createdBy === staffId && o.isWaiterOrder),

  getPendingOrders: () =>
    get().orders.filter(o => o.status === 'pending'),

  getActiveOrders: () =>
    get().orders.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)),

  getKitchenOrders: () =>
    get().orders.filter(o => ['accepted', 'preparing'].includes(o.status)),

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

    // Get order IDs that need to be marked as served
    const orderIds = bill.orders.map(o => o.id);

    set((state) => ({
      bills: state.bills.map(b =>
        b.id === billId ? { ...b, status: 'paid' as const, paymentMethod, paidAt } : b
      ),
      orders: state.orders.map(o =>
        bill.orders.some(bo => bo.id === o.id) ? { ...o, status: 'served' as OrderStatus } : o
      ),
      transactions: [...state.transactions, transaction],
    }));

    // Sync bill payment to backend
    syncToBackend(() => billsApi.pay(billId, paymentMethod));
    syncToBackend(() => transactionsApi.create(transaction));
    
    // IMPORTANT: Also sync order status changes to database for realtime sync
    orderIds.forEach(orderId => {
      syncToBackend(() => ordersApi.updateStatus(orderId, 'served'));
    });

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

  updateCustomerPhone: async (oldPhone, newPhone) => {
    const state = get();
    const existing = state.customers.find(c => c.phone === oldPhone);
    if (!existing) return;
    
    // Check if new phone already exists
    if (state.customers.some(c => c.phone === newPhone)) {
      throw new Error('Phone number already exists');
    }
    
    // Update customer record
    set({
      customers: state.customers.map(c =>
        c.phone === oldPhone ? { ...c, phone: newPhone } : c
      )
    });
    
    // Update all orders with the old phone number
    set((s) => ({
      orders: s.orders.map(o =>
        o.customerPhone === oldPhone ? { ...o, customerPhone: newPhone } : o
      )
    }));
    
    // Update all transactions with the old phone number
    set((s) => ({
      transactions: s.transactions.map(t => ({
        ...t,
        customerPhones: t.customerPhones.map(p => p === oldPhone ? newPhone : p)
      }))
    }));
    
    // Update all bills with the old phone number
    set((s) => ({
      bills: s.bills.map(b => ({
        ...b,
        customerPhones: b.customerPhones.map(p => p === oldPhone ? newPhone : p)
      }))
    }));
    
    // Store the phone change in localStorage to notify customer pages
    const phoneChanges = JSON.parse(localStorage.getItem('sajilo:phoneChanges') || '[]');
    phoneChanges.push({ oldPhone, newPhone, timestamp: Date.now() });
    // Keep only changes from the last hour
    const recentChanges = phoneChanges.filter((c: any) => Date.now() - c.timestamp < 3600000);
    localStorage.setItem('sajilo:phoneChanges', JSON.stringify(recentChanges));
    
    // Sync all changes to backend
    await customersApi.updatePhone(oldPhone, newPhone);
    
    // Update orders in database
    const ordersToUpdate = state.orders.filter(o => o.customerPhone === oldPhone);
    for (const order of ordersToUpdate) {
      await ordersApi.updateCustomerPhone(order.id, newPhone);
    }
    
    // Update transactions in database
    const transactionsToUpdate = state.transactions.filter(t => t.customerPhones.includes(oldPhone));
    for (const tx of transactionsToUpdate) {
      await transactionsApi.updateCustomerPhone(tx.id, oldPhone, newPhone);
    }
    
    // Update bills in database
    const billsToUpdate = state.bills.filter(b => b.customerPhones.includes(oldPhone));
    for (const bill of billsToUpdate) {
      await billsApi.updateCustomerPhone(bill.id, oldPhone, newPhone);
    }
  },

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
  setSettings: (settings) => set((state) => ({ 
    settings: { 
      ...defaultSettings, 
      ...state.settings, // Preserve current state
      ...(settings || {}) // Apply new settings on top
    } 
  })),

  updateSettings: async (newSettings) => {
    const previousSettings = get().settings;
    const updated = { ...previousSettings, ...newSettings };
    
    // Optimistically update UI
    set({ settings: updated });
    
    // Sync to backend - revert on failure
    try {
      await settingsApi.update(updated);
    } catch (err) {
      console.error('[Store] Settings sync failed, reverting:', err);
      set({ settings: previousSettings });
      throw err; // Re-throw so caller knows it failed
    }
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

  // ===========================================
  // INVENTORY MANAGEMENT
  // ===========================================
  
  // Inventory Categories
  inventoryCategories: [],
  setInventoryCategories: (cats) => set({ inventoryCategories: cats }),
  
  addInventoryCategory: (cat) => {
    const newCat: InventoryCategory = { 
      ...cat, 
      id: generateId(), 
      createdAt: getNepalTimestamp() 
    };
    set((state) => ({ inventoryCategories: [...state.inventoryCategories, newCat] }));
    syncToBackend(() => inventoryCategoriesApi.create(newCat));
  },
  
  updateInventoryCategory: (id, cat) => {
    const current = get().inventoryCategories.find(c => c.id === id);
    if (!current) return;
    const updated = { ...current, ...cat };
    set((state) => ({
      inventoryCategories: state.inventoryCategories.map(c => c.id === id ? updated : c)
    }));
    syncToBackend(() => inventoryCategoriesApi.update(id, updated));
  },
  
  deleteInventoryCategory: (id) => {
    set((state) => ({ inventoryCategories: state.inventoryCategories.filter(c => c.id !== id) }));
    syncToBackend(() => inventoryCategoriesApi.delete(id));
  },
  
  // Inventory Items
  inventoryItems: [],
  setInventoryItems: (items) => set({ inventoryItems: items }),
  
  addInventoryItem: (item) => {
    const now = getNepalTimestamp();
    const newItem: InventoryItem = { 
      ...item, 
      id: generateId(), 
      createdAt: now,
      updatedAt: now
    };
    set((state) => ({ inventoryItems: [...state.inventoryItems, newItem] }));
    syncToBackend(() => inventoryItemsApi.create(newItem));
  },
  
  updateInventoryItem: (id, item) => {
    const current = get().inventoryItems.find(i => i.id === id);
    if (!current) return;
    const updated = { ...current, ...item, updatedAt: getNepalTimestamp() };
    set((state) => ({
      inventoryItems: state.inventoryItems.map(i => i.id === id ? updated : i)
    }));
    syncToBackend(() => inventoryItemsApi.update(id, updated));
  },
  
  deleteInventoryItem: (id) => {
    set((state) => ({ inventoryItems: state.inventoryItems.filter(i => i.id !== id) }));
    syncToBackend(() => inventoryItemsApi.delete(id));
  },
  
  addStock: (menuItemId, quantity, unit, notes) => {
    const invItem = get().inventoryItems.find(i => i.menuItemId === menuItemId);
    if (!invItem) return;
    
    const newStock = invItem.currentStock + quantity;
    const updated = { ...invItem, currentStock: newStock, updatedAt: getNepalTimestamp() };
    
    set((state) => ({
      inventoryItems: state.inventoryItems.map(i => i.id === invItem.id ? updated : i)
    }));
    
    // Create transaction record
    const tx: InventoryTransaction = {
      id: generateId(),
      inventoryItemId: invItem.id,
      transactionType: 'receive',
      quantity,
      unit,
      notes: notes || '',
      createdBy: get().currentUser?.name || '',
      createdAt: getNepalTimestamp()
    };
    
    set((state) => ({ inventoryTransactions: [...state.inventoryTransactions, tx] }));
    
    syncToBackend(() => inventoryItemsApi.updateStock(invItem.id, newStock));
    syncToBackend(() => inventoryTransactionsApi.create(tx));
  },
  
  deductStock: (menuItemId, quantity, unit, orderId) => {
    const invItem = get().inventoryItems.find(i => i.menuItemId === menuItemId);
    if (!invItem) return;
    
    const newStock = Math.max(0, invItem.currentStock - quantity);
    const updated = { ...invItem, currentStock: newStock, updatedAt: getNepalTimestamp() };
    
    set((state) => ({
      inventoryItems: state.inventoryItems.map(i => i.id === invItem.id ? updated : i)
    }));
    
    // Create transaction record
    const tx: InventoryTransaction = {
      id: generateId(),
      inventoryItemId: invItem.id,
      transactionType: 'sale',
      quantity: -quantity,
      unit,
      orderId,
      createdBy: get().currentUser?.name || '',
      createdAt: getNepalTimestamp()
    };
    
    set((state) => ({ inventoryTransactions: [...state.inventoryTransactions, tx] }));
    
    syncToBackend(() => inventoryItemsApi.updateStock(invItem.id, newStock));
    syncToBackend(() => inventoryTransactionsApi.create(tx));
    
    // Refresh low stock items
    get().refreshLowStockItems();
  },
  
  getInventoryByMenuItemId: (menuItemId) => 
    get().inventoryItems.find(i => i.menuItemId === menuItemId),
  
  // Inventory Transactions
  inventoryTransactions: [],
  setInventoryTransactions: (txs) => set({ inventoryTransactions: txs }),
  
  // Portion Options
  portionOptions: [],
  setPortionOptions: (options) => set({ portionOptions: options }),
  
  addPortionOption: (option) => {
    const newOption: PortionOption = { 
      ...option, 
      id: generateId(), 
      createdAt: getNepalTimestamp() 
    };
    set((state) => ({ portionOptions: [...state.portionOptions, newOption] }));
    syncToBackend(() => portionOptionsApi.create(newOption));
  },
  
  updatePortionOption: (id, option) => {
    const current = get().portionOptions.find(o => o.id === id);
    if (!current) return;
    const updated = { ...current, ...option };
    set((state) => ({
      portionOptions: state.portionOptions.map(o => o.id === id ? updated : o)
    }));
    syncToBackend(() => portionOptionsApi.update(id, updated));
  },
  
  deletePortionOption: (id) => {
    set((state) => ({ portionOptions: state.portionOptions.filter(o => o.id !== id) }));
    syncToBackend(() => portionOptionsApi.delete(id));
  },
  
  getPortionsByCategory: (categoryName) => {
    const category = get().categories.find(c => c.name === categoryName);
    if (!category) return [];
    
    const invCat = get().inventoryCategories.find(ic => ic.categoryId === category.id);
    if (!invCat) return [];
    
    return get().portionOptions.filter(p => p.inventoryCategoryId === invCat.id);
  },
  
  // Low Stock Items
  lowStockItems: [],
  setLowStockItems: (items) => set({ lowStockItems: items }),
  
  refreshLowStockItems: async () => {
    try {
      const items = await getLowStockItems();
      set({ lowStockItems: items });
    } catch (err) {
      console.error('[Store] Failed to refresh low stock items:', err);
    }
  },
  
  isInventoryCategory: (categoryId) => 
    get().inventoryCategories.some(ic => ic.categoryId === categoryId),

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
