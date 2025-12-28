import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { OrderItem } from '@/types';
import { 
  generateSessionToken, 
  getClosedSessions, 
  addClosedSession 
} from '@/lib/sessionManager';
import { checkPaymentBlock, overridePaymentBlock, PaymentBlockCheck } from '@/lib/paymentBlockApi';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Minus, 
  X,
  Menu,
  RefreshCw,
  FileText,
  Check,
  Heart,
  Clock,
  LogOut,
  Bell,
  Instagram,
  Facebook,
  Star,
  UtensilsCrossed,
  Trash2,
  Flame,
  AlertCircle,
  ShieldAlert,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useHapticFeedback, playOrderSuccessSound } from '@/hooks/useHapticFeedback';
import { Confetti } from '@/components/Confetti';
import { toast } from 'sonner';
import { formatNepalTime } from '@/lib/nepalTime';
import { useFavorites } from '@/hooks/useFavorites';
import { useRateLimiter } from '@/hooks/useRateLimiter';
import { useRushHour } from '@/hooks/useRushHour';
import { LazyImage } from '@/components/ui/LazyImage';
import { MenuItemBadge, BadgeType } from '@/components/ui/MenuItemBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { isPWA } from './Install';
import { 
  phoneSchema, 
  specialInstructionsSchema, 
  validateInput,
  sanitizeText 
} from '@/lib/validation';

// Staff PIN approval component for payment block override
function StaffApprovalInput({ onApprove }: { onApprove: () => void }) {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const { staff } = useStore();

  const handlePinSubmit = async () => {
    if (pin.length < 4) return;
    
    setIsVerifying(true);
    
    // Check if PIN matches any staff member's PIN or password
    // Staff with role 'counter' or 'admin' can approve
    const matchedStaff = staff.find(s => s.pin === pin || s.password === pin);
    
    if (matchedStaff) {
      await onApprove();
    } else {
      toast.error('Invalid PIN');
    }
    
    setPin('');
    setIsVerifying(false);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        placeholder="Enter Staff PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.slice(0, 6))}
        className="w-full p-4 border-2 border-border rounded-xl text-center text-xl tracking-[0.3em] font-mono outline-none focus:border-primary transition-colors"
        autoComplete="off"
      />
      <button
        onClick={handlePinSubmit}
        disabled={pin.length < 4 || isVerifying}
        className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isVerifying ? 'Verifying...' : 'Confirm'}
      </button>
    </div>
  );
}

export default function TableOrder() {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const { menuItems, categories, settings, addOrder, getCustomerPoints, updateOrderStatus, callWaiter, waiterCalls, bills } = useStore();
  
  const [phone, setPhone] = useState('');
  const [isPhoneEntered, setIsPhoneEntered] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const table = parseInt(tableNumber || '0');
  
  // Favorites hook
  const { favorites, toggleFavorite, isFavorite } = useFavorites(phone);

  // Rush hour detection
  const rushHourInfo = useRushHour();

  // Theme hook
  const { theme, setTheme } = useTheme();

  // Get customer's orders for this table - subscribe to orders from store directly for real-time updates
  const storeOrders = useStore(state => state.orders);

  // Rate limiter for order placement (max 5 orders per 10 minutes)
  const { checkRateLimit } = useRateLimiter({
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
    message: 'Too many orders. Please wait a few minutes.',
  });

  // Haptic feedback hook
  const { hapticAddToCart, hapticQuantityChange, hapticDeleteItem, hapticOrderPlaced, hapticFavorite } = useHapticFeedback();

  // Get the table number that was originally scanned (stored in session)
  const [lockedTable, setLockedTable] = useState<number | null>(null);

  // Calculate popular items (items that appear most in recent orders)
  const popularItems = useMemo(() => {
    const recentOrders = storeOrders.slice(-50);
    const itemCounts: Record<string, number> = {};
    
    recentOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.menuItemId) {
          itemCounts[item.menuItemId] = (itemCounts[item.menuItemId] || 0) + item.qty;
        }
      });
    });
    
    // Get top 5 popular items
    return Object.entries(itemCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);
  }, [storeOrders]);

  // Get badge for menu item
  const getItemBadge = (itemId: string): BadgeType | undefined => {
    if (popularItems.includes(itemId)) return 'popular';
    return undefined;
  };

  // State for install prompt
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [hasShownInstallPrompt, setHasShownInstallPrompt] = useState(false);
  
  // State for stale session warning
  const [showStaleSessionWarning, setShowStaleSessionWarning] = useState(false);
  
  // State for payment block (3-hour cooldown after payment)
  const [paymentBlock, setPaymentBlock] = useState<PaymentBlockCheck | null>(null);
  const [isCheckingPaymentBlock, setIsCheckingPaymentBlock] = useState(false);
  const [showStaffConfirmation, setShowStaffConfirmation] = useState(false);

  // Capture install prompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Auto-logout table after 4 hours - keep phone number
  useEffect(() => {
    
    const checkSessionExpiry = () => {
      const sessionKey = 'sajilo:customerActiveSession';
      const phoneKey = 'sajilo:customerPhone';
      const existingSession = localStorage.getItem(sessionKey);
      
      if (existingSession) {
        try {
          const session = JSON.parse(existingSession);
          const tableTimestamp = session.tableTimestamp || session.timestamp;
          const tableAge = Date.now() - tableTimestamp;
          const isTableExpired = tableAge > 4 * 60 * 60 * 1000; // 4 hours
          
          if (isTableExpired) {
            // Save phone before clearing session
            if (session.phone) {
              localStorage.setItem(phoneKey, session.phone);
            }
            // Clear only table session
            localStorage.removeItem(sessionKey);
            toast.info('Table session expired. Please scan your table QR again.');
            navigate('/', { replace: true });
          }
        } catch {
          localStorage.removeItem(sessionKey);
          navigate('/', { replace: true });
        }
      }
    };
    
    // Check immediately
    checkSessionExpiry();
    
    // Check every minute
    const interval = setInterval(checkSessionExpiry, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [navigate]);

  // Validate table number and handle session
  useEffect(() => {
    if (!table || table < 1 || table > settings.tableCount) {
      toast.error('Invalid table number');
      navigate('/');
      return;
    }

    const sessionKey = 'sajilo:customerActiveSession';
    const phoneKey = 'sajilo:customerPhone';
    const existingSession = localStorage.getItem(sessionKey);
    const savedPhone = localStorage.getItem(phoneKey);
    const closedSessions = getClosedSessions();
    
    if (existingSession) {
      try {
        const session = JSON.parse(existingSession) as { 
          table: number; 
          phone?: string; 
          tableTimestamp?: number;
          isPhoneEntered?: boolean;
          timestamp: number;
          sessionToken?: string;
        };
        
        // Check if this session was closed (bill paid)
        if (session.sessionToken && closedSessions.includes(session.sessionToken)) {
          // Session was closed after payment, clear it
          localStorage.removeItem(sessionKey);
          toast.info('Your previous session has ended. Please scan the QR code at your table to start a new order.');
          navigate('/', { replace: true });
          return;
        }
        
        // Check if table session is still valid (4 hours)
        const tableTimestamp = session.tableTimestamp || session.timestamp;
        const tableAge = Date.now() - tableTimestamp;
        const isTableExpired = tableAge > 4 * 60 * 60 * 1000; // 4 hours
        
        // If table is different and session not expired, update to new table
        // This allows switching tables via QR scan
        if (session.table !== table) {
          // Update session with new table and new token
          const updatedSession = {
            table,
            phone: session.phone || savedPhone || '',
            isPhoneEntered: Boolean(session.isPhoneEntered),
            tableTimestamp: Date.now(),
            timestamp: Date.now(),
            sessionToken: generateSessionToken()
          };
          localStorage.setItem(sessionKey, JSON.stringify(updatedSession));
          
          if (session.phone || savedPhone) {
            setPhone(session.phone || savedPhone || '');
            setIsPhoneEntered(Boolean(session.isPhoneEntered));
          }
          
          // Clear cart when switching tables
          setCart([]);
        } else if (isTableExpired) {
          // Table expired - keep phone but refresh table timestamp and token
          if (session.phone || savedPhone) {
            localStorage.setItem(phoneKey, session.phone || savedPhone || '');
          }
          localStorage.setItem(sessionKey, JSON.stringify({
            table,
            phone: session.phone || savedPhone || '',
            isPhoneEntered: Boolean(session.phone || savedPhone),
            tableTimestamp: Date.now(),
            timestamp: Date.now(),
            sessionToken: generateSessionToken()
          }));
          if (session.phone || savedPhone) {
            setPhone(session.phone || savedPhone || '');
            setIsPhoneEntered(true);
          }
        } else {
          // Session still valid, same table
          // Ensure session has a token (for older sessions without one)
          if (!session.sessionToken) {
            const updatedSession = { ...session, sessionToken: generateSessionToken() };
            localStorage.setItem(sessionKey, JSON.stringify(updatedSession));
          }
          if (session.phone && session.phone.length >= 10) {
            setPhone(session.phone);
            setIsPhoneEntered(Boolean(session.isPhoneEntered));
          }
        }
      } catch {
        localStorage.removeItem(sessionKey);
      }
    } else if (savedPhone && savedPhone.length >= 10) {
      // No session but have saved phone - create new session with token
      localStorage.setItem(sessionKey, JSON.stringify({
        table,
        phone: savedPhone,
        isPhoneEntered: true,
        tableTimestamp: Date.now(),
        timestamp: Date.now(),
        sessionToken: generateSessionToken()
      }));
      setPhone(savedPhone);
      setIsPhoneEntered(true);
    }
    
    setLockedTable(table);
  }, [table, settings.tableCount, navigate]);

  // Check for stale session (customer returning from browser history after bill was paid)
  useEffect(() => {
    if (!isPhoneEntered || !phone || !table) return;
    
    const sessionKey = 'sajilo:customerActiveSession';
    const existingSession = localStorage.getItem(sessionKey);
    
    if (existingSession) {
      try {
        const session = JSON.parse(existingSession);
        
        // Check if session is more than 30 minutes old
        const sessionAge = Date.now() - (session.tableTimestamp || session.timestamp);
        const isSessionOld = sessionAge > 30 * 60 * 1000; // 30 minutes
        
        // Check if customer has any active (unpaid) orders at this table
        const hasActiveOrders = storeOrders.some(
          o => o.tableNumber === table && 
               o.customerPhone === phone && 
               ['pending', 'accepted', 'preparing', 'ready'].includes(o.status) &&
               !bills.some(b => b.status === 'paid' && b.orders.some(bo => bo.id === o.id))
        );
        
        // Check if customer has paid bills for this table today (indicates they left and came back)
        const today = new Date().toISOString().slice(0, 10);
        const hasPaidBillsToday = bills.some(
          b => b.status === 'paid' && 
               b.tableNumber === table && 
               b.customerPhones.includes(phone) &&
               b.paidAt?.startsWith(today)
        );
        
        // If session is old, no active orders, and has paid bills - they're probably back from history
        if (isSessionOld && !hasActiveOrders && hasPaidBillsToday) {
          setShowStaleSessionWarning(true);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, [isPhoneEntered, phone, table, storeOrders, bills]);

  // Check for payment block when phone is entered
  useEffect(() => {
    if (!isPhoneEntered || !phone || !table) return;
    
    const checkBlock = async () => {
      setIsCheckingPaymentBlock(true);
      try {
        const block = await checkPaymentBlock(table, phone);
        if (block && block.is_blocked) {
          setPaymentBlock(block);
          setShowStaffConfirmation(true);
        } else {
          setPaymentBlock(null);
          setShowStaffConfirmation(false);
        }
      } catch (err) {
        console.error('[TableOrder] Error checking payment block:', err);
      } finally {
        setIsCheckingPaymentBlock(false);
      }
    };
    
    checkBlock();
  }, [isPhoneEntered, phone, table]);

  // Build category list: only show Favorites if there are favorites
  const categoryNames = favorites.length > 0 
    ? ['Favorites', ...categories.map(c => c.name)]
    : categories.map(c => c.name);
  
  // Set initial category to first real category (not Favorites)
  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0].name);
    }
  }, [categories, activeCategory]);
  
  // Get favorite items
  const favoriteItems = menuItems.filter(item => favorites.includes(item.id) && item.available);
  
  const filteredItems = activeCategory === 'Favorites' 
    ? favoriteItems
    : menuItems.filter(item => item.category === activeCategory);

  // Intersection Observer for auto-selecting categories on scroll
  useEffect(() => {
    if (activeCategory === 'Favorites') return; // Skip for favorites view
    
    const observerOptions = {
      root: null,
      rootMargin: '-150px 0px -50% 0px', // Account for sticky header
      threshold: 0
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      if (isScrolling) return; // Don't update during manual scroll
      
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const categoryId = entry.target.id.replace('cat-', '');
          if (categoryId && categoryId !== 'Favorites') {
            setActiveCategory(categoryId);
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all category sections
    categories.forEach(cat => {
      const element = document.getElementById(`cat-${cat.name}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [categories, activeCategory, isScrolling]);

  
  const myOrders = storeOrders.filter(
    o => o.tableNumber === table && o.customerPhone === phone && ['pending', 'accepted'].includes(o.status)
  );
  const totalDue = myOrders.reduce((sum, o) => 
    sum + o.items.reduce((s, i) => s + i.price * i.qty, 0), 0
  );

  // Get customer points
  const customerPoints = phone ? getCustomerPoints(phone) : 0;

  const addToCart = (item: typeof menuItems[0]) => {
    hapticAddToCart();
    setLastAddedItemId(item.id);
    setTimeout(() => setLastAddedItemId(null), 400);
    
    const existing = cart.find(c => c.menuItemId === item.id);
    if (existing) {
      setCart(cart.map(c =>
        c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setCart([...cart, {
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: item.id,
        name: item.name,
        qty: 1,
        price: item.price,
      }]);
    }
  };

  const updateQty = (menuItemId: string, delta: number) => {
    hapticQuantityChange();
    setCart(cart.map(c => {
      if (c.menuItemId === menuItemId) {
        const newQty = c.qty + delta;
        return newQty > 0 ? { ...c, qty: newQty } : c;
      }
      return c;
    }).filter(c => c.qty > 0 || cart.find(x => x.menuItemId === menuItemId)?.qty !== 1 || delta !== -1));
    
    // Remove items with qty 0
    setCart(prev => prev.filter(c => {
      const item = prev.find(x => x.menuItemId === menuItemId);
      if (item && item.qty + delta <= 0 && c.menuItemId === menuItemId) {
        return false;
      }
      return true;
    }));
  };

  const removeFromCart = (menuItemId: string) => {
    hapticDeleteItem();
    setCart(cart.filter(c => c.menuItemId !== menuItemId));
  };


  const getItemQty = (menuItemId: string) => {
    return cart.find(c => c.menuItemId === menuItemId)?.qty || 0;
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    const phoneValidation = validateInput(phoneSchema, phone);
    if (!phoneValidation.success) {
      toast.error(phoneValidation.error);
      return;
    }

    if (lockedTable) {
      // Store unified session with table lock
      const sessionKey = 'sajilo:customerActiveSession';
      const phoneKey = 'sajilo:customerPhone';
      
      // Save phone permanently (survives table expiry)
      localStorage.setItem(phoneKey, phone);
      
      // Check for existing session token or generate new one
      let sessionToken = generateSessionToken();
      const existingSession = localStorage.getItem(sessionKey);
      if (existingSession) {
        try {
          const session = JSON.parse(existingSession);
          if (session.sessionToken && !getClosedSessions().includes(session.sessionToken)) {
            sessionToken = session.sessionToken; // Keep existing valid token
          }
        } catch {
          // Use new token
        }
      }
      
      localStorage.setItem(sessionKey, JSON.stringify({ 
        table: lockedTable, 
        phone, 
        isPhoneEntered: true,
        tableTimestamp: Date.now(),
        timestamp: Date.now(),
        sessionToken
      }));
    }

    setIsPhoneEntered(true);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Please add items to your cart');
      return;
    }

    // Rate limit check
    if (!checkRateLimit()) {
      return;
    }

    // Validate special instructions if provided
    if (specialInstructions.trim()) {
      const instructionsValidation = validateInput(specialInstructionsSchema, specialInstructions.trim());
      if (!instructionsValidation.success) {
        toast.error(instructionsValidation.error);
        return;
      }
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const sanitizedInstructions = specialInstructions.trim() 
      ? sanitizeText(specialInstructions.trim()) 
      : undefined;
    
    addOrder(table, phone, cart, sanitizedInstructions);
    
    // Haptic feedback and sound for order success
    hapticOrderPlaced();
    playOrderSuccessSound();
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
    
    setCart([]);
    setSpecialInstructions('');
    setCartModalOpen(false);
    setSuccessModalOpen(true);
    setIsSubmitting(false);
  };

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    setIsScrolling(true);
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    if (cat === 'Favorites') {
      // Scroll to top for favorites
      window.scrollTo({ top: 0, behavior: 'smooth' });
      scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 500);
      return;
    }
    
    const el = document.getElementById(`cat-${cat}`);
    if (el) {
      // Calculate offset for sticky header (52px) + category pills (~68px) + extra padding
      const headerOffset = 140;
      const elementPosition = el.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Re-enable intersection observer after scroll completes
      scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 500);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'Pending', color: '#f39c12' };
      case 'accepted': return { text: 'Accepted', color: '#27ae60' };
      case 'preparing': return { text: 'Preparing', color: '#3498db' };
      case 'ready': return { text: 'Ready', color: '#27ae60' };
      case 'served': return { text: 'Served', color: '#27ae60' };
      default: return { text: status, color: '#666' };
    }
  };

  // Stale session warning - show when customer returns from browser history after payment
  if (showStaleSessionWarning) {
    return (
      <div className="min-h-screen bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Session Expired</h2>
          <p className="text-[#666] mb-6">
            Your previous order has been completed. Please scan the QR code at your table to start a new order.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem('sajilo:customerActiveSession');
              navigate('/', { replace: true });
            }}
            className="w-full bg-black text-white p-4 rounded-lg text-lg font-semibold"
          >
            Scan QR Code
          </button>
          <button
            onClick={() => setShowStaleSessionWarning(false)}
            className="w-full mt-3 text-[#666] text-sm underline"
          >
            I'm still at this table
          </button>
        </div>
      </div>
    );
  }

  // Staff confirmation required screen (payment within 3 hours)
  if (showStaffConfirmation && paymentBlock?.is_blocked) {
    const paidTime = paymentBlock.paid_at ? new Date(paymentBlock.paid_at) : null;
    const timeAgo = paidTime ? Math.round((Date.now() - paidTime.getTime()) / (1000 * 60)) : 0;
    const hoursAgo = Math.floor(timeAgo / 60);
    const minsAgo = timeAgo % 60;
    const timeAgoText = hoursAgo > 0 
      ? `${hoursAgo}h ${minsAgo}m ago` 
      : `${minsAgo} minutes ago`;
    
    return (
      <div className="min-h-screen min-h-[100dvh] bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-4 sm:p-6">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 sm:p-8 shadow-xl text-center">
          {/* Icon */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-amber-100 rounded-full flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600" />
          </div>
          
          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-foreground">Staff Confirmation Required</h2>
          
          {/* Description */}
          <p className="text-muted-foreground mb-4 sm:mb-6 text-sm sm:text-base leading-relaxed">
            Your bill was paid <span className="font-medium text-foreground">{timeAgoText}</span>. To start a new order, please ask a staff member to confirm.
          </p>
          
          {/* Table Info */}
          <div className="bg-muted/50 p-4 rounded-xl mb-6 sm:mb-8">
            <div className="text-lg sm:text-xl font-bold text-foreground">Table {table}</div>
            <div className="text-muted-foreground text-sm mt-1">{phone}</div>
          </div>
          
          {/* PIN Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>Ask Staff to Enter their PIN to approve</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            
            <StaffApprovalInput 
              onApprove={async () => {
                if (paymentBlock.block_id) {
                  const success = await overridePaymentBlock(paymentBlock.block_id);
                  if (success) {
                    setShowStaffConfirmation(false);
                    setPaymentBlock(null);
                    toast.success('Session approved! You can now order.');
                  } else {
                    toast.error('Failed to approve. Please try again.');
                  }
                }
              }}
            />
          </div>
          
          {/* Cancel Link */}
          <button
            onClick={() => {
              localStorage.removeItem('sajilo:customerActiveSession');
              navigate('/', { replace: true });
            }}
            className="w-full mt-6 text-muted-foreground text-sm hover:text-foreground transition-colors underline underline-offset-2"
          >
            Cancel and scan QR again
          </button>
        </div>
      </div>
    );
  }

  // Phone entry screen (Login Modal Style)
  if (!isPhoneEntered) {
    return (
      <div className="min-h-screen bg-black/50 flex items-end justify-center">
        <div className="bg-white w-full rounded-t-[20px] p-8 animate-slide-up">
          <h2 className="text-2xl font-bold mb-2">Let's start ordering</h2>
          <p className="text-[#666] mb-5">Enter your mobile number to continue.</p>
          <form onSubmit={handlePhoneSubmit}>
            <input
              type="tel"
              placeholder="98XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full p-4 border-2 border-[#eee] rounded-lg text-lg mb-4 outline-none focus:border-[#06C167]"
              maxLength={10}
              autoFocus
            />
            <button
              type="submit"
              disabled={phone.length < 10}
              className="w-full bg-black text-white p-4 rounded-lg text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </form>
          <p className="text-xs text-center text-[#999] mt-6">
            Table {table} • {formatNepalTime(new Date())}
          </p>
        </div>
      </div>
    );
  }

  // Main ordering interface
  return (
    <div className="min-h-screen bg-background pb-24 select-none">
      <Confetti isActive={showConfetti} />
      {/* Header */}
      <header className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2.5 bg-card sticky top-0 z-[999] shadow-[0_2px_10px_rgba(0,0,0,0.05)] border-b border-border">
        <div className="flex items-center gap-2">
          {settings.logo ? (
            <img src={settings.logo} alt={settings.restaurantName} className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <span className="text-2xl">🍵</span>
          )}
          <span className="text-lg font-bold tracking-tight text-foreground">{settings.restaurantName}</span>
        </div>
        
        <div className="justify-self-end flex items-center gap-2">
          {rushHourInfo.isRushHour && (
            <div className="flex items-center gap-1 px-2 py-1 bg-destructive/10 rounded-full text-xs text-destructive whitespace-nowrap">
              <Flame className="w-3 h-3" />
              Busy
            </div>
          )}
          <div className="text-sm bg-muted px-3 py-1.5 rounded-full font-medium text-foreground">
            Table {table}
          </div>
        </div>

        <div className="justify-self-end flex items-center gap-1 ml-2">
          <button 
            onClick={() => setDrawerOpen(true)}
            className="text-2xl bg-transparent border-none p-1 ml-1"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[2000] transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      
      {/* Side Drawer */}
      <div className={`fixed top-0 right-0 w-[280px] h-full bg-card z-[2001] transition-transform duration-300 shadow-[-5px_0_15px_rgba(0,0,0,0.1)] flex flex-col ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h3 className="font-bold text-lg text-foreground">My Account</h3>
          <button onClick={() => setDrawerOpen(false)} className="text-2xl text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-5 flex-1">
          <div className="bg-muted/50 p-4 rounded-xl border border-border mb-5">
            <span className="font-bold text-lg block mb-1 text-foreground">{phone}</span>
            {settings.pointSystemEnabled && (
              <div className="text-warning font-semibold flex items-center gap-1">
                ⭐ {customerPoints} Points
              </div>
            )}
            <div className="font-semibold text-muted-foreground text-sm mt-2">
              Table {table}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <button 
              onClick={() => {
                const newTheme = theme === 'dark' ? 'light' : 'dark';
                setTheme(newTheme);
              }}
              className="w-full bg-secondary border border-border px-3 py-2 rounded-full text-sm font-semibold text-foreground flex items-center gap-2 justify-start"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button 
              onClick={() => {
                // Check if there's unpaid bill
                if (totalDue > 0) {
                  toast.error(`Please pay your bill of रू${totalDue} before logging out`);
                  setDrawerOpen(false);
                  setBillModalOpen(true);
                  return;
                }
                // Clear ALL session data including phone
                localStorage.removeItem('sajilo:customerActiveSession');
                localStorage.removeItem('sajilo:customerPhone');
                setPhone('');
                setIsPhoneEntered(false);
                setCart([]);
                setDrawerOpen(false);
                toast.success('Logged out successfully');
                // Redirect to scan page
                navigate('/');
              }}
              className="w-full bg-[#fff0f0] border border-[#ffcccc] px-3 py-2 rounded-full text-sm font-semibold text-[#e74c3c] flex items-center gap-2 justify-start"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
          
          {/* Social Media Links */}
          {(settings.instagramUrl || settings.facebookUrl || settings.tiktokUrl || settings.googleReviewUrl) && (
            <div className="px-5 py-4 border-t border-[#eee]">
              <p className="text-xs text-[#999] mb-3">Follow us</p>
              <div className="flex gap-3">
                {settings.instagramUrl && (
                  <a 
                    href={settings.instagramUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#dc2743] flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {settings.facebookUrl && (
                  <a 
                    href={settings.facebookUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1877f2] flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {settings.tiktokUrl && (
                  <a 
                    href={settings.tiktokUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </a>
                )}
                {settings.googleReviewUrl && (
                  <a 
                    href={settings.googleReviewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#4285f4] flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                  >
                    <Star className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="p-5 bg-[#f9f9f9] border-t border-[#eee] text-sm text-[#666]">
          © {new Date().getFullYear()} {settings.restaurantName}
        </div>
      </div>

      {/* Hero */}
      <div className="h-[100px] bg-gradient-to-b from-black/40 to-black/40 bg-[url('https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop')] bg-cover bg-center flex items-end p-5">
        <div className="text-white">
          <h2 className="text-xl font-bold drop-shadow-md">Quality Tea & Snacks</h2>
          <p className="text-sm opacity-90">Freshly prepared for you</p>
        </div>
      </div>

      {/* Category Pills */}
      <div className="sticky top-[52px] bg-card px-5 py-4 flex gap-2.5 overflow-x-auto z-[998] shadow-[0_4px_10px_rgba(0,0,0,0.05)] scrollbar-hide border-b border-border">
        {categoryNames.map(cat => (
          <button
            key={cat}
            onClick={() => scrollToCategory(cat)}
            className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex items-center gap-1 ${
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat === 'Favorites' && <Heart className="w-3 h-3" />}
            {cat}
            {cat === 'Favorites' && favorites.length > 0 && (
              <span className="bg-primary-foreground/20 px-1.5 rounded-full text-xs ml-1">{favorites.length}</span>
            )}
          </button>
        ))}
        
      </div>

      {/* Menu Feed */}
      <div className="px-5 pt-5">
        {/* Favorites Section */}
        {activeCategory === 'Favorites' && (
          <div id="cat-Favorites">
            <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
              <Heart className="w-6 h-6 text-[#e74c3c]" /> Favorites
            </h2>
            {favoriteItems.length === 0 ? (
              <div className="text-center py-8 text-[#999]">
                <Heart className="w-12 h-12 mx-auto mb-3 text-[#ddd]" />
                <p>No favorites yet</p>
                <p className="text-sm">Tap the heart icon on items to add them here</p>
              </div>
            ) : (
              favoriteItems.map(item => {
                const qty = getItemQty(item.id);
                return (
                  <div key={item.id} className="flex justify-between border-b border-[#eee] pb-4 mb-5">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            hapticFavorite(); 
                            const btn = e.currentTarget;
                            btn.classList.remove('heart-animate');
                            void btn.offsetWidth; // Trigger reflow
                            btn.classList.add('heart-animate');
                            toggleFavorite(item.id); 
                          }}
                          className="text-[#e74c3c]"
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                      <p className="font-medium text-[#333]">रू{item.price}</p>
                      {item.description && (
                        <p className="text-xs text-[#888] mt-1 line-clamp-2">{item.description}</p>
                      )}
                      <div className="mt-3">
                        {qty === 0 ? (
                          <button
                            onClick={() => addToCart(item)}
                            className={`bg-white border border-[#ddd] text-[#06C167] font-bold px-5 py-1.5 rounded-full shadow-sm hover:shadow-md transition-shadow ${lastAddedItemId === item.id ? 'cart-bounce' : ''}`}
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="inline-flex items-center bg-white border border-[#eee] rounded-full overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              −
                            </button>
                            <span className="font-bold text-sm w-6 text-center">{qty}</span>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <LazyImage
                      src={item.image || ''}
                      alt={item.name}
                      className="w-[100px] h-[100px] rounded-xl"
                      fallbackClassName="w-[100px] h-[100px] rounded-xl"
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Regular Categories */}
        {categoryNames.filter(c => c !== 'Favorites').map(cat => {
          if (activeCategory === 'Favorites') return null;
          const items = menuItems.filter(item => item.category === cat);
          if (items.length === 0) return null;
          
          return (
            <div key={cat} id={`cat-${cat}`}>
              <h2 className="text-2xl font-bold mb-5">{cat}</h2>
              {items.map(item => {
                const qty = getItemQty(item.id);
                const isFav = isFavorite(item.id);
                return (
                  <div key={item.id} className={`flex justify-between border-b border-[#eee] pb-4 mb-5 ${!item.available ? 'opacity-60' : ''}`}>
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                        {getItemBadge(item.id) && <MenuItemBadge type={getItemBadge(item.id)!} />}
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            hapticFavorite(); 
                            const btn = e.currentTarget;
                            btn.classList.remove('heart-animate');
                            void btn.offsetWidth;
                            btn.classList.add('heart-animate');
                            toggleFavorite(item.id); 
                          }}
                          className={isFav ? 'text-[#e74c3c]' : 'text-[#ccc]'}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                      <p className="font-medium text-[#333]">रू{item.price}</p>
                      {item.description && (
                        <p className="text-xs text-[#888] mt-1 line-clamp-2">{item.description}</p>
                      )}
                      
                      {/* Inline Quantity Control or Unavailable */}
                      <div className="mt-3">
                        {!item.available ? (
                          <span className="inline-block bg-gray-200 text-gray-500 font-medium px-4 py-1.5 rounded-full text-sm">
                            Unavailable
                          </span>
                        ) : qty === 0 ? (
                          <button
                            onClick={() => addToCart(item)}
                            className={`bg-white border border-[#ddd] text-[#06C167] font-bold px-5 py-1.5 rounded-full shadow-sm hover:shadow-md transition-shadow ${lastAddedItemId === item.id ? 'cart-bounce' : ''}`}
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="inline-flex items-center bg-white border border-[#eee] rounded-full overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              −
                            </button>
                            <span className="font-bold text-sm w-6 text-center">{qty}</span>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`w-[100px] h-[100px] rounded-xl bg-[#eee] overflow-hidden flex-shrink-0 ${!item.available ? 'grayscale' : ''}`}>
                      {item.image ? (
                        <img 
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/50">
                          <span className="text-xs text-muted-foreground font-medium">No Image</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Floating Cart */}
      {cartCount > 0 && (
        <div 
          onClick={() => setCartModalOpen(true)}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-[500px] bg-[#06C167] text-white p-4 rounded-lg flex justify-between items-center font-semibold shadow-[0_10px_20px_rgba(6,193,103,0.3)] cursor-pointer z-[1000]"
        >
          <div className="flex gap-2.5">
            <div className="bg-black/10 px-2 rounded">{cartCount}</div>
            <span>View Cart</span>
          </div>
          <div>रू{cartTotal}</div>
        </div>
      )}

      {/* Cart Modal */}
      {cartModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end">
          <div className="bg-card w-full rounded-t-[20px] p-8 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold text-foreground">Your Order</h2>
              <button onClick={() => setCartModalOpen(false)} className="text-2xl text-muted-foreground hover:text-foreground">×</button>
            </div>
            
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center mb-4 pb-3 border-b border-border">
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{item.name}</div>
                  <div className="text-muted-foreground text-sm">रू{item.price}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => updateQty(item.menuItemId, -1)}
                      className="w-8 h-8 rounded-full bg-muted font-bold flex items-center justify-center text-foreground hover:bg-muted/80"
                    >
                      -
                    </button>
                    <span className="font-medium w-4 text-center text-foreground">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.menuItemId, 1)}
                      className="w-8 h-8 rounded-full bg-muted font-bold flex items-center justify-center text-foreground hover:bg-muted/80"
                    >
                      +
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.menuItemId)}
                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="mt-5 pt-5 border-t border-border">
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Special Instructions (Optional)
                </label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value.slice(0, 100))}
                  placeholder="e.g., Less sugar, extra spicy..."
                  maxLength={100}
                  className="w-full p-3 border-2 border-border rounded-lg text-sm resize-none outline-none focus:border-primary bg-background text-foreground"
                  rows={2}
                />
                <div className="text-xs text-muted-foreground text-right mt-1">
                  {specialInstructions.length}/100
                </div>
              </div>
              <div className="flex justify-between font-bold text-xl mb-5 text-foreground">
                <span>Total</span>
                <span>रू{cartTotal}</span>
              </div>
              <button 
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground p-4 rounded-lg text-lg font-semibold disabled:opacity-50"
              >
                {isSubmitting ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end">
          <div className="bg-card w-full rounded-t-[20px] p-8 text-center pb-10 animate-slide-up">
            <div className="w-20 h-20 bg-success rounded-full mx-auto mb-5 flex items-center justify-center animate-[popIn_0.5s_cubic-bezier(0.68,-0.55,0.265,1.55)]">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-foreground">Order Placed!</h2>
            <p className="text-muted-foreground mb-8">The counter has received your order.</p>
            <button 
              onClick={() => { setSuccessModalOpen(false); setBillModalOpen(true); }}
              className="w-full bg-primary text-primary-foreground p-4 rounded-lg text-lg font-semibold"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {billModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end">
          <div className="bg-card w-full rounded-t-[20px] p-8 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold text-foreground">My Orders</h2>
              <button onClick={() => {
                setBillModalOpen(false);
                // Show install prompt after closing bill if not PWA and not shown before
                if (!isPWA() && !hasShownInstallPrompt && myOrders.length > 0) {
                  setTimeout(() => {
                    setShowInstallPrompt(true);
                    setHasShownInstallPrompt(true);
                  }, 500);
                }
              }} className="text-2xl text-muted-foreground hover:text-foreground">×</button>
            </div>
            
            {myOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-5">No active orders.</p>
            ) : (
              myOrders.map(order => (
                <div key={order.id} className="mb-4 bg-muted/50 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-muted-foreground">Order #{order.id.slice(-6)}</span>
                    {order.status === 'pending' && (
                      <button
                        onClick={() => {
                          // Re-check the latest status before canceling to avoid race condition
                          const currentOrder = storeOrders.find(o => o.id === order.id);
                          if (currentOrder && currentOrder.status === 'pending') {
                            updateOrderStatus(order.id, 'cancelled');
                            toast.success('Order cancelled');
                          } else {
                            toast.error('Order already accepted, cannot cancel');
                          }
                        }}
                        className="text-xs text-destructive font-medium px-2 py-1 border border-destructive/20 rounded-full hover:bg-destructive/10"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                  {order.items.map((item, idx) => {
                    const status = getStatusText(order.status);
                    return (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                        <div>
                          <div className="font-semibold text-foreground">{item.qty}x {item.name}</div>
                          <div className="text-sm text-muted-foreground">रू{item.price * item.qty}</div>
                        </div>
                        <span style={{ color: status.color }} className="font-bold text-sm">
                          {status.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            <div className="mt-5 border-t border-border pt-4 text-right">
              <h3 className="text-xl font-bold text-foreground">Total Due: रू{totalDue}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Install Prompt */}
      {showInstallPrompt && !isPWA() && (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] animate-slide-up">
          <div className="bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 mx-auto max-w-md rounded-t-2xl">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                {settings.logo ? (
                  <img src={settings.logo} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <span className="text-2xl">🍵</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Install our app?</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Order faster next time with one tap</p>
              </div>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="text-muted-foreground text-xl leading-none p-1 hover:text-foreground"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="flex-1 py-2.5 px-4 rounded-full border border-border text-muted-foreground font-medium text-sm hover:bg-muted"
              >
                Not now
              </button>
              {deferredPrompt ? (
                <button
                  onClick={async () => {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                      toast.success('App installed!');
                    }
                    setDeferredPrompt(null);
                    setShowInstallPrompt(false);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-full bg-primary text-primary-foreground font-medium text-sm"
                >
                  Install App
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigate('/install');
                  }}
                  className="flex-1 py-2.5 px-4 rounded-full bg-primary text-primary-foreground font-medium text-sm"
                >
                  How to Install
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-4 z-[1500] flex flex-col-reverse items-end gap-2">
        {/* FAB Menu Items */}
        {fabOpen && (
          <>
            <button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(10);
                setBillModalOpen(true);
                setFabOpen(false);
              }}
              className="flex items-center gap-2 bg-card border border-border shadow-lg px-4 py-3 rounded-full text-sm font-semibold text-foreground fab-item-1"
            >
              <FileText className="w-4 h-4" /> My Bill
            </button>
            <button
              onClick={() => {
                hapticAddToCart(); // Light haptic for waiter call
                const hasPendingCall = waiterCalls.some(
                  c => c.tableNumber === table && c.status === 'pending'
                );
                if (hasPendingCall) {
                  toast.info('Waiter has already been called. Please wait.');
                } else {
                  callWaiter(table, phone);
                  toast.success('Waiter has been called! They will be with you shortly.');
                }
                setFabOpen(false);
              }}
              className="flex items-center gap-2 bg-[#fff8e1] border border-[#ffe0b2] shadow-lg px-4 py-3 rounded-full text-sm font-semibold text-[#f39c12] fab-item-2"
            >
              <Bell className="w-4 h-4" /> Call Waiter
            </button>
            <button
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(10);
                window.location.reload();
              }}
              className="flex items-center gap-2 bg-white border border-[#eee] shadow-lg px-4 py-3 rounded-full text-sm font-semibold text-[#333] fab-item-3"
            >
              <RefreshCw className="w-4 h-4" /> Refresh App
            </button>
          </>
        )}
        
        {/* FAB Toggle Button */}
        <button
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(15);
            setFabOpen(!fabOpen);
          }}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
            fabOpen 
              ? 'bg-[#333] text-white rotate-45' 
              : 'bg-primary text-white'
          }`}
        >
          {fabOpen ? <Plus className="w-6 h-6" /> : <UtensilsCrossed className="w-6 h-6" />}
        </button>
      </div>

      {/* FAB Overlay */}
      {fabOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-[1400]"
          onClick={() => setFabOpen(false)}
        />
      )}

      {/* Copyright Footer */}
      <footer className="py-4 text-center border-t border-[#eee] bg-white mt-auto">
        <p className="text-xs text-[#999]">
          © {new Date().getFullYear()} {settings.restaurantName}. Developed by{' '}
          <a href="https://khagesh.com.np" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Khagesh
          </a>
        </p>
      </footer>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @keyframes popIn {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        @keyframes fab-slide-in {
          0% { 
            opacity: 0; 
            transform: translateX(20px) scale(0.8); 
          }
          100% { 
            opacity: 1; 
            transform: translateX(0) scale(1); 
          }
        }
        .fab-item-1 {
          animation: fab-slide-in 0.2s ease-out forwards;
          animation-delay: 0ms;
        }
        .fab-item-2 {
          animation: fab-slide-in 0.2s ease-out forwards;
          animation-delay: 50ms;
          opacity: 0;
        }
        .fab-item-3 {
          animation: fab-slide-in 0.2s ease-out forwards;
          animation-delay: 100ms;
          opacity: 0;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
