import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useDynamicManifest } from '@/hooks/useDynamicManifest';
import { Order, OrderItem, Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { 
  Check,
  X,
  Search,
  LogOut,
  Printer,
  RefreshCw,
  Wallet,
  Plus,
  Trash2,
  Bell,
  Settings,
  Map as MapIcon,
  Calculator,
  Sun,
  Moon,
  Timer,
  ChefHat,
  CalendarIcon
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { formatNepalTime, formatNepalDateTime } from '@/lib/nepalTime';
import FonepayQR from '@/components/FonepayQR';
import { useOrderNotification } from '@/hooks/useOrderNotification';
import { useWaiterCallNotification } from '@/hooks/useWaiterCallNotification';
import { useAutoCancel } from '@/hooks/useAutoCancel';
import { TableMap } from '@/components/ui/TableMap';
import { CashRegister } from '@/components/CashRegister';
import { closeTableSession } from '@/lib/sessionManager';
import { recordPaymentBlocksForPhones } from '@/lib/paymentBlockApi';
import { LowStockAlert } from '@/components/LowStockAlert';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';
import { useBackupReminder } from '@/hooks/useBackupReminder';
import { exportDatabase, dismissBackupReminder } from '@/lib/databaseBackup';
import { PrinterConnectionUI } from '@/components/PrinterConnectionUI';
import { Database, Download } from 'lucide-react';

// Order age thresholds (in seconds) for timer coloring
const AGE_WARNING = 300; // 5 minutes - yellow
const AGE_CRITICAL = 600; // 10 minutes - red

interface BillGroup {
  key: string;
  phone: string;
  tableNumber: number;
  points: number;
  subtotal: number;
  items: { name: string; qty: number; price: number; total: number }[];
  createdAt: string;
}

interface PendingOrderGroup {
  key: string;
  phone: string;
  tableNumber: number;
  orders: Order[];
  allItems: OrderItem[];
  createdAt: string;
}

const expenseCategories = ['ingredients', 'utilities', 'salary', 'maintenance', 'other'] as const;

export default function Counter() {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  
  // Theme hook
  const { theme, setTheme } = useTheme();
  
  // Dynamic manifest for PWA
  useDynamicManifest();
  
  // Audio notification hooks
  useOrderNotification();
  useWaiterCallNotification();
  
  // Auto-cancel pending orders after 30 minutes
  useAutoCancel();
  
  const { 
    orders, 
    bills, 
    transactions,
    customers,
    expenses,
    waiterCalls,
    createBill, 
    payBill,
    updateOrderStatus,
    addExpense,
    deleteExpense,
    acknowledgeWaiterCall,
    dismissWaiterCall,
    getPendingWaiterCalls,
    isAuthenticated,
    currentUser,
    logout,
    settings,
    getCustomerPoints,
    // For backup
    categories, menuItems, staff, inventoryItems
  } = useStore();
  
  // Backup reminder hook
  const { showReminder: showBackupReminder, daysSinceLastBackup } = useBackupReminder(currentUser?.role);

  const [activeTab, setActiveTab] = useState<'active' | 'accepted' | 'history' | 'expenses'>('active');
  const [searchInput, setSearchInput] = useState('');
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [fonepayModalOpen, setFonepayModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState('');
  const [historyLimit, setHistoryLimit] = useState(10);
  const [billsLimit, setBillsLimit] = useState(10);
  const [acceptedLimit, setAcceptedLimit] = useState(10);
  const [expensesLimit, setExpensesLimit] = useState(10);
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [lastPaidData, setLastPaidData] = useState<any>(null);
  const [currentDetailData, setCurrentDetailData] = useState<any>(null);
  
  // Manual discount states
  const [manualDiscountType, setManualDiscountType] = useState<'percent' | 'amount'>('amount');
  const [manualDiscountValue, setManualDiscountValue] = useState('');
  
  // Split payment states
  const [splitPaymentEnabled, setSplitPaymentEnabled] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [fonepayAmount, setFonepayAmount] = useState('');
  
  // Expense states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ amount: '', description: '', category: 'other' as Expense['category'] });
  
  // Table Map and Cash Register states
  const [tableMapOpen, setTableMapOpen] = useState(false);
  const [cashRegisterOpen, setCashRegisterOpen] = useState(false);
  const [printerUIOpen, setPrinterUIOpen] = useState(false);

  const isDataLoaded = useStore(state => state.isDataLoaded);

  // Show loading while data is being fetched
  if (!isDataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <RefreshCw className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Timer refresh for order age display (always active)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const interval = setInterval(() => forceUpdate({}), 10000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return null;
  }

  // Timer helper functions for KDS
  const getOrderAge = (createdAt: string): number => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAgeColor = (age: number): string => {
    if (age >= AGE_CRITICAL) return 'text-destructive bg-destructive/15 animate-pulse';
    if (age >= AGE_WARNING) return 'text-warning bg-warning/15';
    return 'text-success bg-success/15';
  };

  // Filter orders
  const pendingOrdersRaw = orders.filter(o => o.status === 'pending');
  const acceptedOrders = orders.filter(o => o.status === 'accepted');
  
  // Filter accepted orders with search for display
  const getFilteredAcceptedOrders = () => {
    let data = [...acceptedOrders];
    if (searchInput) {
      const term = searchInput.toLowerCase();
      data = data.filter(o => 
        o.tableNumber.toString().includes(term) ||
        (o.customerPhone || '').toLowerCase().includes(term) ||
        o.id.toLowerCase().includes(term) ||
        o.items.some(i => i.name.toLowerCase().includes(term))
      );
    }
    return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };
  const filteredAcceptedOrders = getFilteredAcceptedOrders();

  // Helper function to aggregate items by name and price
  const aggregateItems = (items: { name: string; qty: number; price: number }[]) => {
    const aggregated: { name: string; qty: number; price: number }[] = [];
    items.forEach(item => {
      const existing = aggregated.find(a => a.name === item.name && a.price === item.price);
      if (existing) {
        existing.qty += item.qty;
      } else {
        aggregated.push({ name: item.name, qty: item.qty, price: item.price });
      }
    });
    return aggregated;
  };

  // Group pending orders by customer (table + phone)
  const getGroupedPendingOrders = (): PendingOrderGroup[] => {
    const groups: Record<string, PendingOrderGroup> = {};
    
    pendingOrdersRaw.forEach(order => {
      const key = `${order.tableNumber}_${order.customerPhone || 'Guest'}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          phone: order.customerPhone || 'Guest',
          tableNumber: order.tableNumber,
          orders: [],
          allItems: [],
          createdAt: order.createdAt
        };
      }
      groups[key].orders.push(order);
      groups[key].allItems.push(...order.items);
      // Keep earliest createdAt
      if (new Date(order.createdAt) < new Date(groups[key].createdAt)) {
        groups[key].createdAt = order.createdAt;
      }
    });

    // Aggregate items for each group
    Object.values(groups).forEach(group => {
      group.allItems = aggregateItems(group.allItems.map(i => ({ name: i.name, qty: i.qty, price: i.price }))) as any;
    });

    return Object.values(groups).sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  };

  const pendingOrders = getGroupedPendingOrders();

  // Group accepted orders by table+phone for billing
  const getBillGroups = (): BillGroup[] => {
    const groups: Record<string, BillGroup> = {};
    
    acceptedOrders.forEach(order => {
      // Check if already billed
      const alreadyBilled = bills.some(b => 
        b.status === 'paid' && b.orders.some(bo => bo.id === order.id)
      );
      if (alreadyBilled) return;

      const key = `${order.tableNumber}_${order.customerPhone || 'Guest'}`;
      if (!groups[key]) {
        const customerPoints = getCustomerPoints(order.customerPhone);
        groups[key] = {
          key,
          phone: order.customerPhone || 'Guest',
          tableNumber: order.tableNumber,
          points: customerPoints,
          subtotal: 0,
          items: [],
          createdAt: order.createdAt
        };
      }
      
      order.items.forEach(item => {
        const itemTotal = item.qty * item.price;
        groups[key].subtotal += itemTotal;
        
        // Aggregate same items together
        const existingItem = groups[key].items.find(i => i.name === item.name && i.price === item.price);
        if (existingItem) {
          existingItem.qty += item.qty;
          existingItem.total += itemTotal;
        } else {
          groups[key].items.push({
            name: item.name,
            qty: item.qty,
            price: item.price,
            total: itemTotal
          });
        }
      });
    });

    // Apply search filter
    let result = Object.values(groups);
    if (searchInput) {
      const term = searchInput.toLowerCase();
      result = result.filter(g => 
        g.tableNumber.toString().includes(term) || 
        g.phone.toLowerCase().includes(term)
      );
    }

    return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const billGroups = getBillGroups();

  // Get selected groups for payment
  const selectedGroups = billGroups.filter(g => selectedPhones.includes(g.phone));
  const paymentSubtotal = selectedGroups.reduce((sum, g) => sum + g.subtotal, 0);
  const availablePoints = settings.pointSystemEnabled && selectedPhones.length === 1 ? (selectedGroups[0]?.points || 0) : 0;
  
  // Calculate manual discount
  const manualDiscountAmount = useMemo(() => {
    const value = parseFloat(manualDiscountValue) || 0;
    if (manualDiscountType === 'percent') {
      return Math.round((paymentSubtotal * value) / 100);
    }
    return Math.min(value, paymentSubtotal);
  }, [manualDiscountType, manualDiscountValue, paymentSubtotal]);
  
  const pointsDiscount = redeemPoints ? Math.min(availablePoints, paymentSubtotal - manualDiscountAmount) : 0;
  const discountAmount = manualDiscountAmount + pointsDiscount;
  const paymentTotal = paymentSubtotal - discountAmount;

  // History data with search
  const getHistoryData = () => {
    let data = [...transactions];
    if (historyDate) {
      data = data.filter(t => t.paidAt.startsWith(historyDate));
    }
    if (searchInput) {
      const term = searchInput.toLowerCase();
      data = data.filter(t => 
        t.tableNumber.toString().includes(term) ||
        t.customerPhones.some(p => p.toLowerCase().includes(term)) ||
        t.id.toLowerCase().includes(term) ||
        t.paymentMethod.toLowerCase().includes(term)
      );
    }
    return data.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  };

  const historyData = getHistoryData();

  // Filtered expenses with search
  const getFilteredExpenses = () => {
    let data = [...expenses];
    if (searchInput) {
      const term = searchInput.toLowerCase();
      data = data.filter(e => 
        e.category.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term) ||
        e.amount.toString().includes(term)
      );
    }
    return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };
  const filteredExpenses = getFilteredExpenses();

  // Table map data - compute table status with colors
  const tableMapData = useMemo(() => {
    const tableCount = settings.tableCount || 10;
    const activeOrders = orders.filter(o => ['pending', 'accepted', 'preparing', 'ready'].includes(o.status));
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const readyOrders = orders.filter(o => o.status === 'ready');
    
    return Array.from({ length: tableCount }, (_, i) => {
      const tableNum = i + 1;
      const tableOrders = activeOrders.filter(o => o.tableNumber === tableNum);
      const hasPending = pendingOrders.some(o => o.tableNumber === tableNum);
      const hasReady = readyOrders.some(o => o.tableNumber === tableNum);
      const totalAmount = tableOrders.reduce((sum, o) => 
        sum + o.items.reduce((s, item) => s + item.price * item.qty, 0), 0
      );
      
      // Determine status: empty < ordering (pending) < occupied (in progress) < waiting (ready)
      let status: 'empty' | 'ordering' | 'occupied' | 'waiting' = 'empty';
      if (tableOrders.length > 0) {
        if (hasReady) {
          status = 'waiting'; // Ready to serve
        } else if (hasPending) {
          status = 'ordering'; // Has pending orders
        } else {
          status = 'occupied'; // Being prepared
        }
      }
      
      return {
        tableNumber: tableNum,
        status,
        customerCount: new Set(tableOrders.map(o => o.customerPhone)).size || undefined,
        totalAmount: totalAmount || undefined,
        hasActiveOrders: tableOrders.length > 0,
        hasPendingOrders: hasPending,
      };
    });
  }, [orders, settings.tableCount]);

  // Cash register data - calculate today's figures
  const cashRegisterData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    
    const todayTransactions = transactions.filter(t => t.paidAt.startsWith(today));
    const todayExpenses = expenses.filter(e => e.createdAt.startsWith(today));
    
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.total, 0);
    const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
    const cashPayments = todayTransactions.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.total, 0)
      + todayTransactions.filter(t => t.paymentMethod === 'split' && t.splitDetails).reduce((sum, t) => sum + (t.splitDetails?.cashAmount || 0), 0);
    const fonepayPayments = todayTransactions.filter(t => t.paymentMethod === 'fonepay').reduce((sum, t) => sum + t.total, 0)
      + todayTransactions.filter(t => t.paymentMethod === 'split' && t.splitDetails).reduce((sum, t) => sum + (t.splitDetails?.fonepayAmount || 0), 0);
    
    return { todayRevenue, todayExpenseTotal, cashPayments, fonepayPayments };
  }, [transactions, expenses]);

  const handleAcceptGroup = (group: PendingOrderGroup) => {
    // Accept all orders in the group
    let accepted = 0;
    group.orders.forEach(order => {
      const currentOrder = orders.find(o => o.id === order.id);
      if (currentOrder && currentOrder.status === 'pending') {
        updateOrderStatus(order.id, 'accepted');
        accepted++;
      }
    });
    
    if (accepted === 0) {
      toast.error('Orders were cancelled by customer');
      return;
    }
    
    toast.success(`${accepted} order${accepted > 1 ? 's' : ''} accepted`);
    
    // Only print KOT if counterKotEnabled is true (counter-specific setting)
    if (settings.counterKotEnabled) {
      printKOTGroup(group);
    }
  };

  const handleRejectGroup = (group: PendingOrderGroup) => {
    if (!confirm(`Reject ${group.orders.length > 1 ? 'all ' + group.orders.length + ' orders' : 'this order'}?`)) return;
    
    let rejected = 0;
    group.orders.forEach(order => {
      const currentOrder = orders.find(o => o.id === order.id);
      if (currentOrder && currentOrder.status === 'pending') {
        updateOrderStatus(order.id, 'cancelled');
        rejected++;
      }
    });
    
    if (rejected === 0) {
      toast.error('Orders were already cancelled');
      return;
    }
    
    toast.info(`${rejected} order${rejected > 1 ? 's' : ''} rejected`);
  };

  const aggregateOrderItemsForPrint = (items: OrderItem[]): OrderItem[] => {
    const map = new Map<string, OrderItem>();

    for (const item of items) {
      const key = `${item.menuItemId}__${item.price}__${item.name}`;
      const existing = map.get(key);
      if (existing) {
        existing.qty += item.qty;
      } else {
        map.set(key, { ...item });
      }
    }

    return Array.from(map.values());
  };

  const printKOTGroup = (group: PendingOrderGroup) => {
    const allNotes = group.orders.filter(o => o.notes).map(o => o.notes).join('; ');

    // IMPORTANT: group.allItems is aggregated for UI display and may NOT contain menuItemId.
    // For printer routing we must use raw order items.
    const rawItems: OrderItem[] = group.orders.flatMap(o => o.items);

    // Check if dual printer mode is enabled
    if (settings.dualPrinterEnabled) {
      // Build categoryKey (id or name) -> useBarPrinter map
      const categoryBarPrinterMap = new Map<string, boolean>();
      categories.forEach(cat => {
        const flag = cat.useBarPrinter ?? false;
        // Support both id and name lookups since MenuItem.category could be either
        categoryBarPrinterMap.set(cat.name, flag);
        categoryBarPrinterMap.set(cat.id, flag);
      });

      // Build menuItemId -> category lookup
      const menuItemCategoryMap = new Map<string, string>();
      menuItems.forEach(item => {
        menuItemCategoryMap.set(item.id, item.category);
      });

      // Split items by printer destination
      const kitchenItems: OrderItem[] = [];
      const barItems: OrderItem[] = [];

      rawItems.forEach(item => {
        const categoryKey = menuItemCategoryMap.get(item.menuItemId);
        const useBarPrinter = categoryKey ? (categoryBarPrinterMap.get(categoryKey) ?? false) : false;

        if (useBarPrinter) {
          barItems.push(item);
        } else {
          kitchenItems.push(item);
        }
      });

      const kitchenPrintItems = aggregateOrderItemsForPrint(kitchenItems);
      const barPrintItems = aggregateOrderItemsForPrint(barItems);

      // Print Kitchen KOT if there are kitchen items
      if (kitchenPrintItems.length > 0) {
        printSingleKOT(group, kitchenPrintItems, allNotes, 'KITCHEN ORDER');
      }

      // Print Bar KOT if there are bar items (with delay for browser popup blocking)
      if (barPrintItems.length > 0) {
        setTimeout(() => {
          printSingleKOT(group, barPrintItems, allNotes, 'BAR ORDER');
        }, 500);
      }
    } else {
      // Single printer mode - print all items together
      printSingleKOT(group, aggregateOrderItemsForPrint(rawItems), allNotes, 'KITCHEN ORDER');
    }
  };

  const printSingleKOT = (group: PendingOrderGroup, items: OrderItem[], notes: string, label: string) => {
    const printContent = `
      <div style="font-family: monospace; width: 300px; padding: 10px;">
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
          <h2 style="margin: 0;">${label}</h2>
          <div>${formatNepalDateTime(new Date())}</div>
        </div>
        <div style="font-size: 1.2rem; font-weight: bold; text-align: center; margin: 10px 0; border: 2px solid black; padding: 5px;">
          TABLE ${group.tableNumber}
        </div>
        <div style="text-align: center; margin-bottom: 10px; font-weight: bold;">Customer: ${group.phone}</div>
        ${group.orders.length > 1 ? `<div style="text-align: center; margin-bottom: 10px; font-size: 0.9rem;">(${group.orders.length} orders combined)</div>` : ''}
        <div style="border-bottom: 2px solid black; margin-bottom: 10px;"></div>
        ${items.map(i => `
          <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">
            <span>${i.qty} x</span>
            <span>${i.name}</span>
          </div>
        `).join('')}
        ${notes ? `
          <div style="border-top: 1px dashed black; margin-top: 10px; padding-top: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px;">📝 Special Instructions:</div>
            <div style="font-size: 1.1rem;">${notes}</div>
          </div>
        ` : ''}
        <div style="border-top: 2px solid black; margin-top: 20px; padding-top: 10px; text-align: center;">
          Ref: #${group.orders.map(o => o.id.slice(-6)).join(', #')}
        </div>
      </div>
    `;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    }
  };

  const toggleSelectBill = (phone: string) => {
    if (selectedPhones.includes(phone)) {
      setSelectedPhones(selectedPhones.filter(p => p !== phone));
    } else {
      setSelectedPhones([...selectedPhones, phone]);
    }
  };

  const openPaymentModal = () => {
    setRedeemPoints(false);
    setManualDiscountValue('');
    setManualDiscountType('amount');
    setSplitPaymentEnabled(false);
    setCashAmount('');
    setFonepayAmount('');
    setPaymentModalOpen(true);
  };

  const processPayment = (method: 'cash' | 'fonepay' | 'split') => {
    if (method === 'fonepay') {
      setPaymentModalOpen(false);
      setFonepayModalOpen(true);
      return;
    }

    if (method === 'split') {
      const cashAmt = parseFloat(cashAmount) || 0;
      const fonepayAmt = parseFloat(fonepayAmount) || 0;
      
      if (cashAmt + fonepayAmt !== paymentTotal) {
        toast.error(`Split amounts must equal रू${paymentTotal}`);
        return;
      }
      
      if (cashAmt <= 0 || fonepayAmt <= 0) {
        toast.error('Both cash and fonepay amounts must be greater than 0');
        return;
      }
      
      if (!confirm(`Confirm SPLIT payment: Cash रू${cashAmt} + Fonepay रू${fonepayAmt}?`)) return;
      executePayment('split', { cashAmount: cashAmt, fonepayAmount: fonepayAmt });
      return;
    }

    if (!confirm(`Confirm CASH payment of रू${paymentTotal}?`)) return;
    executePayment(method);
  };

  const executePayment = (method: 'cash' | 'fonepay' | 'split', splitDetails?: { cashAmount: number; fonepayAmount: number }) => {
    // Get order IDs from selected groups
    const orderIds = acceptedOrders
      .filter(o => selectedPhones.includes(o.customerPhone))
      .map(o => o.id);

    if (orderIds.length === 0) {
      toast.error('No orders to pay');
      return;
    }

    const tableNumber = selectedGroups[0]?.tableNumber || 0;
    const bill = createBill(tableNumber, orderIds, discountAmount);
    
    // For split payments, use 'split' as the payment method and pass splitDetails
    payBill(bill.id, method, splitDetails);

    // Close customer sessions for all phones that paid
    closeTableSession(tableNumber, selectedPhones);
    
    // Record payment blocks (3-hour cooldown)
    recordPaymentBlocksForPhones(tableNumber, selectedPhones);

    // Store last paid data for printing
    const methodDisplay = method === 'split' && splitDetails 
      ? `Cash रू${splitDetails.cashAmount} + Fonepay रू${splitDetails.fonepayAmount}` 
      : method.toUpperCase();
      
    setLastPaidData({
      date: formatNepalDateTime(new Date()),
      table: tableNumber,
      phones: selectedPhones.join(', '),
      items: selectedGroups.flatMap(g => g.items),
      total: paymentTotal,
      discount: discountAmount,
      method: methodDisplay,
      splitDetails
    });

    setPaymentModalOpen(false);
    setFonepayModalOpen(false);
    setSuccessModalOpen(true);
    setSelectedPhones([]);
    
    if (method === 'split' && splitDetails) {
      toast.success(`Split payment completed: Cash रू${splitDetails.cashAmount} + Fonepay रू${splitDetails.fonepayAmount}`);
    } else {
      toast.success(`Payment completed via ${method}`);
    }
  };

  const printReceipt = (data: any) => {
    const methodDisplay = data.splitDetails 
      ? `SPLIT: Cash रू${data.splitDetails.cashAmount} + Fonepay रू${data.splitDetails.fonepayAmount}`
      : (typeof data.method === 'string' && data.method.includes('Cash रू') ? data.method : data.method?.toUpperCase?.() || 'CASH');
      
    const printContent = `
      <div style="font-family: monospace; width: 300px; padding: 10px;">
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
          <h2 style="margin: 0;">${settings.restaurantName.toUpperCase()}</h2>
          <div>${data.date}</div>
          <div>Table: ${data.table}</div>
          <div>Customer: ${data.phones}</div>
        </div>
        ${data.items.map((i: any) => `
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>${i.qty}x ${i.name}</span>
            <span>${i.total}</span>
          </div>
        `).join('')}
        <div style="border-top: 1px dashed black; margin-top: 5px; padding-top: 5px;"></div>
        ${data.discount > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>Discount </span>
            <span>-${data.discount}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2rem; margin-top: 10px;">
          <span>TOTAL</span>
          <span>रू${data.total}</span>
        </div>
        <div style="text-align: center; margin-top: 10px; font-size: 0.9rem; background: #f0f0f0; padding: 5px; border-radius: 4px;">
          ${methodDisplay}
        </div>
        <div style="text-align: center; font-size: 0.8rem; margin-top: 20px;">Thank You!</div>
      </div>
    `;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    }
  };

  const viewTransactionDetail = (t: typeof transactions[0]) => {
    // Map items to include total (qty * price)
    const itemsWithTotal = t.items.map(item => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      total: item.qty * item.price
    }));

    setCurrentDetailData({
      id: t.id,
      date: t.paidAt,
      table: t.tableNumber,
      phones: t.customerPhones.join(', ') || 'Guest',
      items: itemsWithTotal,
      total: t.total,
      discount: t.discount,
      method: t.paymentMethod,
      splitDetails: t.splitDetails
    });
    setDetailModalOpen(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden relative">
      {/* Mobile Bottom Popup - Orders & Waiter Calls */}
      {(pendingOrders.length > 0 || getPendingWaiterCalls().length > 0) && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pos-sidebar rounded-t-2xl shadow-2xl max-h-[45vh] flex flex-col animate-slide-up">
          {/* Handle bar */}
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>
          
          {/* Header */}
          <div className="px-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">
                {pendingOrders.length} Orders • {getPendingWaiterCalls().length} Calls
              </span>
            </div>
          </div>
          
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {/* Waiter Calls */}
            {getPendingWaiterCalls().slice(0, 2).map(call => (
              <div 
                key={call.id} 
                className="rounded-xl p-3 relative overflow-hidden bg-warning/10 border border-warning/20"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-foreground flex items-center gap-2">
                    <Bell className="w-4 h-4 text-warning" />
                    Table {call.tableNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatNepalTime(call.createdAt)}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">Customer: {call.customerPhone}</div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 h-8 text-xs bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => {
                      acknowledgeWaiterCall(call.id);
                      toast.success(`Going to Table ${call.tableNumber}`);
                    }}
                  >
                    <Check className="w-3 h-3 mr-1" /> On My Way
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-8 border-border text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      dismissWaiterCall(call.id);
                      toast.info('Dismissed');
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Pending Orders */}
            {pendingOrders.slice(0, 2).map(group => (
              <div 
                key={group.key} 
                className="rounded-xl p-3 relative overflow-hidden bg-card border border-border shadow-md"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-warning to-destructive" />
                <div className="flex justify-between font-bold mb-1 text-foreground">
                  <span>Table {group.tableNumber}</span>
                  <span className="text-xs font-normal text-muted-foreground">{formatNepalTime(group.createdAt)}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  Customer: {group.phone}
                  {group.orders.length > 1 && <span className="ml-1 text-warning">({group.orders.length} orders)</span>}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {group.allItems.slice(0, 3).map(i => `${i.qty}x ${i.name}`).join(', ')}
                  {group.allItems.length > 3 && ` +${group.allItems.length - 3} more`}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 h-8 text-xs bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleAcceptGroup(group)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Accept{group.orders.length > 1 ? ' All' : ''}{settings.counterKotEnabled ? ' & Print' : ''}
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => handleRejectGroup(group)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Show more indicator */}
            {(pendingOrders.length > 2 || getPendingWaiterCalls().length > 2) && (
              <div className="text-center text-white/60 text-xs py-2">
                Scroll for more • {Math.max(0, pendingOrders.length - 2) + Math.max(0, getPendingWaiterCalls().length - 2)} more items
              </div>
            )}
            
            {/* Show remaining items if scrolled */}
            {getPendingWaiterCalls().slice(2).map(call => (
              <div 
                key={call.id} 
                className="rounded-xl p-3 relative overflow-hidden bg-warning/10 border border-warning/20"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-foreground flex items-center gap-2">
                    <Bell className="w-4 h-4 text-warning" />
                    Table {call.tableNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatNepalTime(call.createdAt)}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-2">Customer: {call.customerPhone}</div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 h-8 text-xs bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => {
                      acknowledgeWaiterCall(call.id);
                      toast.success(`Going to Table ${call.tableNumber}`);
                    }}
                  >
                    <Check className="w-3 h-3 mr-1" /> On My Way
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-8 border-border text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      dismissWaiterCall(call.id);
                      toast.info('Dismissed');
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {pendingOrders.slice(2).map(group => (
              <div 
                key={group.key} 
                className="rounded-xl p-3 relative overflow-hidden bg-card border border-border shadow-md"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-warning to-destructive" />
                <div className="flex justify-between font-bold mb-1 text-foreground">
                  <span>Table {group.tableNumber}</span>
                  <span className="text-xs font-normal text-muted-foreground">{formatNepalTime(group.createdAt)}</span>
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  Customer: {group.phone}
                  {group.orders.length > 1 && <span className="ml-1 text-warning">({group.orders.length} orders)</span>}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {group.allItems.slice(0, 3).map(i => `${i.qty}x ${i.name}`).join(', ')}
                  {group.allItems.length > 3 && ` +${group.allItems.length - 3} more`}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 h-8 text-xs bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleAcceptGroup(group)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Accept{group.orders.length > 1 ? ' All' : ''}{settings.counterKotEnabled ? ' & Print' : ''}
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => handleRejectGroup(group)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar - Incoming Orders & Waiter Calls - Hidden on mobile, shown on lg+ */}
      <div className="hidden lg:flex w-[350px] pos-sidebar flex-col relative overflow-hidden flex-shrink-0">
        {/* Decorative 3D elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/5 to-transparent" />
          <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-20 -left-10 w-32 h-32 rounded-full bg-secondary/10 blur-2xl" />
        </div>

        {/* Header with 3D effect */}
        <div className="p-5 relative z-10"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
          }}
        >
          <div className="flex items-center gap-3">
            {settings.logo && (
              <img src={settings.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover border border-white/20" />
            )}
            <div className="flex-1">
              <div className="text-lg font-bold flex justify-between items-center">
                <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  Incoming Orders
                </span>
                <span className="w-3 h-3 bg-red-500 rounded-full inline-block animate-pulse shadow-lg shadow-red-500/50" />
              </div>
              <div className="text-xs text-white/50 mt-0.5">Pending acceptance</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 relative z-10">
          {/* Waiter Calls Section */}
          {getPendingWaiterCalls().length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                <Bell className="w-4 h-4" /> Waiter Calls
              </div>
              {getPendingWaiterCalls().map(call => (
                <div 
                  key={call.id} 
                  className="rounded-xl p-4 animate-pulse relative overflow-hidden bg-warning/10 border border-warning/30 shadow-lg"
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-warning rounded-l-xl" />
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-lg text-foreground">Table {call.tableNumber}</span>
                    <span className="text-xs text-muted-foreground">{formatNepalTime(call.createdAt)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-3">
                    Customer: {call.customerPhone}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 bg-success hover:bg-success/90 text-success-foreground shadow-lg"
                      onClick={() => {
                        acknowledgeWaiterCall(call.id);
                        toast.success(`Going to Table ${call.tableNumber}`);
                      }}
                    >
                      <Check className="w-3 h-3 mr-1" /> On My Way
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="border-border text-muted-foreground hover:bg-muted"
                      onClick={() => {
                        dismissWaiterCall(call.id);
                        toast.info('Call dismissed');
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending Orders */}
          {pendingOrders.length === 0 && getPendingWaiterCalls().length === 0 ? (
            <div className="text-center text-white/40 mt-12 py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <Check className="w-8 h-8 text-white/20" />
              </div>
              <p>No pending orders</p>
            </div>
          ) : (
            pendingOrders.map(group => (
              <div 
                key={group.key} 
                className="rounded-xl p-4 animate-slide-up relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] bg-card border border-border shadow-lg"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-warning to-destructive rounded-l-xl" />
                <div className="flex justify-between font-bold mb-1 border-b border-dashed border-border pb-2 text-foreground">
                  <span className="text-lg">Table {group.tableNumber}</span>
                  <span className="text-sm font-normal text-muted-foreground">{formatNepalTime(group.createdAt)}</span>
                </div>
                <div className="text-sm text-muted-foreground italic mb-2">
                  Customer: {group.phone}
                  {group.orders.length > 1 && <span className="ml-2 text-warning font-medium not-italic">({group.orders.length} orders combined)</span>}
                </div>
                <div className="text-sm mb-3 space-y-1">
                  {group.allItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-foreground">
                      <span className="font-medium">{item.qty}x {item.name}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  ID: #{group.orders.map(o => o.id.slice(-6)).join(', #')}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 bg-success hover:bg-success/90 text-success-foreground shadow-lg"
                    onClick={() => handleAcceptGroup(group)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Accept{group.orders.length > 1 ? ' All' : ''}{settings.counterKotEnabled ? ' & Print' : ''}
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-lg"
                    onClick={() => handleRejectGroup(group)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-[#0f3460] to-transparent pointer-events-none z-10" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header - Responsive: All in one row, wraps if needed */}
        <div className="bg-card border-b border-border p-3 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Title */}
            <h2 className="text-lg md:text-xl font-bold whitespace-nowrap mr-auto sm:mr-0">Counter</h2>
            
            {/* Tabs - inline with title */}
            <div className="flex items-center gap-1.5 overflow-x-auto order-last sm:order-none w-full sm:w-auto sm:flex-1 sm:justify-start mt-2 sm:mt-0 sm:ml-4">
              <button 
                onClick={() => setActiveTab('active')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'active' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Active Bills
              </button>
              
              {/* Search box - after Active Bills */}
              <Input 
                type="text"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-24 sm:w-32 md:w-40 h-8 text-sm flex-shrink-0"
              />
              
              <button 
                onClick={() => setActiveTab('accepted')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'accepted' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                Accepted
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'history' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                History
              </button>
            </div>
            
            {/* Action buttons - stays in same row */}
            <div className="flex items-center gap-1.5 ml-auto">
              <Button 
                onClick={() => setTableMapOpen(true)}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex items-center gap-1"
              >
                <MapIcon className="w-3 h-3" /> Tables
              </Button>
              <Button 
                onClick={() => setCashRegisterOpen(true)}
                variant="outline"
                size="sm"
                className="h-8 text-xs flex items-center gap-1"
              >
                <Calculator className="w-3 h-3" /> Register
              </Button>
              <Button 
                onClick={() => setActiveTab('expenses')}
                variant="outline"
                size="sm"
                className={`h-8 text-xs flex items-center gap-1 ${
                  activeTab === 'expenses' 
                    ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' 
                    : ''
                }`}
              >
                <Wallet className="w-3 h-3" /> Expenses
              </Button>
              <Button 
                onClick={() => setPrinterUIOpen(true)}
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="Printer Connections"
              >
                <Printer className="w-3.5 h-3.5" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.location.reload()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              {(settings.counterAsAdmin || currentUser?.role === 'admin') && (
                <Button variant="outline" size="icon" className="h-8 w-8 bg-primary/10 border-primary text-primary hover:bg-primary/20" onClick={() => navigate('/admin')}>
                  <Settings className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleLogout}>
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Low Stock Alert */}
          <LowStockAlert />
          
          {/* Active Bills Tab */}
          {activeTab === 'active' && (
            <div className="flex flex-wrap gap-5">
              {billGroups.slice(0, billsLimit).map(group => {
                const orderAge = getOrderAge(group.createdAt);
                return (
                  <div 
                    key={group.key}
                    onClick={() => toggleSelectBill(group.phone)}
                    className={`bg-card w-[280px] p-5 rounded-xl border cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                      selectedPhones.includes(group.phone) 
                        ? 'border-2 border-success bg-success/5 shadow-md' 
                        : 'border-border'
                    }`}
                  >
                    <div className="flex justify-between font-semibold mb-2 border-b border-dashed border-border pb-2">
                      <span className="text-foreground">{group.phone}</span>
                      <span className="text-muted-foreground">Table {group.tableNumber}</span>
                    </div>
                    
                    {/* Timer card - always active */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold mb-3 w-fit ${getAgeColor(orderAge)}`}>
                      <Timer className="w-3.5 h-3.5" />
                      {formatTimer(orderAge)}
                    </div>
                    
                    <div className="mb-3 space-y-1">
                      {group.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm text-muted-foreground">
                          <span>{item.qty}x {item.name}</span>
                          <span>{item.total}</span>
                        </div>
                      ))}
                    </div>
                    <div className="font-bold text-right text-lg border-t border-border pt-2 text-foreground">
                      रू{group.subtotal}
                    </div>
                    {settings.pointSystemEnabled && group.points > 0 && (
                      <div className="text-xs text-warning mt-1">⭐ {group.points} points available</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{formatNepalTime(group.createdAt)}</div>
                  </div>
                );
              })}
              {billGroups.length === 0 && (
                <div className="w-full text-center text-muted-foreground py-12">No unpaid bills found.</div>
              )}
              {billGroups.length > billsLimit && (
                <div className="w-full text-center mt-4">
                  <Button variant="outline" onClick={() => setBillsLimit(billsLimit + 10)}>
                    Show More ({billGroups.length - billsLimit})
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Accepted Orders Tab */}
          {activeTab === 'accepted' && (
            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 md:p-4 text-left font-semibold text-muted-foreground text-sm">ID</th>
                      <th className="p-3 md:p-4 text-left font-semibold text-muted-foreground text-sm">Time</th>
                      <th className="p-3 md:p-4 text-left font-semibold text-muted-foreground text-sm">Table</th>
                      <th className="p-3 md:p-4 text-left font-semibold text-muted-foreground text-sm">Customer</th>
                      <th className="p-3 md:p-4 text-left font-semibold text-muted-foreground text-sm">Items</th>
                      <th className="p-3 md:p-4 text-left font-semibold text-muted-foreground text-sm">Total</th>
                      {/* Show Actions column if setting is OFF or user has admin access */}
                      {(!settings.acceptedOrderCancelAdminOnly || currentUser?.role === 'admin' || settings.counterAsAdmin) && (
                        <th className="p-3 md:p-4 text-left font-semibold text-muted-foreground text-sm">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAcceptedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={(!settings.acceptedOrderCancelAdminOnly || currentUser?.role === 'admin' || settings.counterAsAdmin) ? 7 : 6} className="text-center py-8 text-muted-foreground">No accepted orders.</td>
                      </tr>
                    ) : (
                      filteredAcceptedOrders.slice(0, acceptedLimit).map(order => (
                        <tr key={order.id} className="border-t border-border hover:bg-muted/50">
                          <td className="p-3 md:p-4 text-sm text-foreground">#{order.id.slice(-6)}</td>
                          <td className="p-3 md:p-4 text-sm text-foreground">{formatNepalTime(order.createdAt)}</td>
                          <td className="p-3 md:p-4 text-sm text-foreground">Table {order.tableNumber}</td>
                          <td className="p-3 md:p-4 text-sm text-foreground">{order.customerPhone}</td>
                          <td className="p-3 md:p-4 text-sm text-foreground">{order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                          <td className="p-3 md:p-4 font-bold text-sm text-foreground">रू{order.total}</td>
                          {/* Cancel button - shown if setting is OFF or user has admin access */}
                          {(!settings.acceptedOrderCancelAdminOnly || currentUser?.role === 'admin' || settings.counterAsAdmin) && (
                            <td className="p-3 md:p-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Cancel order #${order.id.slice(-6)}? This cannot be undone.`)) {
                                    updateOrderStatus(order.id, 'cancelled');
                                    toast.info(`Order #${order.id.slice(-6)} cancelled`);
                                  }
                                }}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredAcceptedOrders.length > acceptedLimit && (
                <div className="text-center py-4">
                  <Button variant="outline" onClick={() => setAcceptedLimit(acceptedLimit + 10)}>
                    Show More ({filteredAcceptedOrders.length - acceptedLimit} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <div className="mb-4 flex flex-wrap gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-48 justify-start text-left font-normal",
                        !historyDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {historyDate ? format(parse(historyDate, 'yyyy-MM-dd', new Date()), 'PPP') : <span>Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={historyDate ? parse(historyDate, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(date) => { 
                        if (date) {
                          setHistoryDate(format(date, 'yyyy-MM-dd')); 
                        }
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Button onClick={() => setHistoryDate('')}>Clear Filter</Button>
              </div>
              <div className="bg-card rounded-lg overflow-hidden shadow-sm border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Bill ID</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Paid At</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Table</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Customers</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Total</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.slice(0, historyLimit).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-muted-foreground">No transactions found.</td>
                        </tr>
                      ) : (
                        historyData.slice(0, historyLimit).map(t => (
                          <tr 
                            key={t.id} 
                            className="border-t border-border hover:bg-muted/50 cursor-pointer"
                            onClick={() => viewTransactionDetail(t)}
                          >
                            <td className="p-3 md:p-4 text-sm text-foreground">#{t.id.slice(-6)}</td>
                            <td className="p-3 md:p-4 text-sm text-foreground">{formatNepalTime(t.paidAt)}</td>
                            <td className="p-3 md:p-4 text-sm text-foreground">Table {t.tableNumber}</td>
                            <td className="p-3 md:p-4 text-sm text-foreground">{t.customerPhones.join(', ') || 'Guest'}</td>
                            <td className="p-3 md:p-4 font-bold text-sm text-foreground">रू{t.total}</td>
                            <td className="p-3 md:p-4 text-sm text-foreground">
                              {t.paymentMethod === 'split' && t.splitDetails 
                                ? <span className="text-xs">Cash {t.splitDetails.cashAmount} + Fonepay {t.splitDetails.fonepayAmount}</span>
                                : t.paymentMethod.toUpperCase()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {historyData.length > historyLimit && (
                  <div className="text-center py-4">
                    <Button variant="outline" onClick={() => setHistoryLimit(historyLimit + 10)}>
                      Show More
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <div>
              <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h3 className="text-lg font-bold">Expense Tracking</h3>
                <Button onClick={() => setExpenseModalOpen(true)} className="bg-foreground text-background hover:bg-foreground/90">
                  <Plus className="w-4 h-4 mr-2" /> Add Expense
                </Button>
              </div>
              <div className="bg-card rounded-lg overflow-hidden shadow-sm border border-border">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[500px]">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Date</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Category</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Description</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Amount</th>
                        <th className="p-3 md:p-4 text-left font-bold text-muted-foreground text-sm">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">No expenses recorded.</td>
                        </tr>
                      ) : (
                        filteredExpenses.slice(0, expensesLimit).map(exp => (
                          <tr key={exp.id} className="border-t border-border hover:bg-muted/50">
                            <td className="p-3 md:p-4 text-sm text-foreground">{formatNepalDateTime(exp.createdAt)}</td>
                            <td className="p-3 md:p-4 capitalize text-sm text-foreground">{exp.category}</td>
                            <td className="p-3 md:p-4 text-sm text-foreground">{exp.description}</td>
                            <td className="p-3 md:p-4 font-bold text-destructive text-sm">-रू{exp.amount}</td>
                            <td className="p-3 md:p-4">
                              <Button size="sm" variant="destructive" onClick={() => { deleteExpense(exp.id); toast.success('Deleted'); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredExpenses.length > expensesLimit && (
                  <div className="text-center py-4">
                    <Button variant="outline" onClick={() => setExpensesLimit(expensesLimit + 10)}>
                      Show More ({filteredExpenses.length - expensesLimit} remaining)
                    </Button>
                  </div>
                )}
                {filteredExpenses.length > 0 && (
                  <div className="p-4 bg-muted border-t border-border">
                    <div className="flex justify-between font-bold text-foreground">
                      <span>Total Expenses{searchInput ? ' (filtered)' : ''}:</span>
                      <span className="text-destructive">-रू{filteredExpenses.reduce((sum, e) => sum + e.amount, 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar - Desktop: below sidebar on left, Mobile: bottom right */}
        {selectedPhones.length > 0 && (
          <div className="fixed bottom-5 left-5 lg:left-[360px] right-auto lg:right-auto bg-[#222] text-white px-8 py-4 rounded-full flex items-center gap-5 shadow-lg z-50 animate-slide-up">
            <div><span className="font-bold">{selectedPhones.length}</span> bills selected</div>
            <Button className="bg-[#27ae60] hover:bg-[#27ae60]/90" onClick={openPaymentModal}>
              Pay & Clear
            </Button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto border-b border-[#eee] pb-4 mb-4">
            {selectedGroups.map(group => (
              <div key={group.key}>
                <div className="font-bold text-sm mt-3 mb-1">Customer: {group.phone}</div>
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.qty}x {item.name}</span>
                    <span>{item.total}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Manual Discount */}
          <div className="border border-border p-3 rounded-lg mb-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Discount</label>
            <div className="flex gap-2">
              <Select value={manualDiscountType} onValueChange={(v: 'percent' | 'amount') => setManualDiscountType(v)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amount">रू</SelectItem>
                  <SelectItem value="percent">%</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder={manualDiscountType === 'percent' ? '0-100' : 'Amount'}
                value={manualDiscountValue}
                onChange={(e) => setManualDiscountValue(e.target.value)}
                className="flex-1"
                min="0"
                max={manualDiscountType === 'percent' ? '100' : undefined}
              />
            </div>
          </div>

          {/* Loyalty Points - only show if point system is enabled */}
          {settings.pointSystemEnabled && availablePoints > 0 && (
            <div className="bg-success/10 border border-success/20 p-3 rounded-lg mb-4">
              <label className="flex justify-between items-center cursor-pointer">
                <span className="text-foreground">Redeem <b>{availablePoints}</b> points (रू{availablePoints} off)</span>
                <input 
                  type="checkbox" 
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                  className="w-5 h-5 accent-success"
                />
              </label>
            </div>
          )}

          {manualDiscountAmount > 0 && (
            <div className="flex justify-between text-success mb-1">
              <span>Discount {manualDiscountType === 'percent' ? `(${manualDiscountValue}%)` : ''}</span>
              <span>-रू{manualDiscountAmount}</span>
            </div>
          )}
          
          {pointsDiscount > 0 && (
            <div className="flex justify-between text-success mb-2">
              <span>Points Redeemed</span>
              <span>-रू{pointsDiscount}</span>
            </div>
          )}

          <div className="flex justify-between text-xl font-bold mb-4">
            <span>Total Pay:</span>
            <span>रू{paymentTotal}</span>
          </div>

          {/* Split Payment Toggle */}
          <div className="border border-border p-3 rounded-lg mb-4">
            <label className="flex justify-between items-center cursor-pointer">
              <span className="text-foreground font-medium">Split Payment (Cash + Fonepay)</span>
              <input 
                type="checkbox" 
                checked={splitPaymentEnabled}
                onChange={(e) => {
                  setSplitPaymentEnabled(e.target.checked);
                  if (e.target.checked) {
                    // Default to 50/50 split
                    const half = Math.floor(paymentTotal / 2);
                    setCashAmount(half.toString());
                    setFonepayAmount((paymentTotal - half).toString());
                  } else {
                    setCashAmount('');
                    setFonepayAmount('');
                  }
                }}
                className="w-5 h-5 accent-primary"
              />
            </label>
          </div>

          {/* Split Payment Inputs */}
          {splitPaymentEnabled && (
            <div className="border border-primary/30 bg-primary/5 p-4 rounded-lg mb-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="w-24 text-sm font-medium text-foreground">Cash:</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={cashAmount}
                  onChange={(e) => {
                    const cash = parseFloat(e.target.value) || 0;
                    setCashAmount(e.target.value);
                    setFonepayAmount(Math.max(0, paymentTotal - cash).toString());
                  }}
                  className="flex-1"
                  min="0"
                  max={paymentTotal}
                />
                <span className="text-sm text-muted-foreground">रू</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="w-24 text-sm font-medium text-foreground">Fonepay:</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={fonepayAmount}
                  onChange={(e) => {
                    const fonepay = parseFloat(e.target.value) || 0;
                    setFonepayAmount(e.target.value);
                    setCashAmount(Math.max(0, paymentTotal - fonepay).toString());
                  }}
                  className="flex-1"
                  min="0"
                  max={paymentTotal}
                />
                <span className="text-sm text-muted-foreground">रू</span>
              </div>
              {/* Split total validation */}
              {(() => {
                const total = (parseFloat(cashAmount) || 0) + (parseFloat(fonepayAmount) || 0);
                const diff = total - paymentTotal;
                if (diff !== 0) {
                  return (
                    <div className={`text-sm ${diff > 0 ? 'text-destructive' : 'text-warning'}`}>
                      {diff > 0 ? `Over by रू${diff}` : `Short by रू${Math.abs(diff)}`}
                    </div>
                  );
                }
                return <div className="text-sm text-success">✓ Amounts match total</div>;
              })()}
            </div>
          )}

          {/* Payment Buttons */}
          {splitPaymentEnabled ? (
            <Button 
              className="w-full bg-gradient-to-r from-foreground to-[#c32148] hover:opacity-90 text-white py-6 font-bold"
              onClick={() => processPayment('split')}
              disabled={(parseFloat(cashAmount) || 0) + (parseFloat(fonepayAmount) || 0) !== paymentTotal}
            >
              PAY SPLIT (Cash रू{cashAmount || 0} + Fonepay रू{fonepayAmount || 0})
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="border-2 border-foreground text-foreground font-bold py-6"
                onClick={() => processPayment('cash')}
              >
                CASH
              </Button>
              <Button 
                className="bg-[#c32148] hover:bg-[#c32148]/90 text-white py-6 font-bold"
                onClick={() => processPayment('fonepay')}
              >
                FONEPAY
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fonepay QR Modal */}
      <Dialog open={fonepayModalOpen} onOpenChange={setFonepayModalOpen}>
        <DialogContent className="max-w-sm p-0">
          <FonepayQR
            amount={paymentTotal}
            orderId={selectedGroups[0]?.key || 'ORDER'}
            onSuccess={() => executePayment('fonepay')}
            onCancel={() => setFonepayModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="text-6xl text-[#27ae60] mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-6">Payment Successful!</h2>
          <div className="flex gap-3 justify-center">
            <Button 
              variant="outline"
              onClick={() => lastPaidData && printReceipt(lastPaidData)}
            >
              <Printer className="w-4 h-4 mr-2" /> Print Receipt
            </Button>
            <Button onClick={() => setSuccessModalOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {currentDetailData && (
            <>
              <div className="mb-4">
                <div className="font-bold">#{currentDetailData.id.slice(-6)}</div>
                <div className="text-sm text-[#666]">{formatNepalDateTime(currentDetailData.date)}</div>
                <div className="text-sm">Table {currentDetailData.table} | {currentDetailData.phones}</div>
              </div>
              <div className="border-t border-[#eee] pt-3 mb-3">
                {currentDetailData.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm mb-1">
                    <span>{item.qty}x {item.name}</span>
                    <span>{item.qty * item.price}</span>
                  </div>
                ))}
              </div>
              {currentDetailData.discount > 0 && (
                <div className="flex justify-between text-[#27ae60]">
                  <span>Discount</span>
                  <span>-{currentDetailData.discount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-[#eee] pt-3">
                <span>Total</span>
                <span>रू{currentDetailData.total}</span>
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => printReceipt(currentDetailData)}
              >
                <Printer className="w-4 h-4 mr-2" /> Print Receipt
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Expense Modal */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="number"
              placeholder="Amount"
              value={newExpense.amount}
              onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
            />
            <Select value={newExpense.category} onValueChange={(v: Expense['category']) => setNewExpense({ ...newExpense, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {expenseCategories.map(c => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Description"
              value={newExpense.description}
              onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!newExpense.amount || !newExpense.description) {
                toast.error('Please fill all fields');
                return;
              }
              addExpense({
                amount: parseFloat(newExpense.amount),
                description: newExpense.description,
                category: newExpense.category,
                createdBy: currentUser?.name || 'Counter'
              });
              toast.success('Expense added');
              setNewExpense({ amount: '', description: '', category: 'other' });
              setExpenseModalOpen(false);
            }}>
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Map Modal */}
      <Dialog open={tableMapOpen} onOpenChange={setTableMapOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-primary" />
              Table Overview
            </DialogTitle>
          </DialogHeader>
          <TableMap 
            tables={tableMapData} 
            onTableClick={(tableNum) => {
              setSearchInput(tableNum.toString());
              setTableMapOpen(false);
              toast.info(`Filtered to Table ${tableNum}`);
            }}
          />
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground px-4">
            <span>🔴 Occupied: {tableMapData.filter(t => t.status === 'occupied').length}</span>
            <span>🟡 Ordering: {tableMapData.filter(t => t.status === 'ordering').length}</span>
            <span>🟢 Ready: {tableMapData.filter(t => t.status === 'waiting').length}</span>
            <span>⚪ Empty: {tableMapData.filter(t => t.status === 'empty').length}</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Register Modal */}
      <CashRegister
        open={cashRegisterOpen}
        onOpenChange={setCashRegisterOpen}
        todayRevenue={cashRegisterData.todayRevenue}
        todayExpenses={cashRegisterData.todayExpenseTotal}
        cashPayments={cashRegisterData.cashPayments}
        fonepayPayments={cashRegisterData.fonepayPayments}
      />

      {/* Weekly Backup Reminder Modal */}
      <Dialog open={showBackupReminder} onOpenChange={() => dismissBackupReminder()}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-warning" />
              Weekly Backup Reminder
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
              <p className="text-sm">
                {daysSinceLastBackup === null 
                  ? "You haven't created a backup yet!"
                  : `It's been ${daysSinceLastBackup} days since your last backup.`
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Regular backups protect your data from accidental loss. We recommend backing up at least once a week.
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                dismissBackupReminder();
                window.location.reload();
              }}
              className="w-full sm:w-auto"
            >
              Remind Me Later
            </Button>
            <Button 
              onClick={() => {
                const storeState = {
                  categories,
                  menuItems,
                  orders,
                  bills,
                  transactions,
                  customers,
                  staff,
                  expenses,
                  waiterCalls,
                  inventory: inventoryItems,
                  settings,
                };
                exportDatabase(storeState, settings.restaurantName || 'Sajilo-Orders');
                dismissBackupReminder();
                toast.success('Backup downloaded successfully!');
                window.location.reload();
              }}
              className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Backup Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printer Connection UI */}
      <PrinterConnectionUI open={printerUIOpen} onOpenChange={setPrinterUIOpen} />
    </div>
  );
}
