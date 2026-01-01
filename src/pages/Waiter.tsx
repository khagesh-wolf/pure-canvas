import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useDynamicManifest } from '@/hooks/useDynamicManifest';
import { OrderItem, Order, MenuItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { 
  LogOut, ChefHat, ShoppingCart, Plus, Minus, Search, 
  CheckCircle, Clock, Utensils, Bell, Table2, Send, 
  ArrowLeft, Trash2, AlertCircle, Sun, Moon, RefreshCw, X, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { formatNepalTime, formatNepalDateTime } from '@/lib/nepalTime';
import { useTheme } from '@/hooks/useTheme';
import { printKOTFromOrder, showKOTNotification } from '@/lib/kotPrinter';

export default function Waiter() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  
  // Dynamic manifest for PWA
  useDynamicManifest();
  
  const {
    menuItems, categories, orders, settings, staff,
    isAuthenticated, currentUser, logout, loginWithPin,
    addWaiterOrder, getOrdersByWaiter, updateOrderStatus,
    getInventoryByMenuItemId, inventoryItems
  } = useStore();

  // PIN Login state
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Order flow state
  const [step, setStep] = useState<'login' | 'tables' | 'menu' | 'cart' | 'orders'>('login');
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [cartPanelOpen, setCartPanelOpen] = useState(false);

  // Sound notification refs for ready orders
  const audioContextRef = useRef<AudioContext | null>(null);
  const previousReadyOrderIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  // Check auth state
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (currentUser.role === 'waiter') {
        setStep('tables');
      } else {
        // Redirect non-waiters to appropriate page
        if (currentUser.role === 'kitchen') {
          navigate('/kitchen');
        } else if (currentUser.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/counter');
        }
      }
    } else {
      setStep('login');
    }
  }, [isAuthenticated, currentUser, navigate]);

  // Get orders for waiter to serve - all accepted/preparing/ready orders (not just waiter's own)
  // Sorted by: ready first (when KDS enabled), then oldest first
  const waiterOrders = useMemo(() => {
    if (!currentUser) return [];
    const activeOrders = orders.filter(o => 
      ['accepted', 'preparing', 'ready'].includes(o.status)
    );
    
    // Sort: if KDS enabled, ready orders first; then by oldest first
    return activeOrders.sort((a, b) => {
      if (settings.kdsEnabled) {
        // Ready orders first
        if (a.status === 'ready' && b.status !== 'ready') return -1;
        if (b.status === 'ready' && a.status !== 'ready') return 1;
      }
      // Then oldest first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [currentUser, orders, settings.kdsEnabled]);

  // Count ready orders for notification
  const readyOrdersCount = waiterOrders.filter(o => o.status === 'ready').length;
  const readyOrderIds = useMemo(() => new Set(waiterOrders.filter(o => o.status === 'ready').map(o => o.id)), [waiterOrders]);

  // Play sound when order becomes ready
  const playReadySound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      // Pleasant ding sound - ascending tones
      const frequencies = [523, 659, 784]; // C5, E5, G5
      frequencies.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        }, i * 150);
      });
    } catch (error) {
      console.log('Sound notification failed:', error);
    }
  };

  // Monitor for newly ready orders and notify
  useEffect(() => {
    if (!currentUser || !isAuthenticated) return;
    
    if (!isInitializedRef.current) {
      previousReadyOrderIdsRef.current = readyOrderIds;
      isInitializedRef.current = true;
      return;
    }
    
    let hasNewReady = false;
    readyOrderIds.forEach(id => {
      if (!previousReadyOrderIdsRef.current.has(id)) {
        hasNewReady = true;
      }
    });
    
    if (hasNewReady) {
      playReadySound();
      toast.success('🔔 Order is ready for pickup!', { duration: 5000 });
    }
    
    previousReadyOrderIdsRef.current = readyOrderIds;
  }, [readyOrderIds, currentUser, isAuthenticated]);

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

  // Filter menu items
  const filteredMenu = useMemo(() => {
    return menuItems.filter(item => {
      if (!item.available) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [menuItems, categoryFilter, searchQuery]);

  // Sorted categories
  const sortedCategories = useMemo(() => 
    [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const handlePinLogin = () => {
    if (pin.length < 4) {
      setPinError('PIN must be at least 4 digits');
      return;
    }
    const success = loginWithPin(pin);
    if (success) {
      const user = useStore.getState().currentUser;
      if (user?.role !== 'waiter') {
        logout();
        setPinError('This PIN is not for a waiter account');
        return;
      }
      toast.success(`Welcome, ${user.name}!`);
      setStep('tables');
      setPin('');
      setPinError('');
    } else {
      setPinError('Invalid PIN');
    }
  };

  // Helper to get available stock for an item
  const getAvailableStock = (menuItemId: string, portionSize?: number): number | null => {
    const invItem = getInventoryByMenuItemId(menuItemId);
    if (!invItem) return null; // Not tracked in inventory - unlimited
    
    const currentStock = invItem.currentStock;
    
    // Calculate how many units are already in cart for this item
    const cartQtyInUnits = cart
      .filter(c => c.menuItemId === menuItemId)
      .reduce((sum, c) => sum + (c.portionSize || 1) * c.qty, 0);
    
    const availableUnits = currentStock - cartQtyInUnits;
    
    if (portionSize && portionSize > 0) {
      return Math.floor(availableUnits / portionSize);
    }
    
    return Math.floor(availableUnits);
  };

  const handleAddToCart = (item: MenuItem) => {
    // Check stock availability before adding to cart
    const availableStock = getAvailableStock(item.id);
    if (availableStock !== null && availableStock <= 0) {
      toast.error(`${item.name} is out of stock`);
      return;
    }
    
    const existing = cart.find(c => c.menuItemId === item.id);
    if (existing) {
      // Check if we can add one more
      if (availableStock !== null && availableStock < 1) {
        const invItem = getInventoryByMenuItemId(item.id);
        toast.error(`Only ${invItem?.currentStock || 0} ${item.name} available in stock`);
        return;
      }
      setCart(cart.map(c => 
        c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setCart([...cart, {
        id: Math.random().toString(36).substring(2, 11),
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        qty: 1
      }]);
    }
    toast.success(`Added ${item.name}`);
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(cart.filter(c => c.id !== itemId));
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    // If increasing, check stock limits
    if (delta > 0) {
      const cartItem = cart.find(c => c.id === itemId);
      if (cartItem) {
        const availableStock = getAvailableStock(cartItem.menuItemId, cartItem.portionSize);
        if (availableStock !== null && availableStock < delta) {
          const invItem = getInventoryByMenuItemId(cartItem.menuItemId);
          toast.error(`Only ${invItem?.currentStock || 0} ${cartItem.name} available in stock`);
          return;
        }
      }
    }
    
    setCart(cart.map(c => {
      if (c.id === itemId) {
        const newQty = c.qty + delta;
        return newQty > 0 ? { ...c, qty: newQty } : c;
      }
      return c;
    }).filter(c => c.qty > 0));
  };

  const handleConfirmOrder = async () => {
    if (!selectedTable || cart.length === 0) return;
    
    const newOrder = addWaiterOrder(selectedTable, cart, orderNotes);
    
    // Show appropriate message based on order flow
    // If KDS is ON AND Kitchen KOT printing is ON: order goes directly to kitchen
    // Otherwise: order goes to counter for acceptance
    const goesToKitchen = settings.kdsEnabled && settings.kotPrintingEnabled;
    
    if (goesToKitchen) {
      toast.success(`Order sent to kitchen for Table ${selectedTable}!`);
      
      // Auto-print KOT if enabled
      if (settings.kotPrintingEnabled) {
        try {
          const printed = await printKOTFromOrder(newOrder, settings.restaurantName, currentUser?.name);
          if (printed) {
            toast.success('KOT printed!');
          } else {
            showKOTNotification(newOrder);
          }
        } catch (error) {
          console.log('KOT print failed:', error);
          showKOTNotification(newOrder);
        }
      }
    } else {
      toast.success(`Order sent to counter for Table ${selectedTable}!`);
    }
    
    // Reset state
    setCart([]);
    setOrderNotes('');
    setConfirmDialog(false);
    setStep('tables');
    setSelectedTable(null);
  };

  const handleLogout = () => {
    logout();
    setStep('login');
    setPin('');
    setCart([]);
    setSelectedTable(null);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // PIN Login Screen
  if (step === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        </div>

        <div className="relative bg-card p-10 rounded-3xl shadow-xl w-full max-w-md border border-border">
          <div className="w-16 h-16 gradient-primary rounded-2xl mx-auto flex items-center justify-center mb-8 shadow-warm">
            <Utensils className="w-8 h-8 text-primary-foreground" />
          </div>
          
          <h1 className="font-serif text-3xl font-bold text-center mb-2">Waiter Login</h1>
          <p className="text-muted-foreground text-center mb-8">
            Enter your PIN to start taking orders
          </p>

          <div className="space-y-5">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter 4-6 digit PIN"
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setPin(value);
                  setPinError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePinLogin()}
                className="h-14 text-center text-2xl tracking-widest bg-muted/50 border-border rounded-xl"
                maxLength={6}
              />
              {pinError && (
                <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {pinError}
                </p>
              )}
            </div>

            <Button
              onClick={handlePinLogin}
              className="w-full h-14 gradient-primary text-primary-foreground font-bold rounded-xl shadow-warm"
              disabled={pin.length < 4}
            >
              Sign In
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigate('/auth')}
              className="w-full text-muted-foreground"
            >
              Use Username & Password instead
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Main Waiter Interface
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="page-header px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'menu' && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9"
                onClick={() => {
                  if (cart.length > 0) {
                    if (confirm('Going back will clear your cart. Continue?')) {
                      setCart([]);
                      setStep('tables');
                      setSelectedTable(null);
                    }
                  } else {
                    setStep('tables');
                    setSelectedTable(null);
                  }
                }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            {step === 'cart' && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setStep('menu')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            {step === 'orders' && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setStep('tables')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-warm">
              <Utensils className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold text-foreground">{currentUser?.name}</h1>
              <p className="text-xs text-muted-foreground">
                {step === 'tables' && 'Select a table'}
                {step === 'menu' && `Table ${selectedTable}`}
                {step === 'cart' && `Table ${selectedTable} - Review Order`}
                {step === 'orders' && 'My Orders'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Ready orders notification */}
            {readyOrdersCount > 0 && step !== 'orders' && (
              <Button
                variant="outline"
                size="sm"
                className="bg-success/15 border-success/30 text-success animate-pulse"
                onClick={() => setStep('orders')}
              >
                <Bell className="w-4 h-4 mr-1" />
                {readyOrdersCount} Ready
              </Button>
            )}

            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Button 
              variant="outline" 
              size="icon"
              className="h-9 w-9"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Table Selection */}
      {step === 'tables' && (
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Select Table</h2>
            <Button
              variant="outline"
              onClick={() => setStep('orders')}
              className="relative"
            >
              <Clock className="w-4 h-4 mr-2" />
              My Orders
              {waiterOrders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {waiterOrders.length}
                </span>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: settings.tableCount }, (_, i) => i + 1).map(tableNum => {
              const hasActiveOrder = orders.some(o => 
                o.tableNumber === tableNum && 
                ['pending', 'accepted', 'preparing', 'ready'].includes(o.status)
              );
              
              return (
                <button
                  key={tableNum}
                  onClick={() => {
                    setSelectedTable(tableNum);
                    setStep('menu');
                  }}
                  className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 ${
                    hasActiveOrder 
                      ? 'bg-warning/15 border-warning/50 text-warning' 
                      : 'bg-card border-border hover:border-primary'
                  }`}
                >
                  <Table2 className="w-6 h-6" />
                  <span className="font-bold text-lg">{tableNum}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu Selection */}
      {step === 'menu' && (
        <div className="flex-1 flex flex-col">
          {/* Search & Categories */}
          <div className="p-4 space-y-3 bg-card border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <Button
                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCategoryFilter('all')}
                className="shrink-0"
              >
                All
              </Button>
              {sortedCategories.map(cat => (
                <Button
                  key={cat.id}
                  variant={categoryFilter === cat.name ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat.name)}
                  className="shrink-0"
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredMenu.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className={`bg-card border rounded-xl p-3 text-left transition-all hover:shadow-lg hover:border-primary relative ${
                      inCart ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                    }`}
                  >
                    {inCart && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                        {inCart.qty}
                      </div>
                    )}
                    <h3 className="font-medium text-sm mb-1 line-clamp-2">{item.name}</h3>
                    <p className="text-primary font-bold">रू{item.price}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.category}</p>
                  </button>
                );
              })}
            </div>

            {filteredMenu.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No items found</p>
              </div>
            )}
          </div>

          {/* Cart Summary Footer */}
          {cart.length > 0 && (
            <div className="p-4 bg-card border-t border-border">
              <Button 
                className="w-full h-14 gradient-primary text-primary-foreground font-bold rounded-xl"
                onClick={() => setCartPanelOpen(true)}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                View Cart ({cartItemCount} items) - रू{cartTotal}
              </Button>
            </div>
          )}

          {/* Slide-up Cart Panel */}
          {cartPanelOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black/40 z-[100] animate-fade-in"
                onClick={() => setCartPanelOpen(false)}
              />
              
              {/* Panel */}
              <div className="fixed bottom-0 left-0 right-0 z-[101] bg-card rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
                {/* Handle */}
                <div className="flex justify-center py-3">
                  <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
                </div>
                
                {/* Header */}
                <div className="px-5 pb-4 flex items-center justify-between border-b border-border">
                  <div>
                    <h3 className="text-xl font-bold">Your Cart</h3>
                    <p className="text-sm text-muted-foreground">{cartItemCount} items • Table {selectedTable}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setCartPanelOpen(false)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-4 bg-muted/30 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">रू{item.price} × {item.qty}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQty(item.id, -1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-6 text-center font-bold">{item.qty}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQty(item.id, 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="text-right min-w-[60px]">
                        <p className="font-bold">रू{item.price * item.qty}</p>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveFromCart(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                {/* Order Notes */}
                <div className="px-5 pb-3">
                  <Textarea
                    placeholder="Add special instructions..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="resize-none"
                    rows={2}
                  />
                </div>
                
                {/* Footer */}
                <div className="p-5 pt-0 space-y-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>रू{cartTotal}</span>
                  </div>
                  <Button 
                    className="w-full h-14 gradient-primary text-primary-foreground font-bold rounded-xl text-lg"
                    onClick={() => {
                      setCartPanelOpen(false);
                      setConfirmDialog(true);
                    }}
                  >
                    <Send className="w-5 h-5 mr-2" />
                    Send to Kitchen
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cart Review */}
      {step === 'cart' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(item => (
              <div key={item.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">रू{item.price} each</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleUpdateQty(item.id, -1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-bold">{item.qty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleUpdateQty(item.id, 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-right">
                  <p className="font-bold">रू{item.price * item.qty}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive h-6 px-2"
                    onClick={() => handleRemoveFromCart(item.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Order Notes */}
            <div className="bg-card border border-border rounded-xl p-4">
              <label className="text-sm font-medium mb-2 block">Order Notes (optional)</label>
              <Textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Special instructions..."
                className="bg-muted/50"
              />
            </div>
          </div>

          {/* Total & Send */}
          <div className="p-4 bg-card border-t border-border space-y-3">
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">रू{cartTotal}</span>
            </div>
            <Button 
              className="w-full h-14 bg-success hover:bg-success/90 text-success-foreground font-bold rounded-xl"
              onClick={() => setConfirmDialog(true)}
            >
              <Send className="w-5 h-5 mr-2" />
              Send to Kitchen
            </Button>
          </div>
        </div>
      )}

      {/* My Orders */}
      {step === 'orders' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 text-sm text-muted-foreground">
            {settings.kdsEnabled ? 'Ready orders shown first' : 'Oldest orders first'}
          </div>
          {waiterOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No active orders</p>
            </div>
          ) : (
            <div className="space-y-4">
              {waiterOrders.map(order => {
                const isWaiterOwned = order.createdBy === currentUser?.id;
                return (
                  <div 
                    key={order.id} 
                    className={`bg-card border rounded-xl overflow-hidden ${
                      order.status === 'ready' ? 'border-success ring-2 ring-success/20' : 'border-border'
                    }`}
                  >
                    <div className={`p-4 flex items-center justify-between ${
                      order.status === 'ready' ? 'bg-success/15' : ''
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          order.status === 'ready' ? 'bg-success/20' : 'bg-muted'
                        }`}>
                          {order.status === 'ready' ? (
                            <CheckCircle className="w-5 h-5 text-success" />
                          ) : (
                            <ChefHat className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">Table {order.tableNumber}</span>
                            {isWaiterOwned && (
                              <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full">My Order</span>
                            )}
                            {order.isWaiterOrder && !isWaiterOwned && (
                              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Waiter</span>
                            )}
                            {!order.isWaiterOrder && (
                              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Customer</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatNepalTime(order.createdAt)}</p>
                        </div>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    
                    <div className="p-4 pt-0 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            <span className="font-bold text-primary">{item.qty}×</span> {item.name}
                          </span>
                          {item.status === 'ready' && (
                            <span className="text-success text-xs">Ready</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {order.status === 'ready' && (
                      <div className="p-4 pt-0 space-y-2">
                        <div className="bg-success/15 text-success rounded-lg p-3 text-center font-medium animate-pulse">
                          <Bell className="w-4 h-4 inline mr-2" />
                          Ready to Serve!
                        </div>
                        <Button 
                          className="w-full bg-success hover:bg-success/90 text-success-foreground font-bold"
                          onClick={() => {
                            updateOrderStatus(order.id, 'served');
                            toast.success(`Table ${order.tableNumber} order marked as served!`);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Mark as Served
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirm Order Dialog */}
      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Order</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1">Table</p>
              <p className="font-bold text-lg">Table {selectedTable}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Items ({cartItemCount})</p>
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.qty}× {item.name}</span>
                  <span>रू{item.price * item.qty}</span>
                </div>
              ))}
            </div>

            {orderNotes && (
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{orderNotes}</p>
              </div>
            )}

            <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">रू{cartTotal}</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleConfirmOrder}
            >
              <Send className="w-4 h-4 mr-2" />
              Send Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
