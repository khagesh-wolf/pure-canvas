export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  prepTime?: number; // Average prep time in minutes
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

export interface Bill {
  id: string;
  tableNumber: number;
  orders: Order[];
  customerPhones: string[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'unpaid' | 'paid';
  paymentMethod?: 'cash' | 'fonepay';
  paidAt?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  billId: string;
  tableNumber: number;
  customerPhones: string[];
  total: number;
  discount: number;
  paymentMethod: 'cash' | 'fonepay';
  paidAt: string;
  items: OrderItem[];
}

export interface Customer {
  phone: string;
  name?: string;
  totalOrders: number;
  totalSpent: number;
  points: number;
  lastVisit: string;
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
}

export interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  activeTables: number;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: 'ingredients' | 'utilities' | 'salary' | 'maintenance' | 'other';
  createdAt: string;
  createdBy: string;
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

export type InventoryUnitType = 'ml' | 'pcs' | 'grams' | 'bottle' | 'pack';

export interface InventoryCategory {
  id: string;
  categoryId: string;
  unitType: InventoryUnitType;
  defaultContainerSize?: number; // e.g., 750ml for a bottle
  lowStockThreshold: number;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  menuItemId: string;
  currentStock: number;
  containerSize?: number;
  unit: InventoryUnitType;
  lowStockThreshold?: number;
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
  inventoryCategoryId: string;
  name: string;
  size: number;
  priceMultiplier: number;
  sortOrder: number;
  createdAt: string;
}

export interface LowStockItem {
  inventoryItemId: string;
  menuItemName: string;
  currentStock: number;
  threshold: number;
  unit: InventoryUnitType;
}
