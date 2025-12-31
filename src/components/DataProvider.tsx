import { useEffect, useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import {
  menuApi,
  ordersApi,
  billsApi,
  customersApi,
  staffApi,
  settingsApi,
  expensesApi,
  waiterCallsApi,
  transactionsApi,
  categoriesApi,
  inventoryCategoriesApi,
  inventoryItemsApi,
  inventoryTransactionsApi,
  portionOptionsApi,
  getLowStockItems,
  checkBackendHealth,
} from '@/lib/apiClient';
import { Loader2, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataProviderProps {
  children: React.ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const loadDataFromBackend = async () => {
    if (hasLoadedRef.current) {
      console.log('[DataProvider] Already loaded, skipping...');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const healthy = await checkBackendHealth();
      if (!healthy) {
        throw new Error('Cannot connect to database. Please check your Supabase configuration.');
      }

      // Fetch all data from Supabase (including inventory)
      const [
        menuItems, orders, bills, customers, staff, settings, expenses, waiterCalls, transactions, categories,
        inventoryCategories, inventoryItems, inventoryTransactions, portionOptions, lowStockItems
      ] = await Promise.all([
        menuApi.getAll().catch(() => []),
        ordersApi.getAll().catch(() => []),
        billsApi.getAll().catch(() => []),
        customersApi.getAll().catch(() => []),
        staffApi.getAll().catch(() => []),
        settingsApi.get().catch(() => null),
        expensesApi.getAll().catch(() => []),
        waiterCallsApi.getAll().catch(() => []),
        transactionsApi.getAll().catch(() => []),
        categoriesApi.getAll().catch(() => []),
        inventoryCategoriesApi.getAll().catch(() => []),
        inventoryItemsApi.getAll().catch(() => []),
        inventoryTransactionsApi.getAll().catch(() => []),
        portionOptionsApi.getAll().catch(() => []),
        getLowStockItems().catch(() => []),
      ]);

      // Update store with backend data
      const store = useStore.getState();
      store.setMenuItems(menuItems || []);
      store.setOrders(orders || []);
      store.setBills(bills || []);
      store.setCustomers(customers || []);
      store.setStaff(staff || []);
      store.setSettings(settings);
      store.setExpenses(expenses || []);
      store.setWaiterCalls(waiterCalls || []);
      store.setTransactions(transactions || []);
      store.setCategories(categories || []);
      // Inventory data
      store.setInventoryCategories(inventoryCategories || []);
      store.setInventoryItems(inventoryItems || []);
      store.setInventoryTransactions(inventoryTransactions || []);
      store.setPortionOptions(portionOptions || []);
      store.setLowStockItems(lowStockItems || []);
      store.setDataLoaded(true);

      hasLoadedRef.current = true;
      console.log('[DataProvider] Successfully loaded data from Supabase');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to database';
      setError(message);
      console.error('[DataProvider] Connection error:', message);
    } finally {
      setIsLoading(false);
    }
  };

  // Set up Supabase Realtime subscriptions
  useEffect(() => {
    // Initial load
    loadDataFromBackend();

    // Subscribe to realtime updates for orders
    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async () => {
          console.log('[DataProvider] Orders updated via Realtime');
          const orders = await ordersApi.getAll().catch(() => []);
          useStore.getState().setOrders(orders);
        }
      )
      .subscribe();

    // Subscribe to realtime updates for waiter_calls
    const waiterCallsChannel = supabase
      .channel('waiter-calls-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        async () => {
          console.log('[DataProvider] Waiter calls updated via Realtime');
          const waiterCalls = await waiterCallsApi.getAll().catch(() => []);
          useStore.getState().setWaiterCalls(waiterCalls);
        }
      )
      .subscribe();

    // Subscribe to realtime updates for bills
    const billsChannel = supabase
      .channel('bills-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        async () => {
          console.log('[DataProvider] Bills updated via Realtime');
          const [bills, transactions] = await Promise.all([
            billsApi.getAll().catch(() => []),
            transactionsApi.getAll().catch(() => []),
          ]);
          const store = useStore.getState();
          store.setBills(bills);
          store.setTransactions(transactions);
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(waiterCallsChannel);
      supabase.removeChannel(billsChannel);
    };
  }, []);

  const handleRetry = () => {
    hasLoadedRef.current = false;
    loadDataFromBackend();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Connecting to cloud...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <CloudOff className="h-16 w-16 mx-auto text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Cannot Connect to Cloud</h1>
            <p className="text-muted-foreground mt-2">{error}</p>
          </div>

          <div className="space-y-3">
            <Button onClick={handleRetry} className="w-full gap-2">
              <Cloud className="h-4 w-4" />
              Try Again
            </Button>
          </div>

          <div className="text-sm text-muted-foreground border-t pt-4">
            <p className="font-medium mb-2">Make sure:</p>
            <ul className="text-left space-y-1 text-xs">
              <li>• Supabase environment variables are configured</li>
              <li>• Database tables are created (run schema.sql)</li>
              <li>• You have internet connectivity</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
