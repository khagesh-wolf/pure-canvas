import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Order, OrderItem, Expense } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { formatNepalTime, formatNepalDateTime } from '@/lib/nepalTime';
import FonepayQR from '@/components/FonepayQR';
import { useOrderNotification } from '@/hooks/useOrderNotification';
import { useWaiterCallNotification } from '@/hooks/useWaiterCallNotification';

interface BillGroup {
  key: string;
  phone: string;
  tableNumber: number;
  points: number;
  subtotal: number;
  items: { name: string; qty: number; price: number; total: number }[];
  createdAt: string;
}

const expenseCategories = ['ingredients', 'utilities', 'salary', 'maintenance', 'other'] as const;

export default function Counter() {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  
  // Audio notification hooks
  useOrderNotification();
  useWaiterCallNotification();
  
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
    getCustomerPoints
  } = useStore();

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
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [lastPaidData, setLastPaidData] = useState<any>(null);
  const [currentDetailData, setCurrentDetailData] = useState<any>(null);
  
  // Expense states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ amount: '', description: '', category: 'other' as Expense['category'] });

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

  // Redirect if not authenticated
  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  // Filter orders
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const acceptedOrders = orders.filter(o => o.status === 'accepted');

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
        groups[key].items.push({
          name: item.name,
          qty: item.qty,
          price: item.price,
          total: itemTotal
        });
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
  const availablePoints = selectedPhones.length === 1 ? (selectedGroups[0]?.points || 0) : 0;
  const discountAmount = redeemPoints ? Math.min(availablePoints, paymentSubtotal) : 0;
  const paymentTotal = paymentSubtotal - discountAmount;

  // History data
  const getHistoryData = () => {
    let data = [...transactions];
    if (historyDate) {
      data = data.filter(t => t.paidAt.startsWith(historyDate));
    }
    return data.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());
  };

  const historyData = getHistoryData();

  const handleAccept = (order: Order) => {
    // Re-check order status to prevent race condition with customer cancellation
    const currentOrder = orders.find(o => o.id === order.id);
    if (!currentOrder || currentOrder.status !== 'pending') {
      toast.error('Order was cancelled by customer');
      return;
    }
    updateOrderStatus(order.id, 'accepted');
    toast.success('Order accepted');
    printKOT(order);
  };

  const handleReject = (orderId: string) => {
    // Re-check order status to prevent race condition
    const currentOrder = orders.find(o => o.id === orderId);
    if (!currentOrder || currentOrder.status !== 'pending') {
      toast.error('Order was already cancelled');
      return;
    }
    if (!confirm('Reject this order?')) return;
    updateOrderStatus(orderId, 'cancelled');
    toast.info('Order rejected');
  };

  const printKOT = (order: Order) => {
    const printContent = `
      <div style="font-family: monospace; width: 300px; padding: 10px;">
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
          <h2 style="margin: 0;">KITCHEN ORDER</h2>
          <div>${formatNepalDateTime(new Date())}</div>
        </div>
        <div style="font-size: 1.2rem; font-weight: bold; text-align: center; margin: 10px 0; border: 2px solid black; padding: 5px;">
          TABLE ${order.tableNumber}
        </div>
        <div style="text-align: center; margin-bottom: 10px; font-weight: bold;">Customer: ${order.customerPhone}</div>
        <div style="border-bottom: 2px solid black; margin-bottom: 10px;"></div>
        ${order.items.map(i => `
          <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">
            <span>${i.qty} x</span>
            <span>${i.name}</span>
          </div>
        `).join('')}
        ${order.notes ? `
          <div style="border-top: 1px dashed black; margin-top: 10px; padding-top: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px;">📝 Special Instructions:</div>
            <div style="font-size: 1.1rem;">${order.notes}</div>
          </div>
        ` : ''}
        <div style="border-top: 2px solid black; margin-top: 20px; padding-top: 10px; text-align: center;">
          Ref: #${order.id.slice(-6)}
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
    setPaymentModalOpen(true);
  };

  const processPayment = (method: 'cash' | 'fonepay') => {
    if (method === 'fonepay') {
      setPaymentModalOpen(false);
      setFonepayModalOpen(true);
      return;
    }

    if (!confirm(`Confirm CASH payment of रू${paymentTotal}?`)) return;
    executePayment(method);
  };

  const executePayment = (method: 'cash' | 'fonepay') => {
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
    payBill(bill.id, method);

    // Store last paid data for printing
    setLastPaidData({
      date: formatNepalDateTime(new Date()),
      table: tableNumber,
      phones: selectedPhones.join(', '),
      items: selectedGroups.flatMap(g => g.items),
      total: paymentTotal,
      discount: discountAmount,
      method
    });

    setPaymentModalOpen(false);
    setFonepayModalOpen(false);
    setSuccessModalOpen(true);
    setSelectedPhones([]);
    toast.success(`Payment completed via ${method}`);
  };

  const printReceipt = (data: any) => {
    const printContent = `
      <div style="font-family: monospace; width: 300px; padding: 10px;">
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
          <h2 style="margin: 0;">${settings.restaurantName.toUpperCase()}</h2>
          <div>${data.date}</div>
          <div>Table: ${data.table} | ${data.method.toUpperCase()}</div>
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
            <span>Discount (Points)</span>
            <span>-${data.discount}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2rem; margin-top: 10px;">
          <span>TOTAL</span>
          <span>रू${data.total}</span>
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
      method: t.paymentMethod
    });
    setDetailModalOpen(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      {/* Sidebar - Incoming Orders & Waiter Calls - 3D Enhanced */}
      <div className="w-[350px] text-white flex flex-col relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          boxShadow: 'inset -2px 0 8px rgba(0,0,0,0.3), 4px 0 20px rgba(0,0,0,0.4)'
        }}
      >
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
                  className="rounded-xl p-4 animate-pulse relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                    boxShadow: '0 8px 20px rgba(251,191,36,0.3), inset 0 1px 0 rgba(255,255,255,0.8)',
                    transform: 'translateZ(0)'
                  }}
                >
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 rounded-l-xl" />
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-lg text-gray-800">Table {call.tableNumber}</span>
                    <span className="text-xs text-gray-500">{formatNepalTime(call.createdAt)}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    Customer: {call.customerPhone}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
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
                      className="border-gray-300 text-gray-600 hover:bg-gray-100"
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
            pendingOrders.map(order => (
              <div 
                key={order.id} 
                className="rounded-xl p-4 animate-slide-up relative overflow-hidden group transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,1)',
                  transform: 'translateZ(0)'
                }}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-orange-500 rounded-l-xl" />
                <div className="flex justify-between font-bold mb-1 border-b border-dashed border-gray-200 pb-2 text-gray-800">
                  <span className="text-lg">Table {order.tableNumber}</span>
                  <span className="text-sm font-normal text-gray-500">{formatNepalTime(order.createdAt)}</span>
                </div>
                <div className="text-sm text-gray-500 italic mb-2">
                  Customer: {order.customerPhone}
                </div>
                <div className="text-sm mb-3 space-y-1">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-gray-700">
                      <span className="font-medium">{item.qty}x {item.name}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-400 mb-3">ID: #{order.id.slice(-6)}</div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/30"
                    onClick={() => handleAccept(order)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Accept & Print
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/30"
                    onClick={() => handleReject(order.id)}
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold m-0">Counter</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('active')}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
                  activeTab === 'active' 
                    ? 'bg-[#333] text-white' 
                    : 'bg-white border border-[#ddd] text-[#555]'
                }`}
              >
                Active Bills
              </button>
              <button 
                onClick={() => setActiveTab('accepted')}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
                  activeTab === 'accepted' 
                    ? 'bg-[#333] text-white' 
                    : 'bg-white border border-[#ddd] text-[#555]'
                }`}
              >
                Accepted Orders
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
                  activeTab === 'history' 
                    ? 'bg-[#333] text-white' 
                    : 'bg-white border border-[#ddd] text-[#555]'
                }`}
              >
                History
              </button>
              <button 
                onClick={() => setActiveTab('expenses')}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all flex items-center gap-1 ${
                  activeTab === 'expenses' 
                    ? 'bg-[#333] text-white' 
                    : 'bg-white border border-[#ddd] text-[#555]'
                }`}
              >
                <Wallet className="w-4 h-4" /> Expenses
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Input 
              type="text"
              placeholder="Table No or Phone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-48"
            />
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {settings.counterAsAdmin && (
              <Button variant="outline" onClick={() => navigate('/admin')} className="bg-primary/10 border-primary text-primary hover:bg-primary/20">
                <Settings className="w-4 h-4 mr-2" /> Admin Panel
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Active Bills Tab */}
          {activeTab === 'active' && (
            <div className="flex flex-wrap gap-5">
              {billGroups.slice(0, billsLimit).map(group => (
                <div 
                  key={group.key}
                  onClick={() => toggleSelectBill(group.phone)}
                  className={`bg-white w-[280px] p-5 rounded-lg border cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${
                    selectedPhones.includes(group.phone) 
                      ? 'border-2 border-[#27ae60] bg-[#f0fdf4]' 
                      : 'border-[#eee]'
                  }`}
                >
                  <div className="flex justify-between font-bold mb-2 border-b border-dashed border-[#eee] pb-1">
                    <span>{group.phone}</span>
                    <span>Table {group.tableNumber}</span>
                  </div>
                  <div className="mb-2">
                    {group.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.qty}x {item.name}</span>
                        <span>{item.total}</span>
                      </div>
                    ))}
                  </div>
                  <div className="font-bold text-right text-lg border-t border-[#eee] pt-2">
                    रू{group.subtotal}
                  </div>
                  {group.points > 0 && (
                    <div className="text-xs text-[#f39c12] mt-1">⭐ {group.points} points available</div>
                  )}
                  <div className="text-xs text-[#888] mt-1">{formatNepalTime(group.createdAt)}</div>
                </div>
              ))}
              {billGroups.length === 0 && (
                <div className="w-full text-center text-[#aaa] py-12">No unpaid bills found.</div>
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
            <div className="bg-white rounded-lg overflow-hidden shadow-sm">
              <table className="w-full border-collapse">
                <thead className="bg-[#f8f9fa]">
                  <tr>
                    <th className="p-4 text-left font-bold text-[#555]">ID</th>
                    <th className="p-4 text-left font-bold text-[#555]">Time</th>
                    <th className="p-4 text-left font-bold text-[#555]">Table</th>
                    <th className="p-4 text-left font-bold text-[#555]">Customer</th>
                    <th className="p-4 text-left font-bold text-[#555]">Items</th>
                    <th className="p-4 text-left font-bold text-[#555]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {acceptedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#aaa]">No accepted orders.</td>
                    </tr>
                  ) : (
                    acceptedOrders.map(order => (
                      <tr key={order.id} className="border-t border-[#eee] hover:bg-[#f9f9f9]">
                        <td className="p-4">#{order.id.slice(-6)}</td>
                        <td className="p-4">{formatNepalTime(order.createdAt)}</td>
                        <td className="p-4">Table {order.tableNumber}</td>
                        <td className="p-4">{order.customerPhone}</td>
                        <td className="p-4">{order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                        <td className="p-4 font-bold">रू{order.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <div className="mb-4 flex gap-3">
                <Input 
                  type="date" 
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="w-48"
                />
                <Button onClick={() => setHistoryDate('')}>Clear Filter</Button>
              </div>
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <table className="w-full border-collapse">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="p-4 text-left font-bold text-[#555]">Bill ID</th>
                      <th className="p-4 text-left font-bold text-[#555]">Paid At</th>
                      <th className="p-4 text-left font-bold text-[#555]">Table</th>
                      <th className="p-4 text-left font-bold text-[#555]">Customers</th>
                      <th className="p-4 text-left font-bold text-[#555]">Total</th>
                      <th className="p-4 text-left font-bold text-[#555]">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.slice(0, historyLimit).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-[#aaa]">No transactions found.</td>
                      </tr>
                    ) : (
                      historyData.slice(0, historyLimit).map(t => (
                        <tr 
                          key={t.id} 
                          className="border-t border-[#eee] hover:bg-[#f9f9f9] cursor-pointer"
                          onClick={() => viewTransactionDetail(t)}
                        >
                          <td className="p-4">#{t.id.slice(-6)}</td>
                          <td className="p-4">{formatNepalTime(t.paidAt)}</td>
                          <td className="p-4">Table {t.tableNumber}</td>
                          <td className="p-4">{t.customerPhones.join(', ') || 'Guest'}</td>
                          <td className="p-4 font-bold">रू{t.total}</td>
                          <td className="p-4">{t.paymentMethod.toUpperCase()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Expense Tracking</h3>
                <Button onClick={() => setExpenseModalOpen(true)} className="bg-[#333] hover:bg-[#333]/90">
                  <Plus className="w-4 h-4 mr-2" /> Add Expense
                </Button>
              </div>
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                <table className="w-full border-collapse">
                  <thead className="bg-[#f8f9fa]">
                    <tr>
                      <th className="p-4 text-left font-bold text-[#555]">Date</th>
                      <th className="p-4 text-left font-bold text-[#555]">Category</th>
                      <th className="p-4 text-left font-bold text-[#555]">Description</th>
                      <th className="p-4 text-left font-bold text-[#555]">Amount</th>
                      <th className="p-4 text-left font-bold text-[#555]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-[#aaa]">No expenses recorded.</td>
                      </tr>
                    ) : (
                      [...expenses].reverse().map(exp => (
                        <tr key={exp.id} className="border-t border-[#eee] hover:bg-[#f9f9f9]">
                          <td className="p-4">{formatNepalDateTime(exp.createdAt)}</td>
                          <td className="p-4 capitalize">{exp.category}</td>
                          <td className="p-4">{exp.description}</td>
                          <td className="p-4 font-bold text-red-600">-रू{exp.amount}</td>
                          <td className="p-4">
                            <Button size="sm" variant="destructive" onClick={() => { deleteExpense(exp.id); toast.success('Deleted'); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {expenses.length > 0 && (
                  <div className="p-4 bg-[#f8f9fa] border-t border-[#eee]">
                    <div className="flex justify-between font-bold">
                      <span>Total Expenses:</span>
                      <span className="text-red-600">-रू{expenses.reduce((sum, e) => sum + e.amount, 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        {selectedPhones.length > 0 && (
          <div className="fixed bottom-5 right-5 bg-[#222] text-white px-8 py-4 rounded-full flex items-center gap-5 shadow-lg z-50 animate-slide-up">
            <div><span className="font-bold">{selectedPhones.length}</span> bills selected</div>
            <Button className="bg-[#27ae60] hover:bg-[#27ae60]/90" onClick={openPaymentModal}>
              Pay & Clear
            </Button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md">
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

          {/* Loyalty Points */}
          {availablePoints > 0 && (
            <div className="bg-[#e8f5e9] p-3 rounded-lg mb-4">
              <label className="flex justify-between items-center cursor-pointer">
                <span>Redeem <b>{availablePoints}</b> points (रू{availablePoints} off)</span>
                <input 
                  type="checkbox" 
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                  className="w-5 h-5"
                />
              </label>
            </div>
          )}

          {discountAmount > 0 && (
            <div className="flex justify-between text-[#27ae60] mb-2">
              <span>Discount (Points)</span>
              <span>-रू{discountAmount}</span>
            </div>
          )}

          <div className="flex justify-between text-xl font-bold mb-6">
            <span>Total Pay:</span>
            <span>रू{paymentTotal}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="border-2 border-black text-black font-bold py-6"
              onClick={() => processPayment('cash')}
            >
              CASH
            </Button>
            <Button 
              className="bg-[#c32148] hover:bg-[#c32148]/90 py-6 font-bold"
              onClick={() => processPayment('fonepay')}
            >
              FONEPAY
            </Button>
          </div>
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
        <DialogContent className="max-w-md">
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
        <DialogContent>
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
    </div>
  );
}