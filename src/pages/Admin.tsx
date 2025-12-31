import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useDynamicManifest } from '@/hooks/useDynamicManifest';
import { MenuItem, Customer, Staff } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Edit, Trash2, LogOut, Settings, LayoutDashboard, 
  UtensilsCrossed, Users, QrCode, History, TrendingUp, ShoppingBag, DollarSign,
  Download, Search, Eye, UserCog, BarChart3, Calendar, Image as ImageIcon, ToggleLeft, ToggleRight,
  Check, X, Menu as MenuIcon, MonitorDot, GripVertical, Upload, Loader2, Shield, Pencil,
  Sun, Moon, ChefHat, Package
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { formatNepalDateTime, formatNepalDateReadable, getNepalTodayString, getNepalDateDaysAgo, getTransactionDateInNepal } from '@/lib/nepalTime';
import { QRCodeSVG } from 'qrcode.react';
import { generatePrintQRData } from '@/lib/qrGenerator';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  validateInput,
  usernameSchema,
  passwordSchema,
  staffNameSchema,
  menuItemNameSchema,
  menuItemDescriptionSchema,
  menuItemPriceSchema,
  urlSchema,
  wifiSSIDSchema,
  wifiPasswordSchema,
  restaurantNameSchema,
  sanitizeText
} from '@/lib/validation';
import { uploadToR2 } from '@/lib/r2Client';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

const COLORS = ['#06C167', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Admin() {
  const navigate = useNavigate();
  const qrRef = useRef<HTMLDivElement>(null);
  
  // Theme hook
  const { theme, setTheme } = useTheme();
  
  // Dynamic manifest for PWA
  useDynamicManifest();
  
  const { 
    menuItems, addMenuItem, updateMenuItem, deleteMenuItem, toggleItemAvailability,
    bulkToggleAvailability,
    categories, addCategory, updateCategory, deleteCategory, reorderCategories,
    customers, transactions, staff, settings, updateSettings,
    addStaff, updateStaff, deleteStaff, expenses,
    isAuthenticated, currentUser, logout, getTodayStats,
    updateCustomerPhone
  } = useStore();

  // Subscription status for admin
  const { status: subscriptionStatus } = useSubscription();

  const [tab, setTab] = useState('dashboard');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<{ name: string; price: string; category: string; description: string; image: string }>({ 
    name: '', price: '', category: '', description: '', image: ''
  });

  // Category management
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryPrepTime, setNewCategoryPrepTime] = useState('5');
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; prepTime?: number } | null>(null);

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Menu search and bulk selection
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedMenuItems, setSelectedMenuItems] = useState<string[]>([]);

  // Search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyTab, setHistoryTab] = useState<'transactions' | 'expenses'>('transactions');

  // Modal states
  const [customerDetailModal, setCustomerDetailModal] = useState<Customer | null>(null);
  const [editingCustomerPhone, setEditingCustomerPhone] = useState<{ originalPhone: string; newPhone: string } | null>(null);
  const [staffModal, setStaffModal] = useState<{ open: boolean; editing: Staff | null }>({ open: false, editing: null });
  const [newStaff, setNewStaff] = useState({ username: '', password: '', pin: '', name: '', role: 'counter' as 'admin' | 'counter' | 'waiter' | 'kitchen' });

  // Dashboard date range states - use Nepal timezone
  const [dashboardDateFrom, setDashboardDateFrom] = useState(() => getNepalDateDaysAgo(30));
  const [dashboardDateTo, setDashboardDateTo] = useState(() => getNepalTodayString());

  // Analytics states (same as dashboard for consistency)
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState(() => getNepalDateDaysAgo(30));
  const [analyticsDateTo, setAnalyticsDateTo] = useState(() => getNepalTodayString());

  const isDataLoaded = useStore(state => state.isDataLoaded);

  // Show loading while data is being fetched
  if (!isDataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin mx-auto border-4 border-primary border-t-transparent rounded-full" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated or not authorized
  // Allow access if admin OR if counterAsAdmin is enabled for counter users
  const isAuthorized = currentUser?.role === 'admin' || 
    (currentUser?.role === 'counter' && settings.counterAsAdmin);
  
  useEffect(() => {
    if (!isAuthenticated || !isAuthorized) {
      navigate('/auth');
    }
  }, [isAuthenticated, isAuthorized, navigate]);

  if (!isAuthenticated || !isAuthorized) {
    return null;
  }

  const stats = getTodayStats();

  // Calculate analytics data with Nepal timezone
  const getAnalyticsData = () => {
    const filtered = transactions.filter(t => {
      const date = getTransactionDateInNepal(t.paidAt);
      return date >= analyticsDateFrom && date <= analyticsDateTo;
    });

    // Revenue by day (in Nepal timezone)
    const revenueByDay: Record<string, number> = {};
    filtered.forEach(t => {
      const day = getTransactionDateInNepal(t.paidAt);
      revenueByDay[day] = (revenueByDay[day] || 0) + t.total;
    });
    const dailyRevenue = Object.entries(revenueByDay)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top items
    const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
    filtered.forEach(t => {
      t.items.forEach(item => {
        if (!itemCounts[item.name]) {
          itemCounts[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemCounts[item.name].qty += item.qty;
        itemCounts[item.name].revenue += item.qty * item.price;
      });
    });
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    // Payment methods
    const cashTransactions = filtered.filter(t => t.paymentMethod === 'cash');
    const fonepayTransactions = filtered.filter(t => t.paymentMethod === 'fonepay');
    const paymentMethods = [
      { name: 'Cash', value: cashTransactions.length },
      { name: 'Fonepay', value: fonepayTransactions.length },
    ];
    const cashTotal = cashTransactions.reduce((sum, t) => sum + t.total, 0);
    const fonepayTotal = fonepayTransactions.reduce((sum, t) => sum + t.total, 0);

    // Peak hours
    const hourCounts: Record<number, number> = {};
    filtered.forEach(t => {
      const hour = new Date(t.paidAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const peakHours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      orders: hourCounts[i] || 0
    }));

    const totalRevenue = filtered.reduce((sum, t) => sum + t.total, 0);

    return {
      totalRevenue,
      totalOrders: filtered.length,
      avgOrderValue: filtered.length ? Math.round(totalRevenue / filtered.length) : 0,
      dailyRevenue,
      topItems,
      paymentMethods,
      peakHours,
      cashTotal,
      fonepayTotal,
      uniqueCustomers: new Set(filtered.flatMap(t => t.customerPhones)).size,
      transactions: filtered
    };
  };

  const analytics = getAnalyticsData();

  // Dashboard data with date range filter (Nepal timezone)
  const getDashboardData = () => {
    const filtered = transactions.filter(t => {
      const date = getTransactionDateInNepal(t.paidAt);
      return date >= dashboardDateFrom && date <= dashboardDateTo;
    });

    // Revenue by day for charts
    const revenueByDay: Record<string, number> = {};
    filtered.forEach(t => {
      const day = getTransactionDateInNepal(t.paidAt);
      revenueByDay[day] = (revenueByDay[day] || 0) + t.total;
    });
    const dailyRevenue = Object.entries(revenueByDay)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top items for charts
    const itemCounts: Record<string, { name: string; qty: number; revenue: number }> = {};
    filtered.forEach(t => {
      t.items.forEach(item => {
        if (!itemCounts[item.name]) {
          itemCounts[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        itemCounts[item.name].qty += item.qty;
        itemCounts[item.name].revenue += item.qty * item.price;
      });
    });
    const topItems = Object.values(itemCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalRevenue: filtered.reduce((sum, t) => sum + t.total, 0),
      totalOrders: filtered.length,
      uniqueCustomers: new Set(filtered.flatMap(t => t.customerPhones)).size,
      avgOrderValue: filtered.length ? Math.round(filtered.reduce((sum, t) => sum + t.total, 0) / filtered.length) : 0,
      dailyRevenue,
      topItems
    };
  };

  const dashboardData = getDashboardData();

  // Filtered data
  const filteredCustomers = customers.filter(c =>
    c.phone.includes(customerSearch) || (c.name && c.name.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = !historySearch || 
      t.tableNumber.toString().includes(historySearch) ||
      t.customerPhones.some(p => p.includes(historySearch));
    const matchesDateFrom = !historyDateFrom || t.paidAt.split('T')[0] >= historyDateFrom;
    const matchesDateTo = !historyDateTo || t.paidAt.split('T')[0] <= historyDateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
  }).sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = !historySearch || 
      e.description.toLowerCase().includes(historySearch.toLowerCase()) ||
      e.category.toLowerCase().includes(historySearch.toLowerCase());
    const matchesDateFrom = !historyDateFrom || e.createdAt.split('T')[0] >= historyDateFrom;
    const matchesDateTo = !historyDateTo || e.createdAt.split('T')[0] <= historyDateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleAddItem = () => {
    // Validate menu item name
    const nameValidation = validateInput(menuItemNameSchema, newItem.name);
    if (!nameValidation.success) {
      toast.error(nameValidation.error);
      return;
    }

    // Validate price
    const price = parseFloat(newItem.price);
    const priceValidation = validateInput(menuItemPriceSchema, price);
    if (!priceValidation.success) {
      toast.error(priceValidation.error);
      return;
    }

    // Validate description if provided
    if (newItem.description) {
      const descValidation = validateInput(menuItemDescriptionSchema, newItem.description);
      if (!descValidation.success) {
        toast.error(descValidation.error);
        return;
      }
    }

    addMenuItem({ 
      name: sanitizeText(newItem.name), 
      price: price, 
      category: newItem.category, 
      available: true,
      description: newItem.description ? sanitizeText(newItem.description) : undefined,
      image: newItem.image || undefined
    });
    toast.success('Item added');
    setNewItem({ name: '', price: '', category: 'Tea', description: '', image: '' });
    setIsAddingItem(false);
  };

  // Image upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Handle image upload for menu items - uses R2 CDN
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Upload to R2 CDN
    setIsUploadingImage(true);
    try {
      const result = await uploadToR2(file, { folder: 'menu', compress: true });
      if (result.success && result.url) {
        if (isEditing && editingItem) {
          setEditingItem({ ...editingItem, image: result.url });
        } else {
          setNewItem(prev => ({ ...prev, image: result.url }));
        }
        toast.success('Image uploaded to CDN');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('R2 upload failed:', error);
      toast.error('Image upload failed. Please check R2 configuration.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Bulk availability toggle
  const handleBulkToggle = (available: boolean) => {
    if (selectedMenuItems.length === 0) {
      toast.error('No items selected');
      return;
    }
    bulkToggleAvailability(selectedMenuItems, available);
    toast.success(`${selectedMenuItems.length} items ${available ? 'enabled' : 'disabled'}`);
    setSelectedMenuItems([]);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedMenuItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllInCategory = (catName: string) => {
    const catItems = menuItems.filter(m => m.category === catName).map(m => m.id);
    const allSelected = catItems.every(id => selectedMenuItems.includes(id));
    if (allSelected) {
      setSelectedMenuItems(prev => prev.filter(id => !catItems.includes(id)));
    } else {
      setSelectedMenuItems(prev => [...new Set([...prev, ...catItems])]);
    }
  };

  // Filter menu items by search
  const filteredMenuItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
    item.category.toLowerCase().includes(menuSearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(menuSearch.toLowerCase()))
  );

  const handleUpdateItem = () => {
    if (!editingItem) return;
    updateMenuItem(editingItem.id, editingItem);
    toast.success('Item updated');
    setEditingItem(null);
  };

  const handleAddStaff = () => {
    // Validate username
    const usernameValidation = validateInput(usernameSchema, newStaff.username);
    if (!usernameValidation.success) {
      toast.error(usernameValidation.error);
      return;
    }

    // Validate password
    const passwordValidation = validateInput(passwordSchema, newStaff.password);
    if (!passwordValidation.success) {
      toast.error(passwordValidation.error);
      return;
    }

    // Validate name
    const nameValidation = validateInput(staffNameSchema, newStaff.name);
    if (!nameValidation.success) {
      toast.error(nameValidation.error);
      return;
    }

    if (staff.some(s => s.username.toLowerCase() === newStaff.username.toLowerCase())) {
      toast.error('Username already exists');
      return;
    }

    addStaff({
      ...newStaff,
      username: sanitizeText(newStaff.username),
      name: sanitizeText(newStaff.name),
      pin: newStaff.pin || undefined
    });
    toast.success('Staff added');
    setNewStaff({ username: '', password: '', pin: '', name: '', role: 'counter' as 'admin' | 'counter' | 'waiter' | 'kitchen' });
    setStaffModal({ open: false, editing: null });
  };

  const handleUpdateStaff = () => {
    if (!staffModal.editing) return;

    // Validate name if changed
    const nameValidation = validateInput(staffNameSchema, staffModal.editing.name);
    if (!nameValidation.success) {
      toast.error(nameValidation.error);
      return;
    }

    // Validate password if changed
    if (staffModal.editing.password) {
      const passwordValidation = validateInput(passwordSchema, staffModal.editing.password);
      if (!passwordValidation.success) {
        toast.error(passwordValidation.error);
        return;
      }
    }

    updateStaff(staffModal.editing.id, {
      ...staffModal.editing,
      name: sanitizeText(staffModal.editing.name)
    });
    toast.success('Staff updated');
    setStaffModal({ open: false, editing: null });
  };

  const handleDeleteStaff = (id: string) => {
    if (staff.length <= 1) {
      toast.error('Cannot delete last staff member');
      return;
    }
    if (!confirm('Delete this staff member?')) return;
    deleteStaff(id);
    toast.success('Staff deleted');
  };

  const handleLogout = () => { 
    logout(); 
    navigate('/auth'); 
  };

  const exportCustomersCSV = () => {
    const headers = ['Phone', 'Name', 'Total Orders', 'Total Spent', 'Points', 'Last Visit'];
    const rows = filteredCustomers.map(c => [
      c.phone, c.name || '', c.totalOrders, c.totalSpent, c.points, c.lastVisit
    ]);
    downloadCSV([headers, ...rows], 'customers');
  };

  const exportHistoryCSV = () => {
    const headers = ['Date', 'Table', 'Customers', 'Items', 'Total', 'Discount', 'Method'];
    const rows = filteredTransactions.map(t => [
      formatNepalDateTime(t.paidAt),
      t.tableNumber,
      t.customerPhones.join('; '),
      t.items.map(i => `${i.qty}x ${i.name}`).join('; '),
      t.total,
      t.discount,
      t.paymentMethod
    ]);
    downloadCSV([headers, ...rows], 'transactions');
  };

  const exportAnalyticsCSV = () => {
    const headers = ['Date', 'Table', 'Customers', 'Items', 'Total', 'Discount', 'Method'];
    const rows = analytics.transactions.map(t => [
      formatNepalDateTime(t.paidAt),
      t.tableNumber,
      t.customerPhones.join('; '),
      t.items.map(i => `${i.qty}x ${i.name}`).join('; '),
      t.total,
      t.discount,
      t.paymentMethod
    ]);
    downloadCSV([headers, ...rows], `analytics_${analyticsDateFrom}_to_${analyticsDateTo}`);
  };

  const downloadCSV = (data: any[][], filename: string) => {
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadQR = (tableNum: number) => {
    const svg = document.getElementById(`qr-${tableNum}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.download = `table-${tableNum}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const printAllQR = () => {
    const wifiSSID = settings.wifiSSID || '';
    const wifiPassword = settings.wifiPassword || '';
    const baseUrl = settings.baseUrl || window.location.origin;
    
    // Generate QR codes offline using our bundled library
    const qrData = generatePrintQRData(
      settings.tableCount,
      baseUrl,
      wifiSSID || undefined,
      wifiPassword || undefined
    );

    toast.info('Opening print preview...');

    // Open print window with pre-generated QR codes (no external dependencies)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print QR codes');
      return;
    }

    // Build cards HTML with embedded SVG QR codes
    const cardsHTML = qrData.map(data => `
      <div class="card">
        <div class="wifi-section">
          <div class="wifi-label">📶 Free WiFi</div>
          ${data.wifiQR 
            ? `<div class="qr-container">${data.wifiQR}</div><div class="wifi-ssid">${wifiSSID}</div>` 
            : '<div class="no-wifi">No WiFi configured</div>'
          }
        </div>
        <div class="table-section">
          <div class="table-label">🍵 Table ${data.tableNum}</div>
          <div class="qr-container">${data.tableQR}</div>
          <div class="restaurant-name">${settings.restaurantName}</div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - ${settings.restaurantName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f9f9f9; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { color: #666; font-size: 14px; }
          .cards-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 15px; }
          .card { 
            page-break-inside: avoid; 
            text-align: center; 
            padding: 20px; 
            border: 1px solid #ddd; 
            border-radius: 12px; 
            background: #fff; 
            width: 220px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .wifi-section { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px dashed #ddd; }
          .wifi-label { font-size: 12px; font-weight: bold; color: #333; margin-bottom: 8px; }
          .wifi-ssid { font-size: 9px; color: #666; margin-top: 6px; }
          .table-label { font-size: 14px; font-weight: bold; color: #333; margin-bottom: 8px; }
          .restaurant-name { font-size: 10px; color: #666; margin-top: 8px; }
          .qr-container { width: 120px; height: 120px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
          .qr-container svg { width: 100%; height: 100%; }
          .no-wifi { width: 120px; height: 120px; background: #f5f5f5; margin: 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 10px; color: #999; }
          @media print { 
            body { padding: 10px; background: white; } 
            .card { box-shadow: none; border: 1px solid #ccc; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${settings.restaurantName}</h1>
          <p>Table QR Cards</p>
        </div>
        <div class="cards-grid">${cardsHTML}</div>
        <script>setTimeout(() => window.print(), 300);<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'history', label: 'History', icon: History },
    { id: 'staff', label: 'Staff', icon: UserCog },
    { id: 'qr', label: 'Tables & QR', icon: QrCode },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-sidebar text-sidebar-foreground p-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {settings.logo ? (
            <img src={settings.logo} alt={settings.restaurantName} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold">{settings.restaurantName?.charAt(0) || 'R'}</span>
            </div>
          )}
          <span className="font-serif font-bold">{settings.restaurantName}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="text-sidebar-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          {tab !== 'settings' && (
            <Button 
              variant="ghost" 
              size="icon"
              className="text-sidebar-foreground"
              onClick={() => navigate('/counter')}
              title="Go to Counter"
            >
              <MonitorDot className="w-5 h-5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon"
            className="text-sidebar-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 bg-sidebar z-40 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setTab(item.id); setMobileMenuOpen(false); }}
                className={`w-full nav-item ${tab === item.id ? 'nav-item-active' : 'nav-item-inactive'}`}
              >
                <item.icon className="w-5 h-5" /> {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-sidebar-border">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl" 
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-3" /> Logout
            </Button>
          </div>
        </div>
      )}

      {/* Sidebar - Premium Dark Theme (Desktop only) */}
      <aside className="hidden lg:flex w-72 sidebar flex-col sticky top-0 h-screen flex-shrink-0">
        <div className="sidebar-header">
          <div className="flex items-center gap-4">
            {settings.logo ? (
              <img src={settings.logo} alt={settings.restaurantName} className="w-12 h-12 rounded-2xl object-cover shadow-warm" />
            ) : (
              <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center shadow-warm">
                <span className="text-primary-foreground font-bold text-xl">{settings.restaurantName?.charAt(0) || 'R'}</span>
              </div>
            )}
            <div>
              <span className="font-serif font-bold text-lg text-sidebar-foreground">{settings.restaurantName}</span>
              <p className="text-xs text-sidebar-foreground/60">Admin Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="sidebar-content flex-1 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full nav-item ${tab === item.id ? 'nav-item-active' : 'nav-item-inactive'}`}
            >
              <item.icon className="w-5 h-5" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 mr-3" /> : <Moon className="w-4 h-4 mr-3" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-xl" 
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-3" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto flex flex-col min-w-0">
        <div className="flex-1">

        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div className="space-y-4 md:space-y-6">
            {/* Header with Counter button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg md:text-2xl font-bold">Dashboard</h2>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">{formatNepalDateTime(new Date())}</p>
              </div>
              <Button 
                variant="outline"
                className="hidden lg:flex items-center gap-2"
                onClick={() => navigate('/counter')}
              >
                <MonitorDot className="w-4 h-4" /> Counter
              </Button>
            </div>
            
            {/* Date Range Filter */}
            <div className="bg-card p-3 md:p-4 rounded-xl border border-border space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Date Range</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={dashboardDateFrom}
                  onChange={e => setDashboardDateFrom(e.target.value)}
                  className="w-full text-sm"
                />
                <Input
                  type="date"
                  value={dashboardDateTo}
                  onChange={e => setDashboardDateTo(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 min-w-[80px] text-xs md:text-sm"
                  onClick={() => {
                    const today = getNepalTodayString();
                    setDashboardDateFrom(today);
                    setDashboardDateTo(today);
                  }}
                >
                  Today
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 min-w-[80px] text-xs md:text-sm"
                  onClick={() => {
                    setDashboardDateFrom(getNepalDateDaysAgo(7));
                    setDashboardDateTo(getNepalTodayString());
                  }}
                >
                  7 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1 min-w-[80px] text-xs md:text-sm"
                  onClick={() => {
                    setDashboardDateFrom(getNepalDateDaysAgo(30));
                    setDashboardDateTo(getNepalTodayString());
                  }}
                >
                  30 Days
                </Button>
              </div>
            </div>

            {/* Subscription Status Card */}
            {subscriptionStatus && subscriptionStatus.expiresAt && (
              <div className={`p-4 rounded-xl border ${
                (subscriptionStatus.daysRemaining ?? 999) <= 3 
                  ? 'bg-destructive/10 border-destructive/30' 
                  : (subscriptionStatus.daysRemaining ?? 999) <= 7 
                    ? 'bg-warning/10 border-warning/30' 
                    : 'bg-primary/10 border-primary/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    (subscriptionStatus.daysRemaining ?? 999) <= 3 
                      ? 'bg-destructive/20' 
                      : (subscriptionStatus.daysRemaining ?? 999) <= 7 
                        ? 'bg-warning/20' 
                        : 'bg-primary/20'
                  }`}>
                    <Shield className={`w-5 h-5 ${
                      (subscriptionStatus.daysRemaining ?? 999) <= 3 
                        ? 'text-destructive' 
                        : (subscriptionStatus.daysRemaining ?? 999) <= 7 
                          ? 'text-warning' 
                          : 'text-primary'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {subscriptionStatus.isTrial ? 'Trial Period' : 'Active Subscription'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const expiresAt = new Date(subscriptionStatus.expiresAt);
                        const purchasedAt = new Date(expiresAt.getTime() - (subscriptionStatus.daysRemaining ?? 0) * 24 * 60 * 60 * 1000 - ((subscriptionStatus.isTrial ? 14 : 30) * 24 * 60 * 60 * 1000));
                        return `Started ${purchasedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • Valid until ${expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                      })()}
                    </p>
                  </div>
                  <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                    (subscriptionStatus.daysRemaining ?? 999) <= 3 
                      ? 'bg-destructive/20 text-destructive' 
                      : (subscriptionStatus.daysRemaining ?? 999) <= 7 
                        ? 'bg-warning/20 text-warning' 
                        : 'bg-success/20 text-success'
                  }`}>
                    {subscriptionStatus.plan === 'trial' ? 'Trial' : 'Active'}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              <StatCard icon={DollarSign} label="Total Revenue" value={`रू ${dashboardData.totalRevenue}`} color="primary" />
              <StatCard icon={ShoppingBag} label="Total Orders" value={dashboardData.totalOrders.toString()} color="success" />
              <StatCard icon={TrendingUp} label="Avg Order Value" value={`रू ${dashboardData.avgOrderValue}`} color="accent" />
              <StatCard icon={Users} label="Unique Customers" value={dashboardData.uniqueCustomers.toString()} color="warning" />
            </div>

            {/* Quick Charts - Now use dashboard date range */}
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4 text-sm md:text-base">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={dashboardData.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 9 }} width={45} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4 text-sm md:text-base">Top Selling Items</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dashboardData.topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={60} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Analytics */}
        {tab === 'analytics' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg md:text-2xl font-bold">Analytics & Reports</h2>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">{formatNepalDateTime(new Date())}</p>
              </div>
              <Button onClick={exportAnalyticsCSV} className="gradient-primary w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>

            <div className="bg-card p-3 md:p-4 rounded-xl border border-border space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Date Range</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={analyticsDateFrom}
                  onChange={e => setAnalyticsDateFrom(e.target.value)}
                  className="w-full text-sm"
                />
                <Input
                  type="date"
                  value={analyticsDateTo}
                  onChange={e => setAnalyticsDateTo(e.target.value)}
                  className="w-full text-sm"
                />
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
              <StatCard icon={DollarSign} label="Total Revenue" value={`रू ${analytics.totalRevenue}`} color="primary" />
              <StatCard icon={ShoppingBag} label="Total Orders" value={analytics.totalOrders.toString()} color="success" />
              <StatCard icon={TrendingUp} label="Avg Order Value" value={`रू ${analytics.avgOrderValue}`} color="accent" />
              <StatCard icon={Users} label="Unique Customers" value={analytics.uniqueCustomers.toString()} color="warning" />
            </div>

            {/* Payment Methods Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="p-4 md:p-6 bg-success/10 rounded-2xl border border-success/20">
                <div className="text-xs md:text-sm text-muted-foreground mb-1">Cash Payments</div>
                <div className="text-xl md:text-3xl font-bold text-success">
                  रू {analytics.cashTotal.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analytics.totalRevenue > 0 
                    ? `${((analytics.cashTotal / analytics.totalRevenue) * 100).toFixed(0)}% of total` 
                    : '0%'}
                </div>
              </div>
              <div className="p-4 md:p-6 bg-destructive/10 rounded-2xl border border-destructive/20">
                <div className="text-xs md:text-sm text-muted-foreground mb-1">Fonepay Payments</div>
                <div className="text-xl md:text-3xl font-bold text-destructive">
                  रू {analytics.fonepayTotal.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analytics.totalRevenue > 0 
                    ? `${((analytics.fonepayTotal / analytics.totalRevenue) * 100).toFixed(0)}% of total` 
                    : '0%'}
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4 text-sm md:text-base">Daily Revenue</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={analytics.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 9 }} width={45} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4 text-sm md:text-base">Payment Methods</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={analytics.paymentMethods} cx="50%" cy="50%" outerRadius={60} dataKey="value" label>
                      {analytics.paymentMethods.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4 text-sm md:text-base">Top 10 Items by Quantity</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={70} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4 text-sm md:text-base">Peak Hours</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.peakHours.filter(h => h.orders > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="hsl(var(--success))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Menu */}
        {tab === 'menu' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-bold">Menu Management</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCategoryManager(true)}>
                  <Settings className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Categories</span>
                </Button>
                <Button onClick={() => setIsAddingItem(true)} size="sm" className="gradient-primary">
                  <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline">Add Item</span>
                </Button>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedMenuItems.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center mb-4 p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">{selectedMenuItems.length} selected</span>
                <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)}>
                  <ToggleRight className="w-4 h-4 mr-1" /> Enable
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)}>
                  <ToggleLeft className="w-4 h-4 mr-1" /> Disable
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMenuItems([])}>
                  Clear
                </Button>
              </div>
            )}
            
            {/* Search */}
            <div className="mb-4 md:mb-6">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  className="pl-10 w-full md:max-w-md"
                />
              </div>
            </div>

            {categories.map(cat => {
              const catItems = filteredMenuItems.filter(m => m.category === cat.name);
              if (catItems.length === 0 && menuSearch) return null;
              
              const allCatItems = menuItems.filter(m => m.category === cat.name);
              const allSelected = allCatItems.length > 0 && allCatItems.every(m => selectedMenuItems.includes(m.id));
              
              return (
                <div key={cat.id} className="mb-6 md:mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => selectAllInCategory(cat.name)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <h3 className="font-bold text-base md:text-lg text-primary">{cat.name}</h3>
                    <span className="text-xs md:text-sm text-muted-foreground">({catItems.length} items)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {(menuSearch ? catItems : allCatItems).map(item => (
                      <div 
                        key={item.id} 
                        className={`bg-card rounded-xl border border-border p-3 md:p-4 transition-all ${!item.available ? 'opacity-50' : ''} ${selectedMenuItems.includes(item.id) ? 'ring-2 ring-primary' : ''}`}
                      >
                        <div className="flex gap-3">
                          <input
                            type="checkbox"
                            checked={selectedMenuItems.includes(item.id)}
                            onChange={() => toggleSelectItem(item.id)}
                            className="w-4 h-4 mt-1 rounded border-border accent-primary"
                          />
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.name} 
                              className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate text-sm md:text-base">{item.name}</h4>
                            <p className="text-primary font-bold text-sm md:text-base">रू {item.price}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1 hidden sm:block">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border">
                          <button 
                            onClick={() => toggleItemAvailability(item.id)} 
                            className={`text-xs md:text-sm px-2 py-1 rounded ${item.available ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
                          >
                            {item.available ? 'Available' : 'Unavailable'}
                          </button>
                          <button onClick={() => setEditingItem(item)}>
                            <Edit className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button onClick={() => { deleteMenuItem(item.id); toast.success('Deleted'); }}>
                            <Trash2 className="w-4 h-4 text-destructive hover:text-destructive/80" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Customers */}
        {tab === 'customers' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-bold">Customers</h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search phone or name..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="pl-10 w-full sm:w-64"
                  />
                </div>
                <Button onClick={exportCustomersCSV} variant="outline" className="w-full sm:w-auto">
                  <Download className="w-4 h-4 mr-2" /> Export
                </Button>
              </div>
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-border">No customers found</div>
              ) : filteredCustomers.map(c => (
                <div key={c.phone} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm">{c.phone}</p>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 w-6 p-0"
                        onClick={() => setEditingCustomerPhone({ originalPhone: c.phone, newPhone: c.phone })}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                    <span className="bg-warning/10 text-warning px-2 py-1 rounded-full text-xs">
                      ⭐ {c.points}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-muted-foreground">Orders</p>
                      <p className="font-bold">{c.totalOrders}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-muted-foreground">Spent</p>
                      <p className="font-bold text-primary">रू {c.totalSpent}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-2">
                      <p className="text-muted-foreground">Last Visit</p>
                      <p className="font-bold">{formatNepalDateReadable(c.lastVisit).split(',')[0]}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setCustomerDetailModal(c)}>
                    <Eye className="w-4 h-4 mr-2" /> View Details
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-4">Phone</th>
                      <th className="text-left p-4">Orders</th>
                      <th className="text-left p-4">Total Spent</th>
                      <th className="text-left p-4">Points</th>
                      <th className="text-left p-4">Last Visit</th>
                      <th className="text-left p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No customers found</td></tr>
                    ) : filteredCustomers.map(c => (
                      <tr key={c.phone} className="border-t border-border hover:bg-muted/50">
                        <td className="p-4 font-mono">
                          <div className="flex items-center gap-2">
                            {c.phone}
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0"
                              onClick={() => setEditingCustomerPhone({ originalPhone: c.phone, newPhone: c.phone })}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-4">{c.totalOrders}</td>
                        <td className="p-4 font-bold">रू {c.totalSpent}</td>
                        <td className="p-4">
                          <span className="bg-warning/10 text-warning px-2 py-1 rounded-full text-sm">
                            ⭐ {c.points}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">{formatNepalDateReadable(c.lastVisit)}</td>
                        <td className="p-4">
                          <Button size="sm" variant="ghost" onClick={() => setCustomerDetailModal(c)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-lg md:text-2xl font-bold">History</h2>
              <Button onClick={exportHistoryCSV} variant="outline" size="sm" className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Export
              </Button>
            </div>

            {/* History Tabs */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={historyTab === 'transactions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHistoryTab('transactions')}
                className={historyTab === 'transactions' ? 'gradient-primary' : ''}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Transactions ({filteredTransactions.length})
              </Button>
              <Button
                variant={historyTab === 'expenses' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHistoryTab('expenses')}
                className={historyTab === 'expenses' ? 'gradient-primary' : ''}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Expenses ({filteredExpenses.length})
              </Button>
            </div>
            
            {/* Filters */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={historyTab === 'transactions' ? "Search table or phone..." : "Search description or category..."}
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="date"
                  value={historyDateFrom}
                  onChange={e => setHistoryDateFrom(e.target.value)}
                  className="flex-1 min-w-[130px]"
                />
                <Input
                  type="date"
                  value={historyDateTo}
                  onChange={e => setHistoryDateTo(e.target.value)}
                  className="flex-1 min-w-[130px]"
                />
                <Button variant="outline" size="sm" onClick={() => { setHistorySearch(''); setHistoryDateFrom(''); setHistoryDateTo(''); }}>
                  Clear
                </Button>
              </div>
            </div>

            {/* Transactions View */}
            {historyTab === 'transactions' && (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-border">No transactions found</div>
                  ) : filteredTransactions.slice(0, 50).map(t => (
                    <div key={t.id} className="bg-card rounded-xl border border-border p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold">Table {t.tableNumber}</p>
                          <p className="text-xs text-muted-foreground">{formatNepalDateTime(t.paidAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">रू {t.total}</p>
                          <span className={`text-xs px-2 py-0.5 rounded ${t.paymentMethod === 'cash' ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'}`}>
                            {t.paymentMethod.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {t.customerPhones.length > 0 ? t.customerPhones.join(', ') : 'Guest'}
                      </div>
                      <div className="text-sm bg-muted rounded-lg p-2">
                        <p className="line-clamp-2">{t.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</p>
                      </div>
                      {t.discount > 0 && (
                        <p className="text-xs text-destructive mt-2">Discount: -रू{t.discount}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-4">Time</th>
                          <th className="text-left p-4">Table</th>
                          <th className="text-left p-4">Customers</th>
                          <th className="text-left p-4">Items</th>
                          <th className="text-left p-4">Discount</th>
                          <th className="text-left p-4">Total</th>
                          <th className="text-left p-4">Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No transactions found</td></tr>
                        ) : filteredTransactions.slice(0, 50).map(t => (
                          <tr key={t.id} className="border-t border-border hover:bg-muted/50">
                            <td className="p-4">{formatNepalDateTime(t.paidAt)}</td>
                            <td className="p-4">Table {t.tableNumber}</td>
                            <td className="p-4">{t.customerPhones.join(', ') || 'Guest'}</td>
                            <td className="p-4 text-sm max-w-xs truncate">{t.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                            <td className="p-4">{t.discount > 0 ? `-रू${t.discount}` : '-'}</td>
                            <td className="p-4 font-bold">रू {t.total}</td>
                            <td className="p-4">{t.paymentMethod.toUpperCase()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Expenses View */}
            {historyTab === 'expenses' && (
              <>
                {/* Total Expenses Summary */}
                <div className="bg-card rounded-xl border border-border p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Expenses</span>
                    <span className="text-xl font-bold text-destructive">
                      रू {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {filteredExpenses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-card rounded-xl border border-border">No expenses found</div>
                  ) : filteredExpenses.slice(0, 50).map(e => (
                    <div key={e.id} className="bg-card rounded-xl border border-border p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold">{e.description}</p>
                          <p className="text-xs text-muted-foreground">{formatNepalDateTime(e.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-destructive">-रू {e.amount}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          e.category === 'ingredients' ? 'bg-success/10 text-success' :
                          e.category === 'utilities' ? 'bg-primary/10 text-primary' :
                          e.category === 'salary' ? 'bg-warning/10 text-warning' :
                          e.category === 'maintenance' ? 'bg-accent text-accent-foreground' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {e.category.charAt(0).toUpperCase() + e.category.slice(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">by {e.createdBy}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left p-4">Time</th>
                          <th className="text-left p-4">Description</th>
                          <th className="text-left p-4">Category</th>
                          <th className="text-left p-4">Created By</th>
                          <th className="text-left p-4">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredExpenses.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No expenses found</td></tr>
                        ) : filteredExpenses.slice(0, 50).map(e => (
                          <tr key={e.id} className="border-t border-border hover:bg-muted/50">
                            <td className="p-4">{formatNepalDateTime(e.createdAt)}</td>
                            <td className="p-4">{e.description}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                e.category === 'ingredients' ? 'bg-success/10 text-success' :
                                e.category === 'utilities' ? 'bg-primary/10 text-primary' :
                                e.category === 'salary' ? 'bg-warning/10 text-warning' :
                                e.category === 'maintenance' ? 'bg-accent text-accent-foreground' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {e.category.charAt(0).toUpperCase() + e.category.slice(1)}
                              </span>
                            </td>
                            <td className="p-4 text-sm">{e.createdBy}</td>
                            <td className="p-4 font-bold text-destructive">-रू {e.amount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Staff */}
        {tab === 'staff' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-bold">Staff Management</h2>
              <Button onClick={() => setStaffModal({ open: true, editing: null })} className="gradient-primary w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" /> Add Staff
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {staff.map(s => (
                <div key={s.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold">{s.name}</h4>
                      <p className="text-sm text-muted-foreground">@{s.username}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      s.role === 'admin' ? 'bg-primary/10 text-primary' : 
                      s.role === 'waiter' ? 'bg-warning/10 text-warning' :
                      s.role === 'kitchen' ? 'bg-success/10 text-success' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {s.role.toUpperCase()}
                    </span>
                    {s.pin && (
                      <span className="text-xs text-muted-foreground ml-1" title="Has PIN">🔑</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Created: {formatNepalDateReadable(s.createdAt)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setStaffModal({ open: true, editing: s })}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteStaff(s.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QR */}
        {tab === 'qr' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 md:mb-6">
              <h2 className="text-lg md:text-2xl font-bold">Tables & QR Codes</h2>
              <Button onClick={printAllQR} className="gradient-primary w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Print All QR
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4" ref={qrRef}>
              {Array.from({ length: settings.tableCount }, (_, i) => i + 1).map(num => (
                <div key={num} className="bg-card rounded-xl border border-border p-3 md:p-4 text-center">
                  <p className="font-bold text-base md:text-lg mb-2">Table {num}</p>
                  <div className="bg-white p-1 md:p-2 rounded-lg inline-block mb-2">
                    <QRCodeSVG
                      id={`qr-${num}`}
                      value={`${settings.baseUrl || window.location.origin}/table/${num}`}
                      size={80}
                      level="M"
                      className="md:w-[120px] md:h-[120px]"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 truncate">{settings.restaurantName}</p>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => downloadQR(num)}>
                    <Download className="w-3 h-3 mr-1" /> Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="max-w-6xl">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* General Settings */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    General Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Restaurant Name</label>
                      <Input value={settings.restaurantName || ''} onChange={e => updateSettings({ restaurantName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Sub Name (optional)</label>
                      <Input 
                        value={settings.restaurantSubName || ''} 
                        onChange={e => updateSettings({ restaurantSubName: e.target.value })} 
                        placeholder="e.g., Digital Menu, Restaurant, Cafe"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Displayed after restaurant name in installed apps</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Table Count</label>
                      <Input type="number" value={settings.tableCount || 10} onChange={e => updateSettings({ tableCount: parseInt(e.target.value) || 10 })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Base URL (for QR codes)</label>
                      <div className="flex gap-2">
                        <Input 
                          value={settings.baseUrl || ''} 
                          onChange={e => updateSettings({ baseUrl: e.target.value })}
                          placeholder={window.location.origin} 
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const hostname = window.location.hostname;
                            const port = window.location.port;
                            const protocol = window.location.protocol;
                            
                            if (hostname.endsWith('.local') || hostname.includes('.')) {
                              const url = `${protocol}//${hostname}${port ? ':' + port : ''}`;
                              updateSettings({ baseUrl: url });
                              toast.success('Base URL set to: ' + url);
                            } else {
                              const computerName = prompt(
                                'Enter your computer hostname (found in System Settings):\n\n' +
                                'Windows: Settings → System → About → Device name\n' +
                                'Mac: System Preferences → Sharing → Computer Name\n' +
                                'Linux: Run "hostname" in terminal\n\n' +
                                'Example: my-laptop'
                              );
                              if (computerName) {
                                const localUrl = `${protocol}//${computerName.toLowerCase().replace(/\s+/g, '-')}.local${port ? ':' + port : ''}`;
                                updateSettings({ baseUrl: localUrl });
                                toast.success('Base URL set to: ' + localUrl);
                              }
                            }
                          }}
                        >
                          Use Hostname
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use hostname.local instead of IP to avoid issues when IP changes.
                      </p>
                    </div>
                    
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium">Counter as Admin Mode</label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Counter staff can access all admin features.
                          </p>
                        </div>
                        <Switch
                          checked={settings.counterAsAdmin || false}
                          onCheckedChange={async (checked) => {
                            try {
                              await updateSettings({ counterAsAdmin: checked });
                              toast.success(checked ? 'Counter staff now have admin access' : 'Counter staff have standard access');
                            } catch (err) {
                              toast.error('Failed to save setting');
                            }
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Counter Kitchen Access */}
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium">Kitchen Access for Counter</label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Counter staff can access Kitchen page with same login.
                          </p>
                        </div>
                        <Switch
                          checked={settings.counterKitchenAccess || false}
                          onCheckedChange={async (checked) => {
                            try {
                              await updateSettings({ counterKitchenAccess: checked });
                              toast.success(checked ? 'Counter can now access Kitchen' : 'Kitchen access removed for Counter');
                            } catch (err) {
                              toast.error('Failed to save setting');
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Counter KOT Printing */}
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium">Counter KOT Printing</label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Print KOT when Counter accepts orders.
                          </p>
                        </div>
                        <Switch
                          checked={settings.counterKotEnabled || false}
                          onCheckedChange={async (checked) => {
                            try {
                              await updateSettings({ counterKotEnabled: checked });
                              toast.success(checked ? 'Counter KOT printing enabled' : 'Counter KOT printing disabled');
                            } catch (err) {
                              toast.error('Failed to save setting');
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Restaurant Logo */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-primary" />
                    Restaurant Logo
                  </h3>
                  <div className="flex gap-4 items-center">
                    {settings.logo ? (
                      <img src={settings.logo} alt="Logo" className="w-20 h-20 rounded-xl object-cover border-2 border-border" />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          // Compress and resize image
                          const img = new Image();
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          
                          img.onload = () => {
                            // Max dimensions
                            const maxSize = 200;
                            let { width, height } = img;
                            
                            if (width > height) {
                              if (width > maxSize) {
                                height = (height * maxSize) / width;
                                width = maxSize;
                              }
                            } else {
                              if (height > maxSize) {
                                width = (width * maxSize) / height;
                                height = maxSize;
                              }
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            ctx?.drawImage(img, 0, 0, width, height);
                            
                            // Compress to JPEG with 0.7 quality
                            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            updateSettings({ logo: compressedDataUrl });
                            toast.success('Logo uploaded successfully');
                          };
                          
                          img.onerror = () => {
                            toast.error('Failed to load image');
                          };
                          
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            img.src = event.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">Auto-resized to 200px. Used on customer page.</p>
                      {settings.logo && (
                        <Button variant="ghost" size="sm" onClick={() => updateSettings({ logo: undefined })}>
                          <Trash2 className="w-4 h-4 mr-1" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* WiFi Credentials */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    WiFi Credentials
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">WiFi SSID</label>
                      <Input value={settings.wifiSSID || ''} onChange={e => updateSettings({ wifiSSID: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">WiFi Password</label>
                      <Input value={settings.wifiPassword || ''} onChange={e => updateSettings({ wifiPassword: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Theme & Sound Settings */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Theme & Sound
                  </h3>
                  <div className="space-y-4">
                    {/* Dark Mode */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Dark Mode</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enable dark theme for low-light environments.
                        </p>
                      </div>
                      <Select 
                        value={settings.theme || 'light'} 
                        onValueChange={(value: 'light' | 'dark' | 'system') => {
                          updateSettings({ theme: value });
                          document.documentElement.classList.remove('light', 'dark');
                          if (value === 'system') {
                            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                            document.documentElement.classList.add(isDark ? 'dark' : 'light');
                          } else {
                            document.documentElement.classList.add(value);
                          }
                          toast.success(`Theme set to ${value}`);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Sound Alerts */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div>
                        <label className="text-sm font-medium">Sound Alerts</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Play sounds for new orders and waiter calls.
                        </p>
                      </div>
                      <Switch
                        checked={settings.soundAlertsEnabled !== false}
                        onCheckedChange={(checked) => {
                          updateSettings({ soundAlertsEnabled: checked });
                          toast.success(checked ? 'Sound alerts enabled' : 'Sound alerts disabled');
                        }}
                      />
                    </div>
                  </div>
                </div>

               
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Kitchen Display System Settings */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-warning" />
                    Kitchen Display System
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium">Enable KDS</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Kitchen can view and manage orders on their display.
                        </p>
                      </div>
                      <Switch
                        checked={settings.kdsEnabled || false}
                        onCheckedChange={async (checked) => {
                          try {
                            await updateSettings({ kdsEnabled: checked });
                            toast.success(checked ? 'Kitchen Display enabled' : 'Kitchen Display disabled');
                          } catch (err) {
                            toast.error('Failed to save KDS setting. Please ensure your database is updated.');
                          }
                        }}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div>
                        <label className="text-sm font-medium">KOT Printing</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Auto-print Kitchen Order Tickets for waiter orders.
                        </p>
                      </div>
                      <Switch
                        checked={settings.kotPrintingEnabled || false}
                        onCheckedChange={async (checked) => {
                          try {
                            await updateSettings({ kotPrintingEnabled: checked });
                            toast.success(checked ? 'KOT printing enabled' : 'KOT printing disabled');
                          } catch (err) {
                            toast.error('Failed to save KOT setting. Please ensure your database is updated.');
                          }
                        }}
                      />
                    </div>

                    {/* Kitchen Fullscreen Mode */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div>
                        <label className="text-sm font-medium">Kitchen Fullscreen Mode</label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Larger fonts & simplified layout for wall displays.
                        </p>
                      </div>
                      <Switch
                        checked={settings.kitchenFullscreenMode || false}
                        onCheckedChange={async (checked) => {
                          try {
                            await updateSettings({ kitchenFullscreenMode: checked });
                            toast.success(checked ? 'Fullscreen mode enabled' : 'Fullscreen mode disabled');
                          } catch (err) {
                            toast.error('Failed to save fullscreen setting. Please ensure your database is updated.');
                          }
                        }}
                      />
                    </div>

                    <div className="pt-4 border-t border-border">
                      <label className="text-sm font-medium">Kitchen Handles (Parallel Orders)</label>
                      <Input 
                        type="number" 
                        min="1"
                        max="10"
                        value={settings.kitchenHandles || 3} 
                        onChange={e => updateSettings({ kitchenHandles: parseInt(e.target.value) || 3 })} 
                        placeholder="3"
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Number of orders the kitchen can prepare simultaneously.
                      </p>
                    </div>
                  </div>
                </div>
                {/* Loyalty Point System */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-warning" />
                    Loyalty Point System
                  </h3>
                  
                  {/* Enable/Disable Toggle */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                    <div>
                      <label className="text-sm font-medium">Enable Point System</label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Customers earn points on purchases and redeem for discounts.
                      </p>
                    </div>
                    <Switch
                      checked={settings.pointSystemEnabled || false}
                      onCheckedChange={async (checked) => {
                        try {
                          await updateSettings({ pointSystemEnabled: checked });
                          toast.success(checked ? 'Point system enabled' : 'Point system disabled');
                        } catch {
                          toast.error('Failed to save setting. Please try again.');
                        }
                      }}
                    />
                  </div>
                   {/* Social Media Links */}
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Social Media Links
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">Only links that are filled will be shown to customers.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Instagram URL</label>
                      <Input 
                        value={settings.instagramUrl || ''} 
                        onChange={e => updateSettings({ instagramUrl: e.target.value })} 
                        placeholder="https://instagram.com/yourhandle"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Facebook URL</label>
                      <Input 
                        value={settings.facebookUrl || ''} 
                        onChange={e => updateSettings({ facebookUrl: e.target.value })} 
                        placeholder="https://facebook.com/yourpage"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">TikTok URL</label>
                      <Input 
                        value={settings.tiktokUrl || ''} 
                        onChange={e => updateSettings({ tiktokUrl: e.target.value })} 
                        placeholder="https://tiktok.com/@yourhandle"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Google Review URL</label>
                      <Input 
                        value={settings.googleReviewUrl || ''} 
                        onChange={e => updateSettings({ googleReviewUrl: e.target.value })} 
                        placeholder="https://g.page/r/your-review-link"
                      />
                    </div>
                  </div>
                </div>
                  
                  {/* Point System Configuration - Only shown when enabled */}
                  {settings.pointSystemEnabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Points per रू100 spent</label>
                          <Input 
                            type="number" 
                            min="0"
                            value={settings.pointsPerRupee !== undefined ? settings.pointsPerRupee * 100 : 10} 
                            onChange={e => updateSettings({ pointsPerRupee: (parseFloat(e.target.value) || 10) / 100 })} 
                            placeholder="10"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            E.g., 10 means customer earns 10 points per रू100
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">1 Point = रू</label>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.1"
                            value={settings.pointValueInRupees || 1} 
                            onChange={e => updateSettings({ pointValueInRupees: parseFloat(e.target.value) || 1 })} 
                            placeholder="1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            How much 1 point is worth in rupees
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Max Discount (रू)</label>
                          <Input 
                            type="number" 
                            min="0"
                            value={settings.maxDiscountRupees || ''} 
                            onChange={e => updateSettings({ maxDiscountRupees: parseFloat(e.target.value) || undefined })} 
                            placeholder="No limit"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Maximum discount in rupees. Leave empty for no limit.
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Max Points per Order</label>
                          <Input 
                            type="number" 
                            min="0"
                            value={settings.maxDiscountPoints || ''} 
                            onChange={e => updateSettings({ maxDiscountPoints: parseFloat(e.target.value) || undefined })} 
                            placeholder="No limit"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Max points redeemable per order. Leave empty for no limit.
                          </p>
                        </div>
                      </div>
                      
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
        
        {/* Copyright Footer */}
        <footer className="mt-auto pt-8 pb-4 text-center border-t border-border">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {settings.restaurantName}. Developed by{' '}
            <a href="https://khagesh.com.np" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Khagesh
            </a>
          </p>
        </footer>
      </main>

      {/* Add Item Modal */}
      <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Menu Item</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Item name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            <Input placeholder="Price" type="number" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
            <Select value={newItem.category} onValueChange={(v: string) => setNewItem({ ...newItem, category: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea 
                placeholder="Brief description of the item..."
                value={newItem.description}
                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Image</label>
              <div className="flex gap-3 items-center">
                {newItem.image ? (
                  <OptimizedImage 
                    src={newItem.image} 
                    alt="Preview" 
                    className="w-16 h-16 rounded-lg"
                    size="thumbnail"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageUpload(e, false)}
                    className="text-sm"
                    disabled={isUploadingImage}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isUploadingImage ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Uploading to CDN...
                      </span>
                    ) : (
                      <>Max 5MB, auto-compressed to WebP</>
                    )}
                  </p>
                </div>
                {newItem.image && !isUploadingImage && (
                  <Button variant="ghost" size="sm" onClick={() => setNewItem({ ...newItem, image: '' })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddingItem(false); setNewItem({ name: '', price: '', category: '', description: '', image: '' }); }}>Cancel</Button>
            <Button onClick={handleAddItem} className="gradient-primary">Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <Input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
              <Input type="number" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })} />
              <Select value={editingItem.category} onValueChange={(v: string) => setEditingItem({ ...editingItem, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea 
                  placeholder="Brief description of the item..."
                  value={editingItem.description || ''}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Image</label>
                <div className="flex gap-3 items-center">
                  {editingItem.image ? (
                    <OptimizedImage 
                      src={editingItem.image} 
                      alt="Preview" 
                      className="w-16 h-16 rounded-lg"
                      size="thumbnail"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleImageUpload(e, true)}
                      className="text-sm"
                      disabled={isUploadingImage}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {isUploadingImage ? (
                        <span className="flex items-center gap-1 text-primary">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Uploading to CDN...
                        </span>
                      ) : (
                        <>Max 5MB, auto-compressed to WebP</>
                      )}
                    </p>
                  </div>
                  {editingItem.image && !isUploadingImage && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingItem({ ...editingItem, image: undefined })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Available</label>
                <Switch 
                  checked={editingItem.available} 
                  onCheckedChange={(checked) => setEditingItem({ ...editingItem, available: checked })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={handleUpdateItem} className="gradient-primary">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Manager Modal */}
      <Dialog open={showCategoryManager} onOpenChange={setShowCategoryManager}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage Categories</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {/* Add new category */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input 
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="flex-1"
                />
                <Input 
                  type="number"
                  placeholder="Prep time"
                  value={newCategoryPrepTime}
                  onChange={e => setNewCategoryPrepTime(e.target.value)}
                  className="w-20"
                  min="1"
                  max="60"
                />
                <Button 
                  onClick={() => {
                    if (newCategoryName.trim()) {
                      addCategory(newCategoryName.trim(), parseInt(newCategoryPrepTime) || 5);
                      setNewCategoryName('');
                      setNewCategoryPrepTime('5');
                      toast.success('Category added');
                    }
                  }}
                  disabled={!newCategoryName.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Prep time is in minutes (used for wait time estimation)
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              <GripVertical className="w-3 h-3 inline mr-1" />
              Drag and drop to reorder categories. Order affects how they appear to customers.
            </p>
            
            {/* Category list - sorted by sortOrder */}
            <div className="space-y-2 max-h-64 overflow-y-auto category-list-container">
              {categories.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No categories yet. Add one above.</p>
              ) : (
                [...categories].sort((a, b) => a.sortOrder - b.sortOrder).map((cat, index) => (
                  <div 
                    key={cat.id} 
                    className="flex items-center gap-2 p-2 bg-muted rounded-lg transition-all touch-none"
                    draggable={editingCategory?.id !== cat.id}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(index));
                      (e.currentTarget as HTMLElement).classList.add('opacity-50');
                    }}
                    onDragEnd={(e) => {
                      (e.currentTarget as HTMLElement).classList.remove('opacity-50');
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      (e.currentTarget as HTMLElement).classList.add('ring-2', 'ring-primary');
                    }}
                    onDragLeave={(e) => {
                      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-primary');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).classList.remove('ring-2', 'ring-primary');
                      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (fromIndex !== index) {
                        reorderCategories(fromIndex, index);
                        toast.success('Category reordered');
                      }
                    }}
                    onTouchStart={(e) => {
                      if (editingCategory?.id === cat.id) return;
                      const element = e.currentTarget as HTMLElement;
                      element.dataset.dragIndex = String(index);
                      element.classList.add('opacity-50');
                      element.style.transform = 'scale(1.02)';
                    }}
                    onTouchMove={(e) => {
                      if (editingCategory?.id === cat.id) return;
                      e.preventDefault();
                      const touch = e.touches[0];
                      const container = document.querySelector('.category-list-container');
                      if (!container) return;
                      
                      const items = Array.from(container.children) as HTMLElement[];
                      items.forEach((item, i) => {
                        const rect = item.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        if (touch.clientY > rect.top && touch.clientY < rect.bottom) {
                          item.dataset.dropTarget = 'true';
                          item.classList.add('ring-2', 'ring-primary');
                        } else {
                          item.dataset.dropTarget = '';
                          item.classList.remove('ring-2', 'ring-primary');
                        }
                      });
                    }}
                    onTouchEnd={(e) => {
                      if (editingCategory?.id === cat.id) return;
                      const element = e.currentTarget as HTMLElement;
                      element.classList.remove('opacity-50');
                      element.style.transform = '';
                      
                      const container = document.querySelector('.category-list-container');
                      if (!container) return;
                      
                      const items = Array.from(container.children) as HTMLElement[];
                      const fromIndex = index;
                      let toIndex = -1;
                      
                      items.forEach((item, i) => {
                        if (item.dataset.dropTarget === 'true') {
                          toIndex = i;
                        }
                        item.dataset.dropTarget = '';
                        item.classList.remove('ring-2', 'ring-primary');
                      });
                      
                      if (toIndex !== -1 && fromIndex !== toIndex) {
                        reorderCategories(fromIndex, toIndex);
                        toast.success('Category reordered');
                      }
                    }}
                  >
                    {editingCategory?.id === cat.id ? (
                      <>
                        <Input 
                          value={editingCategory.name}
                          onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editingCategory.name.trim()) {
                              updateCategory(cat.id, editingCategory.name.trim(), editingCategory.prepTime);
                              setEditingCategory(null);
                              toast.success('Category updated');
                            } else if (e.key === 'Escape') {
                              setEditingCategory(null);
                            }
                          }}
                          autoFocus
                          className="flex-1"
                          placeholder="Category name"
                        />
                        <Input 
                          type="number"
                          value={editingCategory.prepTime || 5}
                          onChange={e => setEditingCategory({ ...editingCategory, prepTime: parseInt(e.target.value) || 5 })}
                          className="w-16"
                          min="1"
                          max="60"
                          placeholder="min"
                        />
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (editingCategory.name.trim()) {
                            updateCategory(cat.id, editingCategory.name.trim(), editingCategory.prepTime);
                            setEditingCategory(null);
                            toast.success('Category updated');
                          }
                        }}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCategory(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        {/* Drag handle */}
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                        
                        <span className="flex-1 font-medium">{cat.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {cat.prepTime || 5}m
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {menuItems.filter(m => m.category === cat.name).length} items
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCategory({ id: cat.id, name: cat.name, prepTime: cat.prepTime || 5 })}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            const itemCount = menuItems.filter(m => m.category === cat.name).length;
                            if (itemCount > 0) {
                              toast.error(`Cannot delete: ${itemCount} items use this category`);
                              return;
                            }
                            if (confirm(`Delete category "${cat.name}"?`)) {
                              deleteCategory(cat.id);
                              toast.success('Category deleted');
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCategoryManager(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Detail Modal */}
      <Dialog open={!!customerDetailModal} onOpenChange={() => setCustomerDetailModal(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Customer Details</DialogTitle></DialogHeader>
          {customerDetailModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{customerDetailModal.phone}</p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setEditingCustomerPhone({ originalPhone: customerDetailModal.phone, newPhone: customerDetailModal.phone });
                        setCustomerDetailModal(null);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Loyalty Points</p>
                  <p className="font-bold text-warning">⭐ {customerDetailModal.points}</p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="font-bold">{customerDetailModal.totalOrders}</p>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="font-bold text-primary">रू {customerDetailModal.totalSpent}</p>
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Last Visit</p>
                <p className="font-bold">{formatNepalDateTime(customerDetailModal.lastVisit)}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Loyalty Tier</p>
                <p className="font-bold">
                  {customerDetailModal.totalSpent >= 10000 ? '🥇 Gold' : 
                   customerDetailModal.totalSpent >= 5000 ? '🥈 Silver' : 
                   customerDetailModal.totalSpent >= 1000 ? '🥉 Bronze' : '⭐ Regular'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Customer Phone Modal */}
      <Dialog open={!!editingCustomerPhone} onOpenChange={() => setEditingCustomerPhone(null)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
          <DialogHeader><DialogTitle>Edit Phone Number</DialogTitle></DialogHeader>
          {editingCustomerPhone && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Current: {editingCustomerPhone.originalPhone}</p>
                <Input 
                  placeholder="New phone number" 
                  value={editingCustomerPhone.newPhone} 
                  onChange={e => setEditingCustomerPhone({ ...editingCustomerPhone, newPhone: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingCustomerPhone(null)}>Cancel</Button>
                <Button 
                  onClick={async () => {
                    if (!editingCustomerPhone.newPhone.trim()) {
                      toast.error('Phone number is required');
                      return;
                    }
                    if (editingCustomerPhone.newPhone === editingCustomerPhone.originalPhone) {
                      setEditingCustomerPhone(null);
                      return;
                    }
                    try {
                      await updateCustomerPhone(editingCustomerPhone.originalPhone, editingCustomerPhone.newPhone);
                      toast.success('Phone number updated');
                      setEditingCustomerPhone(null);
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to update phone number');
                    }
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Staff Modal */}
      <Dialog open={staffModal.open} onOpenChange={(open) => !open && setStaffModal({ open: false, editing: null })}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{staffModal.editing ? 'Edit Staff' : 'Add Staff'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {staffModal.editing ? (
              <>
                <Input 
                  placeholder="Name" 
                  value={staffModal.editing.name} 
                  onChange={e => setStaffModal({ ...staffModal, editing: { ...staffModal.editing!, name: e.target.value }})} 
                />
                <Input 
                  placeholder="Username" 
                  value={staffModal.editing.username} 
                  onChange={e => setStaffModal({ ...staffModal, editing: { ...staffModal.editing!, username: e.target.value }})} 
                />
                <Input 
                  placeholder="New Password (leave empty to keep)" 
                  type="password"
                  onChange={e => e.target.value && setStaffModal({ ...staffModal, editing: { ...staffModal.editing!, password: e.target.value }})} 
                />
                <Input 
                  placeholder="PIN (4-6 digits for quick actions)" 
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={staffModal.editing.pin || ''}
                  onChange={e => setStaffModal({ ...staffModal, editing: { ...staffModal.editing!, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }})} 
                />
                <Select 
                  value={staffModal.editing.role} 
                  onValueChange={(v: 'admin' | 'counter' | 'waiter' | 'kitchen') => setStaffModal({ ...staffModal, editing: { ...staffModal.editing!, role: v }})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="counter">Counter</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                  </SelectContent>
                </Select>
                {(staffModal.editing.role === 'waiter' || staffModal.editing.role === 'kitchen') && (
                  <p className="text-xs text-muted-foreground">
                    💡 {staffModal.editing.role === 'waiter' ? 'Waiters use PIN for quick login on /waiter page' : 'Kitchen staff can view /kitchen page'}
                  </p>
                )}
              </>
            ) : (
              <>
                <Input placeholder="Name" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} />
                <Input placeholder="Username" value={newStaff.username} onChange={e => setNewStaff({ ...newStaff, username: e.target.value })} />
                <Input placeholder="Password" type="password" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} />
                <Input 
                  placeholder="PIN (4-6 digits for quick actions)" 
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={newStaff.pin}
                  onChange={e => setNewStaff({ ...newStaff, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} 
                />
                <Select value={newStaff.role} onValueChange={(v: 'admin' | 'counter' | 'waiter' | 'kitchen') => setNewStaff({ ...newStaff, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="counter">Counter</SelectItem>
                    <SelectItem value="waiter">Waiter</SelectItem>
                    <SelectItem value="kitchen">Kitchen</SelectItem>
                  </SelectContent>
                </Select>
                {(newStaff.role === 'waiter' || newStaff.role === 'kitchen') && (
                  <p className="text-xs text-muted-foreground">
                    💡 {newStaff.role === 'waiter' ? 'Waiters use PIN for quick login. Access /waiter page to take orders.' : 'Kitchen staff can access /kitchen page to manage orders.'}
                  </p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStaffModal({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={staffModal.editing ? handleUpdateStaff : handleAddStaff} className="gradient-primary">
              {staffModal.editing ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { 
  icon: any; label: string; value: string; 
  color: 'primary' | 'success' | 'accent' | 'warning';
}) {
  const colorClasses = {
    primary: 'text-primary bg-primary/15',
    success: 'text-success bg-success/15',
    accent: 'text-accent-foreground bg-accent',
    warning: 'text-warning bg-warning/15',
  };

  return (
    <div className="stat-card group">
      <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-2xl md:text-3xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
