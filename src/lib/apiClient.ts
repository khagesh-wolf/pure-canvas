// API Client - Re-exports from Supabase API
// This file maintains backward compatibility while using Supabase as backend

export {
  categoriesApi,
  menuApi,
  ordersApi,
  billsApi,
  customersApi,
  staffApi,
  settingsApi,
  expensesApi,
  waiterCallsApi,
  transactionsApi,
  // Inventory APIs
  inventoryCategoriesApi,
  inventoryItemsApi,
  inventoryTransactionsApi,
  portionOptionsApi,
  getLowStockItems,
  checkBackendHealth,
  getApiBaseUrl,
} from './supabaseApi';
