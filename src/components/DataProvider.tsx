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
  inventoryItemsApi,
  inventoryTransactionsApi,
  portionOptionsApi,
  itemPortionPricesApi,
  getLowStockItems,
  checkBackendHealth,
} from '@/lib/apiClient';
import { Loader2, Cloud, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DataProviderProps {
  children: React.ReactNode;
}

type RealtimeStatus =
  | 'SUBSCRIBED'
  | 'TIMED_OUT'
  | 'CLOSED'
  | 'CHANNEL_ERROR'
  | 'JOINING'
  | 'LEAVING';

export function DataProvider({ children }: DataProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Debounce helper to reduce API calls (free tier optimization)
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedFetch = (key: string, fn: () => Promise<void>, delay = 500) => {
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(() => {
      fn().catch(console.error);
    }, delay);
  };

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
        menuItems,
        orders,
        bills,
        customers,
        staff,
        settings,
        expenses,
        waiterCalls,
        transactions,
        categories,
        inventoryItems,
        inventoryTransactions,
        portionOptions,
        itemPortionPrices,
        lowStockItems,
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
        inventoryItemsApi.getAll().catch(() => []),
        inventoryTransactionsApi.getAll().catch(() => []),
        portionOptionsApi.getAll().catch(() => []),
        itemPortionPricesApi.getAll().catch(() => []),
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
      store.setInventoryItems(inventoryItems || []);
      store.setInventoryTransactions(inventoryTransactions || []);
      store.setPortionOptions(portionOptions || []);
      store.setItemPortionPrices(itemPortionPrices || []);
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

  // Set up Supabase Realtime subscriptions (optimized for free tier)
  useEffect(() => {
    // Initial load
    loadDataFromBackend();

    let activeChannel: ReturnType<typeof supabase.channel> | null = null;
    let destroyed = false;
    let isSubscribed = false; // Track if currently subscribed
    let isTabVisible = document.visibilityState === 'visible'; // Track tab visibility

    const reconnectAttemptRef = { current: 0 };
    const reconnectTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const hasShownRealtimeToastRef = { current: false };

    // Fallback polling when Realtime is unavailable (e.g. WebSocket blocked or publication not enabled)
    const ordersPollTimerRef = { current: null as ReturnType<typeof setInterval> | null };
    const hasShownPollingToastRef = { current: false };

    // If a channel never reaches SUBSCRIBED (common when WebSockets are blocked),
    // start polling automatically instead of requiring a manual page refresh.
    const realtimeWatchdogRef = { current: null as ReturnType<typeof setTimeout> | null };

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const clearRealtimeWatchdog = () => {
      if (realtimeWatchdogRef.current) {
        clearTimeout(realtimeWatchdogRef.current);
        realtimeWatchdogRef.current = null;
      }
    };

    const stopOrdersPolling = () => {
      if (ordersPollTimerRef.current) {
        clearInterval(ordersPollTimerRef.current);
        ordersPollTimerRef.current = null;
      }
      hasShownPollingToastRef.current = false;
    };

    const startOrdersPolling = () => {
      if (destroyed || ordersPollTimerRef.current) return;

      if (!hasShownPollingToastRef.current) {
        hasShownPollingToastRef.current = true;
        toast.info('Realtime unavailable — using auto-refresh for orders.', {
          description: 'New customer orders may take a few seconds to appear.',
        });
      }

      // Keep this conservative to avoid hammering the free tier.
      ordersPollTimerRef.current = setInterval(() => {
        debouncedFetch('orders_poll', async () => {
          const orders = await ordersApi.getAll().catch(() => []);
          useStore.getState().setOrders(orders);
        }, 250);
      }, 4000);
    };


    const scheduleReconnect = (status: RealtimeStatus) => {
      if (destroyed) return;

      // Don't spam reconnect attempts or toasts when tab is hidden
      if (!isTabVisible) {
        console.log('[DataProvider] Tab hidden, deferring reconnect');
        return;
      }

      // When realtime is down, ensure counter still gets new customer orders.
      startOrdersPolling();

      clearRealtimeWatchdog();
      clearReconnectTimer();

      // Exponential backoff (1s → 2s → 4s → 8s → 16s, max 20s)
      const delay = Math.min(20000, 1000 * Math.pow(2, reconnectAttemptRef.current));
      reconnectAttemptRef.current += 1;

      // Only show toast once per reconnect cycle, and only if tab is visible
      if (!hasShownRealtimeToastRef.current && isTabVisible) {
        hasShownRealtimeToastRef.current = true;
        toast.warning('Realtime disconnected. Reconnecting...', {
          description: `Status: ${status}. Orders may take a moment to sync.`,
          duration: 4000,
        });
      }

      reconnectTimerRef.current = setTimeout(() => {
        if (destroyed || !isTabVisible) return;
        setupRealtime();
      }, delay);
    };

    // IMPORTANT: Put all table listeners on a single channel to reduce connections.
    const setupRealtime = () => {
      clearReconnectTimer();
      clearRealtimeWatchdog();

      // If the channel never reaches SUBSCRIBED, fall back to polling (no manual refresh needed).
      realtimeWatchdogRef.current = setTimeout(() => {
        if (destroyed) return;
        startOrdersPolling();
      }, 6000);

      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }

      // CRITICAL TABLES - Real-time sync needed for multi-device restaurant operation
      activeChannel = supabase
        .channel('restaurant-sync')
        // Orders - Counter needs instant updates when customers place orders
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          debouncedFetch('orders', async () => {
            console.log('[Realtime] Orders synced');
            const orders = await ordersApi.getAll().catch(() => []);
            useStore.getState().setOrders(orders);
          });
        })
        // Waiter calls - Counter needs alerts when customers call for service
        .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, () => {
          debouncedFetch('waiter_calls', async () => {
            console.log('[Realtime] Waiter calls synced');
            const waiterCalls = await waiterCallsApi.getAll().catch(() => []);
            useStore.getState().setWaiterCalls(waiterCalls);
          });
        })
        // Bills - For payment status sync across devices
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, () => {
          debouncedFetch('bills', async () => {
            console.log('[Realtime] Bills synced');
            const [bills, transactions] = await Promise.all([
              billsApi.getAll().catch(() => []),
              transactionsApi.getAll().catch(() => []),
            ]);
            const store = useStore.getState();
            store.setBills(bills);
            store.setTransactions(transactions);
          });
        })
        // Inventory - Prevent overselling by syncing stock levels
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
          debouncedFetch('inventory', async () => {
            console.log('[Realtime] Inventory synced');
            const [inventoryItems, lowStockItems] = await Promise.all([
              inventoryItemsApi.getAll().catch(() => []),
              getLowStockItems().catch(() => []),
            ]);
            const store = useStore.getState();
            store.setInventoryItems(inventoryItems);
            store.setLowStockItems(lowStockItems);
          });
        })
        // Inventory transactions - Track stock movements
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions' }, () => {
          debouncedFetch('inventory_transactions', async () => {
            console.log('[Realtime] Inventory transactions synced');
            const [inventoryItems, inventoryTransactions, lowStockItems] = await Promise.all([
              inventoryItemsApi.getAll().catch(() => []),
              inventoryTransactionsApi.getAll().catch(() => []),
              getLowStockItems().catch(() => []),
            ]);
            const store = useStore.getState();
            store.setInventoryItems(inventoryItems);
            store.setInventoryTransactions(inventoryTransactions);
            store.setLowStockItems(lowStockItems);
          });
        })
        // Portion options - Sync portion configuration changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'portion_options' }, () => {
          debouncedFetch('portion_options', async () => {
            console.log('[Realtime] Portion options synced');
            const portionOptions = await portionOptionsApi.getAll().catch(() => []);
            useStore.getState().setPortionOptions(portionOptions);
          });
        })
        // Item portion prices - Sync price changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'item_portion_prices' }, () => {
          debouncedFetch('item_portion_prices', async () => {
            console.log('[Realtime] Item portion prices synced');
            const itemPortionPrices = await itemPortionPricesApi.getAll().catch(() => []);
            useStore.getState().setItemPortionPrices(itemPortionPrices);
          });
        })
        // Menu items - Sync availability and price changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
          debouncedFetch('menu', async () => {
            console.log('[Realtime] Menu synced');
            const menuItems = await menuApi.getAll().catch(() => []);
            useStore.getState().setMenuItems(menuItems);
          });
        })
        // Categories - Sync menu structure changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
          debouncedFetch('categories', async () => {
            console.log('[Realtime] Categories synced');
            const categories = await categoriesApi.getAll().catch(() => []);
            useStore.getState().setCategories(categories);
          });
        })
        // Settings - Sync restaurant config across devices
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
          debouncedFetch('settings', async () => {
            console.log('[Realtime] Settings synced');
            const settings = await settingsApi.get().catch(() => null);
            if (settings) useStore.getState().setSettings(settings);
          });
        })
        // Expenses - Sync expense entries for accounting
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
          debouncedFetch('expenses', async () => {
            console.log('[Realtime] Expenses synced');
            const expenses = await expensesApi.getAll().catch(() => []);
            useStore.getState().setExpenses(expenses);
          });
        })
        // Staff - Sync staff changes
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => {
          debouncedFetch('staff', async () => {
            console.log('[Realtime] Staff synced');
            const staff = await staffApi.getAll().catch(() => []);
            useStore.getState().setStaff(staff);
          });
        })
        // Customers - Sync customer data
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
          debouncedFetch('customers', async () => {
            console.log('[Realtime] Customers synced');
            const customers = await customersApi.getAll().catch(() => []);
            useStore.getState().setCustomers(customers);
          });
        })
        // Transactions - Sync payment transactions
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          debouncedFetch('transactions', async () => {
            console.log('[Realtime] Transactions synced');
            const transactions = await transactionsApi.getAll().catch(() => []);
            useStore.getState().setTransactions(transactions);
          });
        })
        .subscribe((status) => {
          console.log('[Realtime] Subscription status:', status);

          if (status === 'SUBSCRIBED') {
            isSubscribed = true;
            reconnectAttemptRef.current = 0;
            hasShownRealtimeToastRef.current = false;
            clearRealtimeWatchdog();
            stopOrdersPolling();
            return;
          }

          // Reconnect on known failure states
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            isSubscribed = false;
            scheduleReconnect(status);
          }
        });
    };

    const handleOnline = () => {
      if (destroyed) return;
      console.log('[DataProvider] Browser online — refreshing data and reconnecting Realtime');

      // Refresh critical data immediately so the UI updates even if WS is blocked.
      debouncedFetch(
        'orders_online',
        async () => {
          const orders = await ordersApi.getAll().catch(() => []);
          useStore.getState().setOrders(orders);
        },
        100
      );

      // Attempt to re-establish Realtime immediately (don't wait for backoff timers).
      reconnectAttemptRef.current = 0;
      setupRealtime();
    };

    // Handle tab visibility change - only refresh data, don't force reconnect if already connected
    const handleVisibilityChange = () => {
      if (destroyed) return;
      
      isTabVisible = document.visibilityState === 'visible';
      
      if (isTabVisible) {
        console.log('[DataProvider] Tab became visible — refreshing data');
        
        // Refresh data immediately when returning to tab
        debouncedFetch(
          'visibility_refresh',
          async () => {
            const [orders, waiterCalls] = await Promise.all([
              ordersApi.getAll().catch(() => []),
              waiterCallsApi.getAll().catch(() => []),
            ]);
            const store = useStore.getState();
            store.setOrders(orders);
            store.setWaiterCalls(waiterCalls);
          },
          100
        );

        // Only reconnect if not currently subscribed
        if (!isSubscribed) {
          console.log('[DataProvider] Not subscribed, attempting reconnect');
          reconnectAttemptRef.current = 0;
          hasShownRealtimeToastRef.current = false;
          setupRealtime();
        }
      } else {
        console.log('[DataProvider] Tab hidden — pausing reconnect attempts');
        // Clear any pending reconnect timers when tab goes hidden
        clearReconnectTimer();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    setupRealtime();

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      destroyed = true;
      clearReconnectTimer();
      clearRealtimeWatchdog();
      stopOrdersPolling();

      // Clear any pending debounce timers
      Object.values(debounceTimers.current).forEach(clearTimeout);

      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }
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
