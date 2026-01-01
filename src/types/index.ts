export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  prepTime?: number; // Average prep time in minutes
  parentId?: string; // For subcategories (e.g., "Beers" under "Drinks")
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  description?: string;
  image?: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  qty: number;
  price: number;
  status?: OrderItemStatus; // For kitchen item-level tracking
  completedQty?: number; // How many of this item are completed
  portionSize?: number; // Size of portion (e.g., 30 for 30ml) - for inventory tracking
  portionName?: string; // Name of portion (e.g., "30ml (Peg)")
}

export type OrderItemStatus = 'pending' | 'preparing' | 'ready';

export interface Order {
  id: string;
  tableNumber: number;
  customerPhone: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  total: number;
  notes?: string;
  createdBy?: string; // Staff ID who created the order (for waiter orders)
  isWaiterOrder?: boolean; // True if created by waiter (auto-accepted)
  priority?: 'normal' | 'rush'; // Rush orders get highlighted
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'cancelled';

export type PaymentMethod = 'cash' | 'fonepay' | 'split';

export interface Bill {
  id: string;
  tableNumber: number;
  orders: Order[];
  customerPhones: string[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'unpaid' | 'paid';
  paymentMethod?: PaymentMethod;
  paidAt?: string;
  createdAt: string;
  splitDetails?: {
    cashAmount: number;
    fonepayAmount: number;
  };
}

export interface Transaction {
  id: string;
  billId: string;
  tableNumber: number;
  customerPhones: string[];
  total: number;
  discount: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  items: OrderItem[];
  splitDetails?: {
    cashAmount: number;
    fonepayAmount: number;
  };
}

export interface Customer {
  phone: string;
  name?: string;
  totalOrders: number;
  totalSpent: number;
  points: number;
  lastVisit: string;
  firstVisit?: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum'; // Generated from totalSpent
}

export interface Staff {
  id: string;
  username: string;
  password: string;
  pin?: string; // 4-6 digit PIN for quick actions
  role: StaffRole;
  name: string;
  createdAt: string;
}

export type StaffRole = 'admin' | 'counter' | 'waiter' | 'kitchen';

export interface Settings {
  restaurantName: string;
  restaurantSubName?: string; // Optional sub name like "Digital Menu", "Restaurant", etc.
  tableCount: number;
  wifiSSID: string;
  wifiPassword: string;
  baseUrl: string;
  logo?: string;
  // Social media links
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  googleReviewUrl?: string;
  // Admin-less mode: counter gets full admin access
  counterAsAdmin?: boolean;
  // Counter settings
  counterKitchenAccess?: boolean; // If enabled, counter staff can access Kitchen page
  counterKotEnabled?: boolean; // If enabled, counter can print KOT when accepting orders
  // Kitchen settings
  kitchenHandles?: number; // Number of parallel orders kitchen can handle (default: 3)
  kotPrintingEnabled?: boolean; // Kitchen Order Ticket printing (for waiter orders)
  kdsEnabled?: boolean; // Kitchen Display System - if On, both Kitchen and Counter can accept orders
  kitchenFullscreenMode?: boolean; // Fullscreen mode with larger fonts for wall-mounted displays
  // Point system settings
  pointSystemEnabled?: boolean;
  pointsPerRupee?: number;       // How many points earned per rupee spent (e.g., 1 point per 10 rupees = 0.1)
  pointValueInRupees?: number;   // How much 1 point is worth in rupees (e.g., 1 point = 1 rupee)
  maxDiscountRupees?: number;    // Maximum discount in rupees that can be applied
  maxDiscountPoints?: number;    // Maximum points that can be used at once
  // Theme
  theme?: 'light' | 'dark' | 'system';
  // Sound alerts
  soundAlertsEnabled?: boolean;
  // Order cancellation restriction
  acceptedOrderCancelAdminOnly?: boolean; // If true, only admin/counter-as-admin can cancel accepted orders
}

export interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  activeTables: number;
}

export type ExpenseCategory = 'ingredients' | 'utilities' | 'salary' | 'maintenance' | 'rent' | 'marketing' | 'equipment' | 'other';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  vendor?: string;
  receiptNumber?: string;
  createdAt: string;
  createdBy: string;
}

// Cash Drawer / Daily Reconciliation
export interface CashDrawerSession {
  id: string;
  openingBalance: number;
  closingBalance?: number;
  expectedCash?: number; // Opening + cash sales - cash expenses
  discrepancy?: number; // Closing - Expected
  openedAt: string;
  closedAt?: string;
  openedBy: string;
  closedBy?: string;
  notes?: string;
  status: 'open' | 'closed';
}

export interface WaiterCall {
  id: string;
  tableNumber: number;
  customerPhone: string;
  status: 'pending' | 'acknowledged';
  createdAt: string;
  acknowledgedAt?: string;
}

// ===========================================
// INVENTORY TYPES
// ===========================================

export type InventoryUnitType = 'ml' | 'pcs' | 'grams' | 'bottle' | 'pack' | 'kg' | 'liter';

export type InventoryStockStatus = 'ok' | 'low' | 'critical' | 'out';

export interface InventoryItem {
  id: string;
  menuItemId: string;
  currentStock: number;
  defaultBottleSize?: number; // Container size (e.g., 750ml bottle)
  unit: InventoryUnitType;
  lowStockThreshold?: number;
  stockStatus?: InventoryStockStatus; // Generated column for fast queries
  createdAt: string;
  updatedAt: string;
}

export type InventoryTransactionType = 'receive' | 'sale' | 'adjustment' | 'waste';

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  unit: InventoryUnitType;
  orderId?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface PortionOption {
  id: string;
  inventoryItemId: string; // Now links to inventory item directly, not category
  name: string;
  size: number;
  priceMultiplier: number;
  fixedPrice?: number; // Fixed price for this portion
  sortOrder: number;
  createdAt: string;
}

export interface ItemPortionPrice {
  id: string;
  menuItemId: string;
  portionOptionId: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface LowStockItem {
  inventoryItemId: string;
  menuItemName: string;
  currentStock: number;
  threshold: number;
  unit: InventoryUnitType;
  stockStatus?: InventoryStockStatus;
}

// Daily stats from optimized function
export interface DailyStatsResult {
  totalRevenue: number;
  totalOrders: number;
  totalTransactions: number;
  cashRevenue: number;
  digitalRevenue: number;
  totalExpenses: number;
  netRevenue: number;
}

// Active orders summary for counter
export interface ActiveOrdersSummary {
  pendingCount: number;
  acceptedCount: number;
  preparingCount: number;
  readyCount: number;
  oldestPendingMinutes: number;
}
