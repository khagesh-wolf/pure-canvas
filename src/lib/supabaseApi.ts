// Supabase API Client with camelCase <-> snake_case mapping
import { supabase } from './supabase';

// ===========================================
// FIELD MAPPERS
// ===========================================

// Categories
const mapCategoryFromDb = (row: any) => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order ?? 0,
  prepTime: row.prep_time ?? 5,
});

const mapCategoryToDb = (cat: any) => ({
  id: cat.id,
  name: cat.name,
  sort_order: cat.sortOrder ?? 0,
  prep_time: cat.prepTime ?? 5,
});

// Menu Items
const mapMenuItemFromDb = (row: any) => ({
  id: row.id,
  name: row.name,
  price: Number(row.price),
  category: row.category,
  available: row.available ?? true,
  description: row.description ?? '',
  image: row.image ?? '',
});

const mapMenuItemToDb = (item: any) => ({
  id: item.id,
  name: item.name,
  price: item.price,
  category: item.category,
  available: item.available ?? true,
  description: item.description ?? '',
  image: item.image ?? '',
});

// Orders
const mapOrderFromDb = (row: any) => ({
  id: row.id,
  tableNumber: row.table_number,
  customerPhone: row.customer_phone ?? '',
  items: row.items ?? [],
  status: row.status ?? 'pending',
  total: Number(row.total),
  notes: row.notes ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
  // Waiter order fields
  createdBy: row.created_by ?? undefined,
  isWaiterOrder: row.is_waiter_order ?? false,
  priority: row.priority ?? 'normal',
});

const mapOrderToDb = (order: any) => ({
  id: order.id,
  table_number: order.tableNumber,
  customer_phone: order.customerPhone ?? '',
  items: order.items ?? [],
  status: order.status ?? 'pending',
  total: order.total,
  notes: order.notes ?? '',
  created_at: order.createdAt,
  updated_at: order.updatedAt ?? order.createdAt,
  // Waiter order fields
  created_by: order.createdBy ?? null,
  is_waiter_order: order.isWaiterOrder ?? false,
  priority: order.priority ?? 'normal',
});

// Bills
const mapBillFromDb = (row: any) => ({
  id: row.id,
  tableNumber: row.table_number,
  orders: row.orders ?? [],
  customerPhones: row.customer_phones ?? [],
  subtotal: Number(row.subtotal),
  discount: Number(row.discount ?? 0),
  total: Number(row.total),
  status: row.status ?? 'unpaid',
  paymentMethod: row.payment_method,
  paidAt: row.paid_at,
  createdAt: row.created_at,
});

const mapBillToDb = (bill: any) => ({
  id: bill.id,
  table_number: bill.tableNumber,
  orders: bill.orders ?? [],
  customer_phones: bill.customerPhones ?? [],
  subtotal: bill.subtotal,
  discount: bill.discount ?? 0,
  total: bill.total,
  status: bill.status ?? 'unpaid',
  payment_method: bill.paymentMethod,
  paid_at: bill.paidAt,
  created_at: bill.createdAt,
});

// Transactions
const mapTransactionFromDb = (row: any) => ({
  id: row.id,
  billId: row.bill_id,
  tableNumber: row.table_number,
  customerPhones: row.customer_phones ?? [],
  total: Number(row.total),
  discount: Number(row.discount ?? 0),
  paymentMethod: row.payment_method,
  paidAt: row.paid_at,
  items: row.items ?? [],
});

const mapTransactionToDb = (tx: any) => ({
  id: tx.id,
  bill_id: tx.billId,
  table_number: tx.tableNumber,
  customer_phones: tx.customerPhones ?? [],
  total: tx.total,
  discount: tx.discount ?? 0,
  payment_method: tx.paymentMethod,
  paid_at: tx.paidAt,
  items: tx.items ?? [],
});

// Customers
const mapCustomerFromDb = (row: any) => ({
  phone: row.phone,
  name: row.name ?? '',
  totalOrders: row.total_orders ?? 0,
  totalSpent: Number(row.total_spent ?? 0),
  points: row.points ?? 0,
  lastVisit: row.last_visit,
});

const mapCustomerToDb = (cust: any) => ({
  phone: cust.phone,
  name: cust.name ?? '',
  total_orders: cust.totalOrders ?? 0,
  total_spent: cust.totalSpent ?? 0,
  points: cust.points ?? 0,
  last_visit: cust.lastVisit,
});

// Staff
const mapStaffFromDb = (row: any) => ({
  id: row.id,
  username: row.username,
  password: row.password,
  pin: row.pin ?? '',
  role: row.role ?? 'counter',
  name: row.name ?? '',
  createdAt: row.created_at,
});

const mapStaffToDb = (s: any) => ({
  id: s.id,
  username: s.username,
  password: s.password,
  pin: s.pin ?? '',
  role: s.role ?? 'counter',
  name: s.name ?? '',
  created_at: s.createdAt,
});

// Settings
const mapSettingsFromDb = (row: any) => {
  if (!row) return {};
  return {
    restaurantName: row.restaurant_name ?? 'Chiyadani',
    restaurantSubName: row.restaurant_sub_name ?? '',
    tableCount: row.table_count ?? 10,
    wifiSSID: row.wifi_ssid ?? '',
    wifiPassword: row.wifi_password ?? '',
    baseUrl: row.base_url ?? '',
    logo: row.logo ?? '',
    instagramUrl: row.instagram_url ?? '',
    facebookUrl: row.facebook_url ?? '',
    tiktokUrl: row.tiktok_url ?? '',
    googleReviewUrl: row.google_review_url ?? '',
    counterAsAdmin: row.counter_as_admin ?? false,
    // Counter settings
    counterKitchenAccess: row.counter_kitchen_access ?? false,
    counterKotEnabled: row.counter_kot_enabled ?? false,
    kitchenHandles: row.kitchen_handles ?? 3,
    pointSystemEnabled: row.point_system_enabled ?? false,
    pointsPerRupee: Number(row.points_per_rupee ?? 0.1),
    pointValueInRupees: Number(row.point_value_in_rupees ?? 1),
    maxDiscountRupees: Number(row.max_discount_rupees ?? 500),
    maxDiscountPoints: row.max_discount_points ?? 500,
    // Kitchen settings
    kdsEnabled: row.kds_enabled ?? false,
    kotPrintingEnabled: row.kot_printing_enabled ?? false,
    kitchenFullscreenMode: row.kitchen_fullscreen_mode ?? false,
  };
};

const mapSettingsToDb = (s: any) => {
  const db: Record<string, any> = {};
  if (s.restaurantName !== undefined) db.restaurant_name = s.restaurantName;
  if (s.restaurantSubName !== undefined) db.restaurant_sub_name = s.restaurantSubName;
  if (s.tableCount !== undefined) db.table_count = s.tableCount;
  if (s.wifiSSID !== undefined) db.wifi_ssid = s.wifiSSID;
  if (s.wifiPassword !== undefined) db.wifi_password = s.wifiPassword;
  if (s.baseUrl !== undefined) db.base_url = s.baseUrl;
  if (s.logo !== undefined) db.logo = s.logo;
  if (s.instagramUrl !== undefined) db.instagram_url = s.instagramUrl;
  if (s.facebookUrl !== undefined) db.facebook_url = s.facebookUrl;
  if (s.tiktokUrl !== undefined) db.tiktok_url = s.tiktokUrl;
  if (s.googleReviewUrl !== undefined) db.google_review_url = s.googleReviewUrl;
  if (s.counterAsAdmin !== undefined) db.counter_as_admin = s.counterAsAdmin;
  // Counter settings
  if (s.counterKitchenAccess !== undefined) db.counter_kitchen_access = s.counterKitchenAccess;
  if (s.counterKotEnabled !== undefined) db.counter_kot_enabled = s.counterKotEnabled;
  if (s.kitchenHandles !== undefined) db.kitchen_handles = s.kitchenHandles;
  if (s.pointSystemEnabled !== undefined) db.point_system_enabled = s.pointSystemEnabled;
  if (s.pointsPerRupee !== undefined) db.points_per_rupee = s.pointsPerRupee;
  if (s.pointValueInRupees !== undefined) db.point_value_in_rupees = s.pointValueInRupees;
  if (s.maxDiscountRupees !== undefined) db.max_discount_rupees = s.maxDiscountRupees;
  if (s.maxDiscountPoints !== undefined) db.max_discount_points = s.maxDiscountPoints;
  // Kitchen settings
  if (s.kdsEnabled !== undefined) db.kds_enabled = s.kdsEnabled;
  if (s.kotPrintingEnabled !== undefined) db.kot_printing_enabled = s.kotPrintingEnabled;
  if (s.kitchenFullscreenMode !== undefined) db.kitchen_fullscreen_mode = s.kitchenFullscreenMode;
  db.updated_at = new Date().toISOString();
  return db;
};

// Expenses
const mapExpenseFromDb = (row: any) => ({
  id: row.id,
  amount: Number(row.amount),
  description: row.description ?? '',
  category: row.category,
  createdBy: row.created_by ?? '',
  createdAt: row.created_at,
});

const mapExpenseToDb = (e: any) => ({
  id: e.id,
  amount: e.amount,
  description: e.description ?? '',
  category: e.category,
  created_by: e.createdBy ?? '',
  created_at: e.createdAt,
});

// Waiter Calls
const mapWaiterCallFromDb = (row: any) => ({
  id: row.id,
  tableNumber: row.table_number,
  customerPhone: row.customer_phone ?? '',
  status: row.status ?? 'pending',
  acknowledgedAt: row.acknowledged_at,
  createdAt: row.created_at,
});

const mapWaiterCallToDb = (wc: any) => ({
  id: wc.id,
  table_number: wc.tableNumber,
  customer_phone: wc.customerPhone ?? '',
  status: wc.status ?? 'pending',
  acknowledged_at: wc.acknowledgedAt,
  created_at: wc.createdAt,
});

// ===========================================
// API FUNCTIONS
// ===========================================

// Categories API
export const categoriesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapCategoryFromDb);
  },
  create: async (category: any) => {
    const { data, error } = await supabase
      .from('categories')
      .insert(mapCategoryToDb(category))
      .select()
      .single();
    if (error) throw error;
    return mapCategoryFromDb(data);
  },
  update: async (id: string, category: any) => {
    const { data, error } = await supabase
      .from('categories')
      .update(mapCategoryToDb(category))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapCategoryFromDb(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  },
};

// Menu Items API
export const menuApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapMenuItemFromDb);
  },
  create: async (item: any) => {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(mapMenuItemToDb(item))
      .select()
      .single();
    if (error) throw error;
    return mapMenuItemFromDb(data);
  },
  update: async (id: string, item: any) => {
    const { data, error } = await supabase
      .from('menu_items')
      .update(mapMenuItemToDb(item))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapMenuItemFromDb(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;
  },
};

// Orders API
export const ordersApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapOrderFromDb);
  },
  create: async (order: any) => {
    const { data, error } = await supabase
      .from('orders')
      .insert(mapOrderToDb(order))
      .select()
      .single();
    if (error) throw error;
    return mapOrderFromDb(data);
  },
  updateStatus: async (id: string, status: string) => {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapOrderFromDb(data);
  },
  updateCustomerPhone: async (id: string, newPhone: string) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ customer_phone: newPhone, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapOrderFromDb(data);
  },
};

// Bills API
export const billsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapBillFromDb);
  },
  create: async (bill: any) => {
    const { data, error } = await supabase
      .from('bills')
      .insert(mapBillToDb(bill))
      .select()
      .single();
    if (error) throw error;
    return mapBillFromDb(data);
  },
  pay: async (id: string, paymentMethod: string) => {
    const { data, error } = await supabase
      .from('bills')
      .update({
        payment_method: paymentMethod,
        paid_at: new Date().toISOString(),
        status: 'paid',
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapBillFromDb(data);
  },
  updateCustomerPhone: async (id: string, oldPhone: string, newPhone: string) => {
    // Get the current bill first
    const { data: currentBill, error: fetchError } = await supabase
      .from('bills')
      .select('customer_phones')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;
    
    // Update the customer phones array
    const updatedPhones = (currentBill.customer_phones || []).map((p: string) => 
      p === oldPhone ? newPhone : p
    );
    
    const { data, error } = await supabase
      .from('bills')
      .update({ customer_phones: updatedPhones })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapBillFromDb(data);
  },
};

// Customers API
export const customersApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('last_visit', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapCustomerFromDb);
  },
  getByPhone: async (phone: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCustomerFromDb(data) : null;
  },
  upsert: async (customer: any) => {
    const { data, error } = await supabase
      .from('customers')
      .upsert(mapCustomerToDb(customer), { onConflict: 'phone' })
      .select()
      .single();
    if (error) throw error;
    return mapCustomerFromDb(data);
  },
  updatePhone: async (oldPhone: string, newPhone: string) => {
    const { data, error } = await supabase
      .from('customers')
      .update({ phone: newPhone })
      .eq('phone', oldPhone)
      .select()
      .single();
    if (error) throw error;
    return mapCustomerFromDb(data);
  },
};

// Staff API
export const staffApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapStaffFromDb);
  },
  create: async (staff: any) => {
    const { data, error } = await supabase
      .from('staff')
      .insert(mapStaffToDb(staff))
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? mapStaffFromDb(data) : staff;
  },
  update: async (id: string, staff: any) => {
    // Upsert so local default staff (id: '1'/'2') can be persisted even if DB is empty
    const payload = { ...staff, id };

    const { data, error } = await supabase
      .from('staff')
      .upsert(mapStaffToDb(payload), { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data ? mapStaffFromDb(data) : payload;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) throw error;
  },
};

// Settings API
export const settingsApi = {
  get: async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return mapSettingsFromDb(data);
  },
  update: async (settings: any) => {
    const payload = mapSettingsToDb(settings);

    const { data: existing, error: existingError } = await supabase
      .from('settings')
      .select('id')
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.id != null) {
      const { data, error } = await supabase
        .from('settings')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return mapSettingsFromDb(data);
    }

    const { data, error } = await supabase
      .from('settings')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return mapSettingsFromDb(data);
  },
};

// Expenses API
export const expensesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapExpenseFromDb);
  },
  create: async (expense: any) => {
    const { data, error } = await supabase
      .from('expenses')
      .insert(mapExpenseToDb(expense))
      .select()
      .single();
    if (error) throw error;
    return mapExpenseFromDb(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },
};

// Waiter Calls API
export const waiterCallsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('waiter_calls')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapWaiterCallFromDb);
  },
  create: async (call: any) => {
    const { data, error } = await supabase
      .from('waiter_calls')
      .insert(mapWaiterCallToDb(call))
      .select()
      .single();
    if (error) throw error;
    return mapWaiterCallFromDb(data);
  },
  acknowledge: async (id: string) => {
    const { data, error } = await supabase
      .from('waiter_calls')
      .update({ acknowledged_at: new Date().toISOString(), status: 'acknowledged' })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapWaiterCallFromDb(data);
  },
  dismiss: async (id: string) => {
    const { error } = await supabase.from('waiter_calls').delete().eq('id', id);
    if (error) throw error;
  },
};

// Transactions API
export const transactionsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('paid_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTransactionFromDb);
  },
  create: async (transaction: any) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(mapTransactionToDb(transaction))
      .select()
      .single();
    if (error) throw error;
    return mapTransactionFromDb(data);
  },
  updateCustomerPhone: async (id: string, oldPhone: string, newPhone: string) => {
    // Get the current transaction first
    const { data: currentTx, error: fetchError } = await supabase
      .from('transactions')
      .select('customer_phones')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;
    
    // Update the customer phones array
    const updatedPhones = (currentTx.customer_phones || []).map((p: string) => 
      p === oldPhone ? newPhone : p
    );
    
    const { data, error } = await supabase
      .from('transactions')
      .update({ customer_phones: updatedPhones })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapTransactionFromDb(data);
  },
};

// ===========================================
// INVENTORY API
// ===========================================

// Inventory Categories
const mapInventoryCategoryFromDb = (row: any) => ({
  id: row.id,
  categoryId: row.category_id,
  unitType: row.unit_type ?? 'pcs',
  defaultContainerSize: row.default_container_size ? Number(row.default_container_size) : undefined,
  lowStockThreshold: Number(row.low_stock_threshold ?? 5),
  createdAt: row.created_at,
});

const mapInventoryCategoryToDb = (item: any) => ({
  id: item.id,
  category_id: item.categoryId,
  unit_type: item.unitType ?? 'pcs',
  default_container_size: item.defaultContainerSize ?? null,
  low_stock_threshold: item.lowStockThreshold ?? 5,
});

export const inventoryCategoriesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('inventory_categories')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapInventoryCategoryFromDb);
  },
  create: async (item: any) => {
    const { data, error } = await supabase
      .from('inventory_categories')
      .insert(mapInventoryCategoryToDb(item))
      .select()
      .single();
    if (error) throw error;
    return mapInventoryCategoryFromDb(data);
  },
  update: async (id: string, item: any) => {
    const { data, error } = await supabase
      .from('inventory_categories')
      .update(mapInventoryCategoryToDb(item))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapInventoryCategoryFromDb(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase
      .from('inventory_categories')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Inventory Items
const mapInventoryItemFromDb = (row: any) => ({
  id: row.id,
  menuItemId: row.menu_item_id,
  currentStock: Number(row.current_stock ?? 0),
  containerSize: row.container_size ? Number(row.container_size) : undefined,
  unit: row.unit ?? 'pcs',
  lowStockThreshold: row.low_stock_threshold ? Number(row.low_stock_threshold) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapInventoryItemToDb = (item: any) => ({
  id: item.id,
  menu_item_id: item.menuItemId,
  current_stock: item.currentStock ?? 0,
  container_size: item.containerSize ?? null,
  unit: item.unit ?? 'pcs',
  low_stock_threshold: item.lowStockThreshold ?? null,
});

export const inventoryItemsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*');
    if (error) throw error;
    return (data || []).map(mapInventoryItemFromDb);
  },
  create: async (item: any) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert(mapInventoryItemToDb(item))
      .select()
      .single();
    if (error) throw error;
    return mapInventoryItemFromDb(data);
  },
  update: async (id: string, item: any) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .update(mapInventoryItemToDb(item))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapInventoryItemFromDb(data);
  },
  updateStock: async (id: string, newStock: number) => {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapInventoryItemFromDb(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Inventory Transactions
const mapInventoryTransactionFromDb = (row: any) => ({
  id: row.id,
  inventoryItemId: row.inventory_item_id,
  transactionType: row.transaction_type,
  quantity: Number(row.quantity),
  unit: row.unit,
  orderId: row.order_id,
  notes: row.notes ?? '',
  createdBy: row.created_by ?? '',
  createdAt: row.created_at,
});

const mapInventoryTransactionToDb = (item: any) => ({
  id: item.id,
  inventory_item_id: item.inventoryItemId,
  transaction_type: item.transactionType,
  quantity: item.quantity,
  unit: item.unit,
  order_id: item.orderId ?? null,
  notes: item.notes ?? '',
  created_by: item.createdBy ?? '',
});

export const inventoryTransactionsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapInventoryTransactionFromDb);
  },
  create: async (item: any) => {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .insert(mapInventoryTransactionToDb(item))
      .select()
      .single();
    if (error) throw error;
    return mapInventoryTransactionFromDb(data);
  },
};

// Portion Options
const mapPortionOptionFromDb = (row: any) => ({
  id: row.id,
  inventoryCategoryId: row.inventory_category_id,
  name: row.name,
  size: Number(row.size),
  priceMultiplier: Number(row.price_multiplier ?? 1),
  sortOrder: row.sort_order ?? 0,
  createdAt: row.created_at,
});

const mapPortionOptionToDb = (item: any) => ({
  id: item.id,
  inventory_category_id: item.inventoryCategoryId,
  name: item.name,
  size: item.size,
  price_multiplier: item.priceMultiplier ?? 1,
  sort_order: item.sortOrder ?? 0,
});

export const portionOptionsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('portion_options')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapPortionOptionFromDb);
  },
  create: async (item: any) => {
    const { data, error } = await supabase
      .from('portion_options')
      .insert(mapPortionOptionToDb(item))
      .select()
      .single();
    if (error) throw error;
    return mapPortionOptionFromDb(data);
  },
  update: async (id: string, item: any) => {
    const { data, error } = await supabase
      .from('portion_options')
      .update(mapPortionOptionToDb(item))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapPortionOptionFromDb(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase
      .from('portion_options')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Low Stock Items
export const getLowStockItems = async () => {
  const { data, error } = await supabase.rpc('get_low_stock_items');
  if (error) throw error;
  return (data || []).map((row: any) => ({
    inventoryItemId: row.inventory_item_id,
    menuItemName: row.menu_item_name,
    currentStock: Number(row.current_stock),
    threshold: Number(row.threshold),
    unit: row.unit,
  }));
};

// Health check
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('settings').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

// Compatibility export
export const getApiBaseUrl = () => import.meta.env.VITE_SUPABASE_URL || '';
