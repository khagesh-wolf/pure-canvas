import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useDynamicManifest } from '@/hooks/useDynamicManifest';
import { Order, OrderItem, OrderItemStatus, OrderStatus } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Check, X, Clock, ChefHat, Bell, CheckCircle, LogOut, Coffee, RefreshCw, MonitorDot, AlertTriangle, Flame, Timer, Volume2, VolumeX, LayoutGrid, List, Play, Pause, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatNepalTime, formatNepalDateTime } from '@/lib/nepalTime';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { printKOTFromOrder, showKOTNotification } from '@/lib/kotPrinter';

const statusFlow: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready'];

// Order age thresholds (in seconds)
const AGE_WARNING = 300; // 5 minutes - yellow
const AGE_CRITICAL = 600; // 10 minutes - red

export default function Kitchen() {
  const navigate = useNavigate();
  
  // Dynamic manifest for PWA
  useDynamicManifest();
  
  const { orders, updateOrderStatus, updateOrderItemStatus, isAuthenticated, currentUser, logout, settings, categories } = useStore();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [viewMode, setViewMode] = useState<'orders' | 'items' | 'lanes'>('orders');
  const [soundEnabled, setSoundEnabled] = useState(settings.soundAlertsEnabled !== false);
  const [, forceUpdate] = useState({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  // Force update every 10 seconds to refresh timers
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 10000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if not authenticated or not authorized
  // Kitchen staff, admin, or counter staff with counterKitchenAccess enabled
  const isAuthorizedForKitchen = currentUser?.role === 'kitchen' || 
    currentUser?.role === 'admin' || 
    (currentUser?.role === 'counter' && settings.counterKitchenAccess);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    } else if (!isAuthorizedForKitchen) {
      toast.error('You do not have access to the Kitchen page');
      navigate('/counter');
    }
  }, [isAuthenticated, isAuthorizedForKitchen, navigate]);

  // Sound notification for new orders
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      // Kitchen bell sound - 3 tones
      const frequencies = [880, 1047, 1319]; // A5, C6, E6
      frequencies.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
        }, i * 150);
      });
    } catch (error) {
      console.log('Sound notification failed:', error);
    }
  };

  // Monitor for new orders
  useEffect(() => {
    const kitchenOrders = orders.filter(o => ['accepted', 'preparing'].includes(o.status));
    const currentOrderIds = new Set(kitchenOrders.map(o => o.id));
    
    if (!isInitializedRef.current) {
      previousOrderIdsRef.current = currentOrderIds;
      isInitializedRef.current = true;
      return;
    }
    
    let hasNewOrders = false;
    currentOrderIds.forEach(id => {
      if (!previousOrderIdsRef.current.has(id)) {
        hasNewOrders = true;
      }
    });
    
    if (hasNewOrders) {
      playNotificationSound();
    }
    
    previousOrderIdsRef.current = currentOrderIds;
  }, [orders, soundEnabled]);

  // Enable audio on first interaction
  useEffect(() => {
    const enableAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    document.addEventListener('click', enableAudio, { once: true });
    return () => document.removeEventListener('click', enableAudio);
  }, []);

  if (!isAuthenticated || !isAuthorizedForKitchen) {
    return null;
  }

  // When KDS is disabled, kitchen only sees accepted/preparing orders (no pending)
  // When KDS is enabled, kitchen can also see and accept pending orders
  const activeOrders = orders.filter(o => {
    if (settings.kdsEnabled) {
      return ['pending', 'accepted', 'preparing', 'ready'].includes(o.status);
    }
    // KDS disabled - kitchen only sees orders they need to prepare
    return ['accepted', 'preparing', 'ready'].includes(o.status);
  });

  const kitchenOrders = orders.filter(o => 
    ['accepted', 'preparing'].includes(o.status)
  );

  const filteredOrders = filter === 'all' 
    ? activeOrders 
    : activeOrders.filter(o => o.status === filter);

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const acceptedCount = orders.filter(o => o.status === 'accepted').length;
  const preparingCount = orders.filter(o => o.status === 'preparing').length;
  const readyCount = orders.filter(o => o.status === 'ready').length;

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    updateOrderStatus(order.id, newStatus);
    toast.success(`Order marked as ${newStatus}`);
    
    // Auto-print KOT when kitchen accepts an order (if KOT is enabled)
    if (newStatus === 'accepted' && settings.kotPrintingEnabled) {
      try {
        const printed = await printKOTFromOrder(order, settings.restaurantName);
        if (printed) {
          toast.success('KOT printed');
        } else {
          showKOTNotification(order);
        }
      } catch (error) {
        console.log('KOT print failed:', error);
        showKOTNotification(order);
      }
    }
  };

  const handleItemStatusChange = (orderId: string, itemId: string, status: OrderItemStatus, completedQty?: number) => {
    updateOrderItemStatus(orderId, itemId, status, completedQty);
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = statusFlow.indexOf(current);
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Get order age in seconds
  const getOrderAge = (createdAt: string): number => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  };

  // Format time as MM:SS
  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get age color class
  const getAgeColor = (age: number): string => {
    if (age >= AGE_CRITICAL) return 'text-destructive bg-destructive/15 animate-pulse';
    if (age >= AGE_WARNING) return 'text-warning bg-warning/15';
    return 'text-success bg-success/15';
  };

  // Group items by category for lane view
  const groupedItems = useMemo(() => {
    const groups: Record<string, Array<{ order: Order; item: OrderItem }>> = {};
    
    kitchenOrders.forEach(order => {
      order.items.forEach(item => {
        const menuItem = useStore.getState().menuItems.find(m => m.id === item.menuItemId);
        const category = menuItem?.category || 'Other';
        
        if (!groups[category]) groups[category] = [];
        groups[category].push({ order, item });
      });
    });
    
    return groups;
  }, [kitchenOrders]);

  // Sorted categories for lanes
  const sortedCategoryNames = useMemo(() => {
    const catOrder = categories.reduce((acc, c) => ({ ...acc, [c.name]: c.sortOrder }), {} as Record<string, number>);
    return Object.keys(groupedItems).sort((a, b) => (catOrder[a] || 999) - (catOrder[b] || 999));
  }, [groupedItems, categories]);

  const isFullscreen = settings.kitchenFullscreenMode;

  return (
    <div className={`min-h-screen bg-background ${isFullscreen ? 'p-2' : ''}`}>
      {/* Header - Simplified in fullscreen mode */}
      <header className={`page-header ${isFullscreen ? 'px-4 py-2' : 'px-4 sm:px-6 py-3 sm:py-4'}`}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className={`${isFullscreen ? 'w-14 h-14' : 'w-10 h-10 sm:w-12 sm:h-12'} gradient-primary rounded-xl sm:rounded-2xl flex items-center justify-center shadow-warm`}>
              <ChefHat className={`${isFullscreen ? 'w-7 h-7' : 'w-5 h-5 sm:w-6 sm:h-6'} text-primary-foreground`} />
            </div>
            <div>
              <h1 className={`font-serif font-bold text-foreground ${isFullscreen ? 'text-2xl' : 'text-base sm:text-xl'}`}>{settings.restaurantName}</h1>
              <p className={`text-muted-foreground ${isFullscreen ? 'text-base' : 'text-xs sm:text-sm'}`}>Kitchen Display</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {pendingCount > 0 && settings.kdsEnabled && (
              <span className={`pill bg-warning/15 text-warning border border-warning/20 animate-pulse-soft ${isFullscreen ? 'text-lg px-4 py-2' : 'text-xs sm:text-sm'}`}>
                <Clock className={`${isFullscreen ? 'w-5 h-5' : 'w-3 h-3 sm:w-3.5 sm:h-3.5'}`} />
                {pendingCount} New
              </span>
            )}
            {preparingCount > 0 && (
              <span className={`pill bg-primary/15 text-primary border border-primary/20 ${isFullscreen ? 'text-lg px-4 py-2' : 'text-xs sm:text-sm'}`}>
                <Flame className={`${isFullscreen ? 'w-5 h-5' : 'w-3 h-3 sm:w-3.5 sm:h-3.5'}`} />
                {preparingCount}
              </span>
            )}
            <span className={`text-muted-foreground hidden lg:block ${isFullscreen ? 'text-lg' : 'text-xs'}`}>{formatNepalDateTime(new Date())}</span>
            
            {/* Hide most controls in fullscreen mode for cleaner display */}
            {!isFullscreen && (
              <>
                <Button 
                  variant={soundEnabled ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
                  onClick={() => {
                    setSoundEnabled(!soundEnabled);
                    toast.success(soundEnabled ? 'Sound alerts disabled' : 'Sound alerts enabled');
                  }}
                  title={soundEnabled ? "Disable sound" : "Enable sound"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
                  onClick={() => navigate('/counter')}
                  title="Go to Counter"
                >
                  <MonitorDot className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            )}
            
            {/* Simplified controls in fullscreen mode */}
            {isFullscreen && (
              <Button 
                variant="ghost" 
                size="icon"
                className="h-12 w-12 rounded-lg"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="w-6 h-6" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className={`${isFullscreen ? 'p-3' : 'p-4 sm:p-6'}`}>
        {/* View Mode & Filter Tabs - Larger in fullscreen */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4 sm:mb-6">
          {/* View Mode Selector - Hidden in fullscreen (always shows orders) */}
          {!isFullscreen && (
            <div className="flex gap-2 bg-muted p-1 rounded-xl">
              <button
                onClick={() => setViewMode('orders')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'orders' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="w-4 h-4" /> Orders
              </button>
              <button
                onClick={() => setViewMode('items')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'items' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="w-4 h-4" /> Items
              </button>
              <button
                onClick={() => setViewMode('lanes')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'lanes' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ChefHat className="w-4 h-4" /> Lanes
              </button>
            </div>
          )}

          {/* Filter Tabs - Larger in fullscreen */}
          {(viewMode === 'orders' || isFullscreen) && (
            <div className={`flex gap-2 flex-wrap ${isFullscreen ? 'w-full justify-center' : ''}`}>
              <FilterTab 
                label="All" 
                count={activeOrders.length} 
                active={filter === 'all'} 
                onClick={() => setFilter('all')}
                fullscreen={isFullscreen}
              />
              {settings.kdsEnabled && (
                <FilterTab 
                  label="New" 
                  count={pendingCount} 
                  active={filter === 'pending'} 
                  onClick={() => setFilter('pending')} 
                  variant="warning"
                  fullscreen={isFullscreen}
                />
              )}
              <FilterTab 
                label="Cooking" 
                count={acceptedCount + preparingCount} 
                active={filter === 'accepted'} 
                onClick={() => setFilter('accepted')} 
                variant="default"
                fullscreen={isFullscreen}
              />
              <FilterTab 
                label="Ready" 
                count={readyCount} 
                active={filter === 'ready'} 
                onClick={() => setFilter('ready')} 
                variant="success"
                fullscreen={isFullscreen}
              />
            </div>
          )}
        </div>

        {/* Orders View - Always show in fullscreen mode */}
        {(viewMode === 'orders' || isFullscreen) && (
          <>
            {filteredOrders.length === 0 ? (
              <EmptyState fullscreen={isFullscreen} />
            ) : (
              <div className={`grid gap-4 sm:gap-5 ${
                isFullscreen 
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              }`}>
                {filteredOrders.map((order, index) => (
                  <div 
                    key={order.id} 
                    className="animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <OrderCard 
                      order={order}
                      onStatusChange={handleStatusChange}
                      onItemStatusChange={handleItemStatusChange}
                      nextStatus={getNextStatus(order.status)}
                      orderAge={getOrderAge(order.createdAt)}
                      formatTimer={formatTimer}
                      getAgeColor={getAgeColor}
                      kdsEnabled={settings.kdsEnabled || false}
                      fullscreen={isFullscreen}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Items View - Grouped by Item across all orders */}
        {viewMode === 'items' && (
          <ItemsView 
            orders={kitchenOrders}
            onItemStatusChange={handleItemStatusChange}
          />
        )}

        {/* Category Lanes View */}
        {viewMode === 'lanes' && (
          <div className="space-y-6">
            {sortedCategoryNames.length === 0 ? (
              <EmptyState />
            ) : (
              sortedCategoryNames.map(categoryName => (
                <CategoryLane
                  key={categoryName}
                  categoryName={categoryName}
                  items={groupedItems[categoryName]}
                  onItemStatusChange={handleItemStatusChange}
                  formatTimer={formatTimer}
                  getOrderAge={getOrderAge}
                  getAgeColor={getAgeColor}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ fullscreen = false }: { fullscreen?: boolean }) {
  return (
    <div className={`bg-card rounded-2xl border border-border text-center ${fullscreen ? 'p-12 sm:p-20' : 'p-8 sm:p-16'}`}>
      <div className={`bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 ${fullscreen ? 'w-24 h-24' : 'w-16 h-16 sm:w-20 sm:h-20'}`}>
        <Coffee className={`text-muted-foreground/50 ${fullscreen ? 'w-12 h-12' : 'w-8 h-8 sm:w-10 sm:h-10'}`} />
      </div>
      <h3 className={`font-serif font-semibold text-muted-foreground mb-2 ${fullscreen ? 'text-3xl' : 'text-xl sm:text-2xl'}`}>No active orders</h3>
      <p className={`text-muted-foreground/70 ${fullscreen ? 'text-xl' : 'text-sm sm:text-base'}`}>New orders will appear here automatically</p>
    </div>
  );
}

function FilterTab({ 
  label, count, active, onClick, variant = 'default', fullscreen = false
}: { 
  label: string; count: number; active: boolean; onClick: () => void;
  variant?: 'default' | 'warning' | 'success';
  fullscreen?: boolean;
}) {
  const baseClasses = fullscreen 
    ? "px-6 py-3 rounded-xl font-bold text-lg transition-all duration-200 flex items-center gap-3"
    : "px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 flex items-center gap-1 sm:gap-2";
  
  const variantClasses = {
    default: active 
      ? 'gradient-primary text-primary-foreground shadow-warm' 
      : 'bg-muted text-muted-foreground hover:bg-muted/80',
    warning: active 
      ? 'bg-warning text-warning-foreground shadow-lg' 
      : 'bg-warning/15 text-warning hover:bg-warning/25',
    success: active 
      ? 'bg-success text-success-foreground shadow-lg' 
      : 'bg-success/15 text-success hover:bg-success/25',
  };

  return (
    <button 
      onClick={onClick} 
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {label}
      <span className={`rounded-full font-bold ${active ? 'bg-white/20' : 'bg-background/60'} ${fullscreen ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-xs'}`}>
        {count}
      </span>
    </button>
  );
}

function OrderCard({ 
  order, 
  onStatusChange, 
  onItemStatusChange,
  nextStatus,
  orderAge,
  formatTimer,
  getAgeColor,
  kdsEnabled,
  fullscreen = false
}: { 
  order: Order; 
  onStatusChange: (order: Order, status: OrderStatus) => void;
  onItemStatusChange: (orderId: string, itemId: string, status: OrderItemStatus, completedQty?: number) => void;
  nextStatus: OrderStatus | null;
  orderAge: number;
  formatTimer: (seconds: number) => string;
  getAgeColor: (age: number) => string;
  kdsEnabled: boolean;
  fullscreen?: boolean;
}) {
  const isPending = order.status === 'pending';
  const isRush = order.priority === 'rush';
  const isReady = order.status === 'ready';

  // Calculate item completion
  const completedItems = order.items.filter(item => item.status === 'ready' || (item.completedQty || 0) >= item.qty).length;
  const totalItems = order.items.length;
  const allItemsReady = completedItems === totalItems;

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden card-shadow-lg transition-all duration-200 hover:card-shadow-xl ${
      isPending ? 'border-warning/50 ring-2 ring-warning/20' : 
      isRush ? 'border-destructive/50 ring-2 ring-destructive/20' :
      isReady ? 'border-success/50 ring-2 ring-success/20' :
      'border-border'
    }`}>
      {/* Header */}
      <div className={`${fullscreen ? 'p-6' : 'p-4 sm:p-5'} border-b border-border ${
        isPending ? 'bg-warning/10' : isRush ? 'bg-destructive/10' : isReady ? 'bg-success/10' : ''
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl flex items-center justify-center ${
              isPending ? 'bg-warning/20' : isReady ? 'bg-success/20' : 'bg-muted'
            } ${fullscreen ? 'w-14 h-14' : 'w-10 h-10'}`}>
              {isPending ? (
                <Clock className={`text-warning ${fullscreen ? 'w-7 h-7' : 'w-5 h-5'}`} />
              ) : isReady ? (
                <CheckCircle className={`text-success ${fullscreen ? 'w-7 h-7' : 'w-5 h-5'}`} />
              ) : (
                <ChefHat className={`text-primary ${fullscreen ? 'w-7 h-7' : 'w-5 h-5'}`} />
              )}
            </div>
            <div>
              <span className={`font-serif font-bold ${fullscreen ? 'text-3xl' : 'text-xl'}`}>Table {order.tableNumber}</span>
              {isRush && (
                <span className={`ml-2 px-2 py-0.5 bg-destructive text-destructive-foreground rounded-full animate-pulse ${fullscreen ? 'text-sm' : 'text-xs'}`}>
                  RUSH
                </span>
              )}
            </div>
          </div>
          
          {/* Timer */}
          <div className={`flex items-center gap-1.5 rounded-lg font-bold ${getAgeColor(orderAge)} ${fullscreen ? 'px-4 py-2 text-lg' : 'px-2.5 py-1 text-xs'}`}>
            <Timer className={fullscreen ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
            {formatTimer(orderAge)}
          </div>
        </div>
        
        {/* Hide customer info in fullscreen for cleaner display */}
        {!fullscreen && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{order.isWaiterOrder ? `Waiter Order` : order.customerPhone}</span>
            <StatusBadge status={order.status} />
          </div>
        )}

        {/* Progress bar */}
        {!isPending && !isReady && totalItems > 1 && (
          <div className={fullscreen ? 'mt-4' : 'mt-3'}>
            <div className={`flex justify-between text-muted-foreground mb-1 ${fullscreen ? 'text-base' : 'text-xs'}`}>
              <span>Progress</span>
              <span>{completedItems}/{totalItems} items</span>
            </div>
            <div className={`bg-muted rounded-full overflow-hidden ${fullscreen ? 'h-3' : 'h-2'}`}>
              <div 
                className="h-full bg-success transition-all duration-300"
                style={{ width: `${(completedItems / totalItems) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Items with per-item controls */}
      <div className={`space-y-2 ${fullscreen ? 'p-6' : 'p-4 sm:p-5'}`}>
        {order.items.map((item) => {
          const itemReady = item.status === 'ready' || (item.completedQty || 0) >= item.qty;
          return (
            <div 
              key={item.id} 
              className={`flex justify-between items-center rounded-lg transition-all ${
                itemReady ? 'bg-success/10 line-through opacity-60' : 'bg-muted/50'
              } ${fullscreen ? 'p-4' : 'p-2'}`}
            >
              <span className={`font-medium flex items-center gap-2 ${fullscreen ? 'text-xl' : ''}`}>
                <span className={`text-primary font-bold ${fullscreen ? 'text-2xl' : 'text-lg'}`}>{item.qty}×</span>
                {item.name}
              </span>
              {itemReady ? (
                <span className={`flex items-center justify-center text-success ${fullscreen ? 'h-12 w-12' : 'h-8 w-8'}`}>
                  <Check className={fullscreen ? 'w-7 h-7' : 'w-5 h-5'} />
                </span>
              ) : (
                <Button
                  size={fullscreen ? "lg" : "sm"}
                  className={`bg-success hover:bg-success/90 text-success-foreground ${fullscreen ? 'h-12 text-lg px-6' : 'h-8'}`}
                  onClick={() => {
                    onItemStatusChange(order.id, item.id, 'ready', item.qty);
                    toast.success(`${item.name} marked ready`);
                  }}
                >
                  Done
                </Button>
              )}
            </div>
          );
        })}
        
        {order.notes && (
          <div className={`bg-warning/10 rounded-xl border border-warning/20 ${fullscreen ? 'p-4 mt-4' : 'p-3 mt-3'}`}>
            <p className={`font-medium text-warning flex items-center gap-1 ${fullscreen ? 'text-base' : 'text-xs'}`}>
              <AlertTriangle className={fullscreen ? 'w-5 h-5' : 'w-3.5 h-3.5'} /> Notes
            </p>
            <p className={`text-foreground mt-1 ${fullscreen ? 'text-lg' : 'text-sm'}`}>{order.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`pt-0 flex gap-2 ${fullscreen ? 'p-6' : 'p-4 sm:p-5'}`}>
        {isPending && kdsEnabled && (
          <>
            <Button 
              size={fullscreen ? "lg" : "sm"}
              className={`flex-1 bg-success hover:bg-success/90 text-success-foreground rounded-xl ${fullscreen ? 'h-14 text-lg' : 'h-11'}`}
              onClick={() => onStatusChange(order, 'accepted')}
            >
              <Check className={fullscreen ? 'w-6 h-6 mr-2' : 'w-4 h-4 mr-2'} /> Accept
            </Button>
            <Button 
              size={fullscreen ? "lg" : "sm"}
              variant="destructive"
              className={`rounded-xl ${fullscreen ? 'h-14 px-6' : 'h-11'}`}
              onClick={() => onStatusChange(order, 'cancelled')}
            >
              <X className={fullscreen ? 'w-6 h-6' : 'w-4 h-4'} />
            </Button>
          </>
        )}
        
        {!isPending && !isReady && (
          <Button 
            size={fullscreen ? "lg" : "sm"}
            className={`w-full rounded-xl ${fullscreen ? 'h-14 text-lg' : 'h-11'} ${
              allItemsReady 
                ? 'bg-success hover:bg-success/90 text-success-foreground' 
                : 'gradient-primary text-primary-foreground'
            }`}
            onClick={() => onStatusChange(order, 'ready')}
          >
            <CheckCircle className={fullscreen ? 'w-6 h-6 mr-2' : 'w-4 h-4 mr-2'} />
            {allItemsReady ? 'Order Ready!' : 'Mark All Ready'}
          </Button>
        )}

        {isReady && (
          <div className={`w-full text-center bg-success/15 rounded-xl text-success font-bold flex items-center justify-center gap-2 ${fullscreen ? 'py-4 text-xl' : 'py-3'}`}>
            <CheckCircle className={fullscreen ? 'w-7 h-7' : 'w-5 h-5'} />
            Ready for Pickup!
          </div>
        )}
      </div>

      {/* Hide ID footer in fullscreen */}
      {!fullscreen && (
        <div className="px-4 sm:px-5 pb-4 text-xs text-muted-foreground/50 flex justify-between">
          <span>ID: #{order.id.slice(-6)}</span>
          <span>{formatNepalTime(order.createdAt)}</span>
        </div>
      )}
    </div>
  );
}

// Items View - All items grouped together
function ItemsView({ 
  orders, 
  onItemStatusChange 
}: { 
  orders: Order[];
  onItemStatusChange: (orderId: string, itemId: string, status: OrderItemStatus, completedQty?: number) => void;
}) {
  // Group all items by name
  const groupedItems = useMemo(() => {
    const groups: Record<string, Array<{ order: Order; item: OrderItem }>> = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ order, item });
      });
    });
    
    return groups;
  }, [orders]);

  const itemNames = Object.keys(groupedItems).sort();

  if (itemNames.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {itemNames.map(itemName => {
        const items = groupedItems[itemName];
        const totalQty = items.reduce((sum, { item }) => sum + item.qty, 0);
        const completedQty = items.reduce((sum, { item }) => 
          sum + (item.status === 'ready' ? item.qty : (item.completedQty || 0)), 0);
        
        return (
          <div key={itemName} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/15 text-primary rounded-xl flex items-center justify-center font-bold text-xl">
                  {totalQty}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{itemName}</h3>
                  <p className="text-sm text-muted-foreground">{items.length} orders</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-sm font-medium ${completedQty >= totalQty ? 'text-success' : 'text-muted-foreground'}`}>
                  {completedQty}/{totalQty} done
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {items.map(({ order, item }) => {
                const isReady = item.status === 'ready' || (item.completedQty || 0) >= item.qty;
                return (
                  <button
                    key={`${order.id}-${item.id}`}
                    onClick={() => {
                      if (!isReady) {
                        onItemStatusChange(order.id, item.id, 'ready', item.qty);
                        toast.success(`${item.name} (T${order.tableNumber}) done`);
                      }
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isReady 
                        ? 'bg-success/15 border-success/30 opacity-60' 
                        : 'bg-muted/50 border-border hover:border-primary hover:bg-primary/5'
                    }`}
                    disabled={isReady}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">T{order.tableNumber}</span>
                      <span className="text-primary font-bold">{item.qty}×</span>
                    </div>
                    {isReady && <Check className="w-4 h-4 text-success mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Category Lane Component
function CategoryLane({ 
  categoryName, 
  items,
  onItemStatusChange,
  formatTimer,
  getOrderAge,
  getAgeColor
}: { 
  categoryName: string;
  items: Array<{ order: Order; item: OrderItem }>;
  onItemStatusChange: (orderId: string, itemId: string, status: OrderItemStatus, completedQty?: number) => void;
  formatTimer: (seconds: number) => string;
  getOrderAge: (createdAt: string) => number;
  getAgeColor: (age: number) => string;
}) {
  const pendingItems = items.filter(({ item }) => 
    item.status !== 'ready' && (item.completedQty || 0) < item.qty
  );
  const completedItems = items.filter(({ item }) => 
    item.status === 'ready' || (item.completedQty || 0) >= item.qty
  );

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/15 text-primary rounded-xl flex items-center justify-center">
            <ChefHat className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-lg">{categoryName}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-warning/15 text-warning rounded-lg text-sm font-medium">
            {pendingItems.length} pending
          </span>
          <span className="px-2 py-1 bg-success/15 text-success rounded-lg text-sm font-medium">
            {completedItems.length} done
          </span>
        </div>
      </div>
      
      <div className="p-4">
        {pendingItems.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">All items completed!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pendingItems.map(({ order, item }) => {
              const age = getOrderAge(order.createdAt);
              return (
                <button
                  key={`${order.id}-${item.id}`}
                  onClick={() => {
                    onItemStatusChange(order.id, item.id, 'ready', item.qty);
                    toast.success(`${item.name} (T${order.tableNumber}) done`);
                  }}
                  className="p-4 rounded-xl border border-border bg-background hover:border-success hover:bg-success/5 transition-all text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg">T{order.tableNumber}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getAgeColor(age)}`}>
                      {formatTimer(age)}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-primary font-bold text-lg">{item.qty}×</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
