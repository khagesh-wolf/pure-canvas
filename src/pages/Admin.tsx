import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { MenuItem, Customer, Staff } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Edit, Trash2, LogOut, Settings, LayoutDashboard, 
  UtensilsCrossed, Users, QrCode, History, TrendingUp, ShoppingBag, DollarSign,
  Download, Search, Eye, UserCog, BarChart3, Calendar, Image as ImageIcon, ToggleLeft, ToggleRight
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { formatNepalDateTime, formatNepalDateReadable, getNepalTodayString, getNepalDateDaysAgo, getTransactionDateInNepal } from '@/lib/nepalTime';
import { QRCodeSVG } from 'qrcode.react';
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

type Category = 'Tea' | 'Snacks' | 'Cold Drink' | 'Pastry';
const categories: Category[] = ['Tea', 'Snacks', 'Cold Drink', 'Pastry'];

const COLORS = ['#06C167', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Admin() {
  const navigate = useNavigate();
  const qrRef = useRef<HTMLDivElement>(null);
  const { 
    menuItems, addMenuItem, updateMenuItem, deleteMenuItem, toggleItemAvailability,
    bulkToggleAvailability,
    customers, transactions, staff, settings, updateSettings,
    addStaff, updateStaff, deleteStaff,
    isAuthenticated, currentUser, logout, getTodayStats
  } = useStore();

  const [tab, setTab] = useState('dashboard');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState<{ name: string; price: string; category: Category; description: string; image: string }>({ 
    name: '', price: '', category: 'Tea', description: '', image: ''
  });

  // Menu search and bulk selection
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedMenuItems, setSelectedMenuItems] = useState<string[]>([]);

  // Search states
  const [customerSearch, setCustomerSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  // Modal states
  const [customerDetailModal, setCustomerDetailModal] = useState<Customer | null>(null);
  const [staffModal, setStaffModal] = useState<{ open: boolean; editing: Staff | null }>({ open: false, editing: null });
  const [newStaff, setNewStaff] = useState({ username: '', password: '', name: '', role: 'counter' as 'admin' | 'counter' });

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
  
  if (!isAuthenticated || !isAuthorized) {
    navigate('/auth');
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

  // Handle image upload for menu items
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (isEditing && editingItem) {
        setEditingItem({ ...editingItem, image: base64 });
      } else {
        setNewItem(prev => ({ ...prev, image: base64 }));
      }
    };
    reader.readAsDataURL(file);
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

  const selectAllInCategory = (cat: Category) => {
    const catItems = menuItems.filter(m => m.category === cat).map(m => m.id);
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
      name: sanitizeText(newStaff.name)
    });
    toast.success('Staff added');
    setNewStaff({ username: '', password: '', name: '', role: 'counter' });
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
    const wifiQRData = settings.wifiSSID 
      ? `WIFI:T:WPA;S:${settings.wifiSSID};P:${settings.wifiPassword};;`
      : '';

    // Build table data
    const tables: { num: number; url: string }[] = [];
    for (let i = 1; i <= settings.tableCount; i++) {
      tables.push({
        num: i,
        url: `${settings.baseUrl || window.location.origin}/table/${i}`
      });
    }

    toast.info('Opening print preview...');

    // Open print window with QR library loaded via CDN
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print QR codes');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - ${settings.restaurantName}</title>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
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
          .qr-container { width: 120px; height: 120px; margin: 0 auto; }
          .qr-container canvas { width: 100% !important; height: 100% !important; }
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
        <div class="cards-grid" id="cards"></div>
        <script>
          const tables = ${JSON.stringify(tables)};
          const wifiData = ${JSON.stringify(wifiQRData)};
          const wifiSSID = ${JSON.stringify(settings.wifiSSID || '')};
          const restaurantName = ${JSON.stringify(settings.restaurantName)};
          
          async function generateCards() {
            const container = document.getElementById('cards');
            const qrElements = [];
            
            for (const table of tables) {
              const card = document.createElement('div');
              card.className = 'card';
              
              // WiFi section
              const wifiSection = document.createElement('div');
              wifiSection.className = 'wifi-section';
              const wifiLabel = document.createElement('div');
              wifiLabel.className = 'wifi-label';
              wifiLabel.textContent = '📶 Free WiFi';
              wifiSection.appendChild(wifiLabel);
              
              let wifiCanvas = null;
              if (wifiData) {
                const wifiQRContainer = document.createElement('div');
                wifiQRContainer.className = 'qr-container';
                wifiCanvas = document.createElement('canvas');
                wifiQRContainer.appendChild(wifiCanvas);
                wifiSection.appendChild(wifiQRContainer);
                const wifiSsidDiv = document.createElement('div');
                wifiSsidDiv.className = 'wifi-ssid';
                wifiSsidDiv.textContent = wifiSSID;
                wifiSection.appendChild(wifiSsidDiv);
              } else {
                const noWifiDiv = document.createElement('div');
                noWifiDiv.className = 'no-wifi';
                noWifiDiv.textContent = 'No WiFi configured';
                wifiSection.appendChild(noWifiDiv);
              }
              card.appendChild(wifiSection);
              
              // Table section
              const tableSection = document.createElement('div');
              const tableLabel = document.createElement('div');
              tableLabel.className = 'table-label';
              tableLabel.textContent = '🍵 Table ' + table.num;
              tableSection.appendChild(tableLabel);
              const tableQRContainer = document.createElement('div');
              tableQRContainer.className = 'qr-container';
              const tableCanvas = document.createElement('canvas');
              tableQRContainer.appendChild(tableCanvas);
              tableSection.appendChild(tableQRContainer);
              const restaurantNameDiv = document.createElement('div');
              restaurantNameDiv.className = 'restaurant-name';
              restaurantNameDiv.textContent = restaurantName;
              tableSection.appendChild(restaurantNameDiv);
              card.appendChild(tableSection);
              
              container.appendChild(card);
              
              // Store references for QR generation
              qrElements.push({ wifiCanvas, tableCanvas, tableUrl: table.url });
            }
            
            // Generate QR codes using stored canvas references
            for (const el of qrElements) {
              try {
                if (wifiData && el.wifiCanvas) {
                  await QRCode.toCanvas(el.wifiCanvas, wifiData, { width: 120, margin: 1 });
                }
                await QRCode.toCanvas(el.tableCanvas, el.tableUrl, { width: 120, margin: 1 });
              } catch (err) {
                console.error('QR generation error:', err);
              }
            }
            
            // Auto-print after generation
            setTimeout(() => window.print(), 500);
          }
          
          generateCards();
        <\/script>
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
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Premium Dark Theme */}
      <aside className="w-72 sidebar flex flex-col sticky top-0 h-screen">
        <div className="sidebar-header">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center shadow-warm">
              <span className="text-primary-foreground font-bold text-xl">C</span>
            </div>
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
        <div className="p-4 border-t border-sidebar-border">
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
      <main className="flex-1 p-8 overflow-y-auto flex flex-col">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{navItems.find(n => n.id === tab)?.label}</h1>
            <p className="text-sm text-muted-foreground mt-1">{formatNepalDateTime(new Date())}</p>
          </div>
        </div>
        <div className="flex-1">

        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            {/* Date Range Filter */}
            <div className="flex gap-4 items-center bg-card p-4 rounded-xl border border-border">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <Input
                type="date"
                value={dashboardDateFrom}
                onChange={e => setDashboardDateFrom(e.target.value)}
                className="w-40"
              />
              <span>to</span>
              <Input
                type="date"
                value={dashboardDateTo}
                onChange={e => setDashboardDateTo(e.target.value)}
                className="w-40"
              />
              <Button 
                variant="outline" 
                size="sm"
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
                onClick={() => {
                  setDashboardDateFrom(getNepalDateDaysAgo(7));
                  setDashboardDateTo(getNepalTodayString());
                }}
              >
                Last 7 Days
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setDashboardDateFrom(getNepalDateDaysAgo(30));
                  setDashboardDateTo(getNepalTodayString());
                }}
              >
                Last 30 Days
              </Button>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <StatCard icon={DollarSign} label="Total Revenue" value={`रू ${dashboardData.totalRevenue}`} color="primary" />
              <StatCard icon={ShoppingBag} label="Total Orders" value={dashboardData.totalOrders.toString()} color="success" />
              <StatCard icon={TrendingUp} label="Avg Order Value" value={`रू ${dashboardData.avgOrderValue}`} color="accent" />
              <StatCard icon={Users} label="Unique Customers" value={dashboardData.uniqueCustomers.toString()} color="warning" />
            </div>

            {/* Quick Charts - Now use dashboard date range */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dashboardData.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4">Top Selling Items</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dashboardData.topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
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
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Analytics & Reports</h2>
              <Button onClick={exportAnalyticsCSV} className="gradient-primary">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>

            <div className="flex gap-4 items-center bg-card p-4 rounded-xl border border-border">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <Input
                type="date"
                value={analyticsDateFrom}
                onChange={e => setAnalyticsDateFrom(e.target.value)}
                className="w-40"
              />
              <span>to</span>
              <Input
                type="date"
                value={analyticsDateTo}
                onChange={e => setAnalyticsDateTo(e.target.value)}
                className="w-40"
              />
            </div>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-4 gap-6">
              <StatCard icon={DollarSign} label="Total Revenue" value={`रू ${analytics.totalRevenue}`} color="primary" />
              <StatCard icon={ShoppingBag} label="Total Orders" value={analytics.totalOrders.toString()} color="success" />
              <StatCard icon={TrendingUp} label="Avg Order Value" value={`रू ${analytics.avgOrderValue}`} color="accent" />
              <StatCard icon={Users} label="Unique Customers" value={analytics.uniqueCustomers.toString()} color="warning" />
            </div>

            {/* Payment Methods Summary */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 bg-[#f0f9f4] rounded-2xl border border-[#27ae60]/20">
                <div className="text-sm text-muted-foreground mb-1">Cash Payments</div>
                <div className="text-3xl font-bold text-[#27ae60]">
                  रू {analytics.cashTotal.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {analytics.totalRevenue > 0 
                    ? `${((analytics.cashTotal / analytics.totalRevenue) * 100).toFixed(0)}% of total` 
                    : '0%'}
                </div>
              </div>
              <div className="p-6 bg-[#fdf0f4] rounded-2xl border border-[#c32148]/20">
                <div className="text-sm text-muted-foreground mb-1">Fonepay Payments</div>
                <div className="text-3xl font-bold text-[#c32148]">
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
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4">Daily Revenue</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.dailyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4">Payment Methods (Order Count)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={analytics.paymentMethods} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                      {analytics.paymentMethods.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4">Top 10 Items by Quantity</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.topItems} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="qty" fill="hsl(var(--primary))" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-4">Peak Hours</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.peakHours.filter(h => h.orders > 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Menu Management</h2>
              <div className="flex gap-3">
                {selectedMenuItems.length > 0 && (
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-muted-foreground">{selectedMenuItems.length} selected</span>
                    <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)}>
                      <ToggleRight className="w-4 h-4 mr-1" /> Enable All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)}>
                      <ToggleLeft className="w-4 h-4 mr-1" /> Disable All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMenuItems([])}>
                      Clear
                    </Button>
                  </div>
                )}
                <Button onClick={() => setIsAddingItem(true)} className="gradient-primary">
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </Button>
              </div>
            </div>
            
            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search menu items..."
                  value={menuSearch}
                  onChange={e => setMenuSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {categories.map(cat => {
              const catItems = filteredMenuItems.filter(m => m.category === cat);
              if (catItems.length === 0 && menuSearch) return null;
              
              const allCatItems = menuItems.filter(m => m.category === cat);
              const allSelected = allCatItems.length > 0 && allCatItems.every(m => selectedMenuItems.includes(m.id));
              
              return (
                <div key={cat} className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => selectAllInCategory(cat)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <h3 className="font-bold text-lg text-primary">{cat}</h3>
                    <span className="text-sm text-muted-foreground">({catItems.length} items)</span>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    {(menuSearch ? catItems : allCatItems).map(item => (
                      <div 
                        key={item.id} 
                        className={`bg-card rounded-xl border border-border p-4 transition-all ${!item.available ? 'opacity-50' : ''} ${selectedMenuItems.includes(item.id) ? 'ring-2 ring-primary' : ''}`}
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
                              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold truncate">{item.name}</h4>
                            <p className="text-primary font-bold">रू {item.price}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border">
                          <button 
                            onClick={() => toggleItemAvailability(item.id)} 
                            className={`text-sm px-2 py-1 rounded ${item.available ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Customers</h2>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search phone or name..."
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Button onClick={exportCustomersCSV} variant="outline">
                  <Download className="w-4 h-4 mr-2" /> Export CSV
                </Button>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4">Phone</th>
                    <th className="text-left p-4">Name</th>
                    <th className="text-left p-4">Orders</th>
                    <th className="text-left p-4">Total Spent</th>
                    <th className="text-left p-4">Points</th>
                    <th className="text-left p-4">Last Visit</th>
                    <th className="text-left p-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No customers found</td></tr>
                  ) : filteredCustomers.map(c => (
                    <tr key={c.phone} className="border-t border-border hover:bg-muted/50">
                      <td className="p-4 font-mono">{c.phone}</td>
                      <td className="p-4">{c.name || '-'}</td>
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
        )}

        {/* History */}
        {tab === 'history' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Transaction History</h2>
              <Button onClick={exportHistoryCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </div>
            <div className="flex gap-3 mb-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search table or phone..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Input
                type="date"
                value={historyDateFrom}
                onChange={e => setHistoryDateFrom(e.target.value)}
                className="w-40"
              />
              <Input
                type="date"
                value={historyDateTo}
                onChange={e => setHistoryDateTo(e.target.value)}
                className="w-40"
              />
              <Button variant="outline" onClick={() => { setHistorySearch(''); setHistoryDateFrom(''); setHistoryDateTo(''); }}>
                Clear
              </Button>
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
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
        )}

        {/* Staff */}
        {tab === 'staff' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Staff Management</h2>
              <Button onClick={() => setStaffModal({ open: true, editing: null })} className="gradient-primary">
                <Plus className="w-4 h-4 mr-2" /> Add Staff
              </Button>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {staff.map(s => (
                <div key={s.id} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-semibold">{s.name}</h4>
                      <p className="text-sm text-muted-foreground">@{s.username}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      s.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {s.role.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Created: {formatNepalDateReadable(s.createdAt)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStaffModal({ open: true, editing: s })}>
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Tables & QR Codes</h2>
              <Button onClick={printAllQR} className="gradient-primary">
                <Download className="w-4 h-4 mr-2" /> Print All QR
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4" ref={qrRef}>
              {Array.from({ length: settings.tableCount }, (_, i) => i + 1).map(num => (
                <div key={num} className="bg-card rounded-xl border border-border p-4 text-center">
                  <p className="font-bold text-lg mb-2">Table {num}</p>
                  <div className="bg-white p-2 rounded-lg inline-block mb-2">
                    <QRCodeSVG
                      id={`qr-${num}`}
                      value={`${settings.baseUrl || window.location.origin}/table/${num}`}
                      size={120}
                      level="M"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{settings.restaurantName}</p>
                  <Button size="sm" variant="outline" onClick={() => downloadQR(num)}>
                    <Download className="w-3 h-3 mr-1" /> Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="max-w-4xl">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - General Settings */}
              <div className="space-y-4">
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    General Settings
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Restaurant Name</label>
                      <Input value={settings.restaurantName} onChange={e => updateSettings({ restaurantName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Table Count</label>
                      <Input type="number" value={settings.tableCount} onChange={e => updateSettings({ tableCount: parseInt(e.target.value) || 10 })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Base URL (for QR codes)</label>
                      <div className="flex gap-2">
                        <Input 
                          value={settings.baseUrl} 
                          onChange={e => updateSettings({ baseUrl: e.target.value })} 
                          placeholder={window.location.origin} 
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // Try to get hostname for mDNS
                            const hostname = window.location.hostname;
                            const port = window.location.port;
                            const protocol = window.location.protocol;
                            
                            // If already using .local or a domain, keep it
                            if (hostname.endsWith('.local') || hostname.includes('.')) {
                              const url = `${protocol}//${hostname}${port ? ':' + port : ''}`;
                              updateSettings({ baseUrl: url });
                              toast.success('Base URL set to: ' + url);
                            } else {
                              // Show dialog to enter hostname
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
                        Click "Use Hostname" to set up.
                      </p>
                    </div>
                    
                    {/* Counter as Admin Toggle */}
                    <div className="pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium">Counter as Admin Mode</label>
                          <p className="text-xs text-muted-foreground mt-1">
                            When enabled, counter staff can access all admin features.<br/>
                            Useful for single-person operations without separate admin.
                          </p>
                        </div>
                        <Switch
                          checked={settings.counterAsAdmin || false}
                          onCheckedChange={(checked) => {
                            updateSettings({ counterAsAdmin: checked });
                            toast.success(checked ? 'Counter staff now have admin access' : 'Counter staff have standard access');
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-primary" />
                    WiFi Credentials
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">WiFi SSID</label>
                      <Input value={settings.wifiSSID} onChange={e => updateSettings({ wifiSSID: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">WiFi Password</label>
                      <Input value={settings.wifiPassword} onChange={e => updateSettings({ wifiPassword: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Logo Upload Section */}
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
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('Image must be less than 2MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            updateSettings({ logo: event.target?.result as string });
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">Max 2MB, JPG/PNG. Used on customer page & printed receipts.</p>
                      {settings.logo && (
                        <Button variant="ghost" size="sm" onClick={() => updateSettings({ logo: undefined })}>
                          <Trash2 className="w-4 h-4 mr-1" /> Remove Logo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Social Media */}
              <div className="space-y-4">
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
              </div>
            </div>
          </div>
        )}
        </div>
        
        {/* Copyright Footer */}
        <footer className="mt-auto pt-8 pb-4 text-center border-t border-border">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {settings.restaurantName}. All rights reserved.
          </p>
        </footer>
      </main>

      {/* Add Item Modal */}
      <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Menu Item</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Item name" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            <Input placeholder="Price" type="number" value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })} />
            <Select value={newItem.category} onValueChange={(v: Category) => setNewItem({ ...newItem, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                  <img src={newItem.image} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
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
                  />
                  <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG/PNG</p>
                </div>
                {newItem.image && (
                  <Button variant="ghost" size="sm" onClick={() => setNewItem({ ...newItem, image: '' })}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddingItem(false); setNewItem({ name: '', price: '', category: 'Tea', description: '', image: '' }); }}>Cancel</Button>
            <Button onClick={handleAddItem} className="gradient-primary">Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Item</DialogTitle></DialogHeader>
          {editingItem && (
            <div className="space-y-4 py-4">
              <Input value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} />
              <Input type="number" value={editingItem.price} onChange={e => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })} />
              <Select value={editingItem.category} onValueChange={(v: Category) => setEditingItem({ ...editingItem, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                    <img src={editingItem.image} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
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
                    />
                    <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG/PNG</p>
                  </div>
                  {editingItem.image && (
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

      {/* Customer Detail Modal */}
      <Dialog open={!!customerDetailModal} onOpenChange={() => setCustomerDetailModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Customer Details</DialogTitle></DialogHeader>
          {customerDetailModal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-bold">{customerDetailModal.phone}</p>
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

      {/* Staff Modal */}
      <Dialog open={staffModal.open} onOpenChange={(open) => !open && setStaffModal({ open: false, editing: null })}>
        <DialogContent>
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
                <Select 
                  value={staffModal.editing.role} 
                  onValueChange={(v: 'admin' | 'counter') => setStaffModal({ ...staffModal, editing: { ...staffModal.editing!, role: v }})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="counter">Counter</SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <>
                <Input placeholder="Name" value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} />
                <Input placeholder="Username" value={newStaff.username} onChange={e => setNewStaff({ ...newStaff, username: e.target.value })} />
                <Input placeholder="Password" type="password" value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} />
                <Select value={newStaff.role} onValueChange={(v: 'admin' | 'counter') => setNewStaff({ ...newStaff, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="counter">Counter</SelectItem>
                  </SelectContent>
                </Select>
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
    accent: 'text-secondary bg-secondary/15',
    warning: 'text-warning bg-warning/15',
  };

  return (
    <div className="stat-card group">
      <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="font-serif text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
