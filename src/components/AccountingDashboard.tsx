import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { 
  DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Calendar,
  ArrowUpRight, ArrowDownRight, Receipt, Building2, Clock, CheckCircle2,
  AlertCircle, PiggyBank, BarChart3, ShoppingBag, FileText, Download, CalendarIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { formatNepalDateTime, getNepalTodayString, getNepalDateDaysAgo, getTransactionDateInNepal } from '@/lib/nepalTime';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ExpenseCategory } from '@/types';
import { MonthlyReportGenerator } from './MonthlyReportGenerator';
import { format, parse } from 'date-fns';
import { cn } from '@/lib/utils';

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'ingredients', label: 'Ingredients', color: 'bg-success/10 text-success' },
  { value: 'utilities', label: 'Utilities', color: 'bg-primary/10 text-primary' },
  { value: 'salary', label: 'Salary', color: 'bg-warning/10 text-warning' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-accent text-accent-foreground' },
  { value: 'rent', label: 'Rent', color: 'bg-destructive/10 text-destructive' },
  { value: 'marketing', label: 'Marketing', color: 'bg-purple-500/10 text-purple-600' },
  { value: 'equipment', label: 'Equipment', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'other', label: 'Other', color: 'bg-muted text-muted-foreground' },
];

const COLORS = ['#06C167', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#6B7280'];

interface AccountingDashboardProps {
  currentUser?: { name: string; id: string } | null;
}

export function AccountingDashboard({ currentUser }: AccountingDashboardProps) {
  const { 
    transactions, expenses, menuItems, categories: menuCategories,
    addExpense, 
    cashDrawerSessions, openCashDrawer, closeCashDrawer, getCurrentCashDrawerSession
  } = useStore();

  // Date range state
  const [dateFrom, setDateFrom] = useState(() => getNepalDateDaysAgo(30));
  const [dateTo, setDateTo] = useState(() => getNepalTodayString());
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'custom'>('30days');

  // Modal states
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [cashDrawerModalOpen, setCashDrawerModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // New expense form
  const [newExpense, setNewExpense] = useState({
    amount: '',
    description: '',
    category: 'ingredients' as ExpenseCategory,
    vendor: '',
    receiptNumber: ''
  });

  // Opening balance for new drawer session
  const [openingBalance, setOpeningBalance] = useState('');

  // Current cash drawer session
  const currentSession = getCurrentCashDrawerSession();

  // Filtered data based on date range
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const date = getTransactionDateInNepal(t.paidAt);
      return date >= dateFrom && date <= dateTo;
    });
  }, [transactions, dateFrom, dateTo]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const date = getTransactionDateInNepal(e.createdAt);
      return date >= dateFrom && date <= dateTo;
    });
  }, [expenses, dateFrom, dateTo]);

  // Calculate financial summary
  const summary = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    
    const cashRevenue = filteredTransactions
      .filter(t => t.paymentMethod === 'cash' || t.paymentMethod === 'split')
      .reduce((sum, t) => {
        if (t.paymentMethod === 'split' && t.splitDetails) {
          return sum + t.splitDetails.cashAmount;
        }
        return sum + t.total;
      }, 0);

    const digitalRevenue = filteredTransactions
      .filter(t => t.paymentMethod === 'fonepay' || t.paymentMethod === 'split')
      .reduce((sum, t) => {
        if (t.paymentMethod === 'split' && t.splitDetails) {
          return sum + t.splitDetails.fonepayAmount;
        }
        return sum + t.total;
      }, 0);

    return { totalRevenue, totalExpenses, netProfit, cashRevenue, digitalRevenue };
  }, [filteredTransactions, filteredExpenses]);

  // Expense breakdown by category
  const expensesByCategory = useMemo(() => {
    const breakdown: Record<ExpenseCategory, number> = {
      ingredients: 0, utilities: 0, salary: 0, maintenance: 0,
      rent: 0, marketing: 0, equipment: 0, other: 0
    };
    filteredExpenses.forEach(e => {
      breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
    });
    return Object.entries(breakdown)
      .filter(([_, amount]) => amount > 0)
      .map(([category, amount]) => ({ name: category, value: amount }));
  }, [filteredExpenses]);

  // Sales by category (menu category)
  const salesByCategory = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      t.items.forEach(item => {
        const menuItem = menuItems.find(m => m.name === item.name);
        const category = menuItem?.category || 'Other';
        breakdown[category] = (breakdown[category] || 0) + (item.price * item.qty);
      });
    });
    return Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [filteredTransactions, menuItems]);

  // Item-level sales analysis
  const itemSalesAnalysis = useMemo(() => {
    const items: Record<string, { name: string; qty: number; revenue: number; category: string }> = {};
    filteredTransactions.forEach(t => {
      t.items.forEach(item => {
        if (!items[item.name]) {
          const menuItem = menuItems.find(m => m.name === item.name);
          items[item.name] = { 
            name: item.name, 
            qty: 0, 
            revenue: 0,
            category: menuItem?.category || 'Other'
          };
        }
        items[item.name].qty += item.qty;
        items[item.name].revenue += item.price * item.qty;
      });
    });
    return Object.values(items).sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions, menuItems]);

  // Daily revenue trend
  const dailyTrend = useMemo(() => {
    const days: Record<string, { revenue: number; expenses: number }> = {};
    filteredTransactions.forEach(t => {
      const day = getTransactionDateInNepal(t.paidAt);
      if (!days[day]) days[day] = { revenue: 0, expenses: 0 };
      days[day].revenue += t.total;
    });
    filteredExpenses.forEach(e => {
      const day = getTransactionDateInNepal(e.createdAt);
      if (!days[day]) days[day] = { revenue: 0, expenses: 0 };
      days[day].expenses += e.amount;
    });
    return Object.entries(days)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data, profit: data.revenue - data.expenses }));
  }, [filteredTransactions, filteredExpenses]);

  const handleAddExpense = () => {
    if (!newExpense.amount || parseFloat(newExpense.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!newExpense.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    addExpense({
      amount: parseFloat(newExpense.amount),
      description: newExpense.description.trim(),
      category: newExpense.category,
      vendor: newExpense.vendor.trim() || undefined,
      receiptNumber: newExpense.receiptNumber.trim() || undefined,
      createdBy: currentUser?.name || 'Admin'
    });

    toast.success('Expense added successfully');
    setNewExpense({ amount: '', description: '', category: 'ingredients', vendor: '', receiptNumber: '' });
    setExpenseModalOpen(false);
  };

  const handleOpenDrawer = () => {
    if (!openingBalance || parseFloat(openingBalance) < 0) {
      toast.error('Please enter a valid opening balance');
      return;
    }
    openCashDrawer(parseFloat(openingBalance), currentUser?.name || 'Admin');
    toast.success('Cash drawer opened');
    setOpeningBalance('');
    setCashDrawerModalOpen(false);
  };

  const handleCloseDrawer = () => {
    if (!currentSession) return;
    if (!closingBalance || parseFloat(closingBalance) < 0) {
      toast.error('Please enter a valid closing balance');
      return;
    }
    closeCashDrawer(currentSession.id, parseFloat(closingBalance), currentUser?.name || 'Admin', closingNotes);
    toast.success('Cash drawer closed');
    setClosingBalance('');
    setClosingNotes('');
    setCashDrawerModalOpen(false);
  };

  const setDateRange = (preset: 'today' | '7days' | '30days') => {
    setDatePreset(preset);
    const today = getNepalTodayString();
    if (preset === 'today') {
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === '7days') {
      setDateFrom(getNepalDateDaysAgo(7));
      setDateTo(today);
    } else {
      setDateFrom(getNepalDateDaysAgo(30));
      setDateTo(today);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg md:text-2xl font-bold">Accounting</h2>
          <p className="text-xs md:text-sm text-muted-foreground">{formatNepalDateTime(new Date())}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={() => setReportModalOpen(true)} variant="outline" className="flex-1 sm:flex-none">
            <FileText className="w-4 h-4 mr-2" /> Monthly Report
          </Button>
          <Button onClick={() => setExpenseModalOpen(true)} className="gradient-primary flex-1 sm:flex-none">
            <Plus className="w-4 h-4 mr-2" /> Add Expense
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setCashDrawerModalOpen(true)}
            className={currentSession ? 'border-success text-success' : ''}
          >
            <Wallet className="w-4 h-4 mr-2" />
            {currentSession ? 'Drawer Open' : 'Open Drawer'}
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-card p-3 md:p-4 rounded-xl border border-border space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">Date Range</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={datePreset === 'today' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 min-w-[80px] text-xs md:text-sm"
            onClick={() => setDateRange('today')}
          >
            Today
          </Button>
          <Button 
            variant={datePreset === '7days' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 min-w-[80px] text-xs md:text-sm"
            onClick={() => setDateRange('7days')}
          >
            7 Days
          </Button>
          <Button 
            variant={datePreset === '30days' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 min-w-[80px] text-xs md:text-sm"
            onClick={() => setDateRange('30days')}
          >
            30 Days
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal text-sm",
                    !dateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(parse(dateFrom, 'yyyy-MM-dd', new Date()), 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateFrom ? parse(dateFrom, 'yyyy-MM-dd', new Date()) : undefined}
                  onSelect={(date) => { 
                    if (date) {
                      setDateFrom(format(date, 'yyyy-MM-dd')); 
                      setDatePreset('custom'); 
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal text-sm",
                    !dateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(parse(dateTo, 'yyyy-MM-dd', new Date()), 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dateTo ? parse(dateTo, 'yyyy-MM-dd', new Date()) : undefined}
                  onSelect={(date) => { 
                    if (date) {
                      setDateTo(format(date, 'yyyy-MM-dd')); 
                      setDatePreset('custom'); 
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Cash Drawer Status */}
      {currentSession && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/20 rounded-lg">
                <Wallet className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-success">Cash Drawer Open</p>
                <p className="text-xs text-muted-foreground">
                  Opened at {formatNepalDateTime(currentSession.openedAt)} by {currentSession.openedBy}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Opening Balance</p>
              <p className="text-lg font-bold">रू {currentSession.openingBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-success/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
          </div>
          <p className="text-2xl font-bold">रू {summary.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Revenue</p>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
          </div>
          <p className="text-2xl font-bold">रू {summary.totalExpenses.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Expenses</p>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${summary.netProfit >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <PiggyBank className={`w-4 h-4 ${summary.netProfit >= 0 ? 'text-success' : 'text-destructive'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
            रू {summary.netProfit.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Net Profit</p>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold">रू {summary.cashRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Cash Sales</p>
        </div>
        <div className="bg-card p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <DollarSign className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold">रू {summary.digitalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Digital Sales</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        {/* Revenue vs Expenses Trend */}
        <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
          <h3 className="font-bold mb-4 text-sm md:text-base">Revenue vs Expenses Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 9 }} width={50} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
          <h3 className="font-bold mb-4 text-sm md:text-base">Expense Breakdown</h3>
          {expensesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={expensesByCategory} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                  {expensesByCategory.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No expenses in this period
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        {/* Sales by Category */}
        <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
          <h3 className="font-bold mb-4 text-sm md:text-base">Sales by Category</h3>
          {salesByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
                <Tooltip formatter={(value: number) => `रू ${value.toLocaleString()}`} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No sales in this period
            </div>
          )}
        </div>

        {/* Top Selling Items */}
        <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
          <h3 className="font-bold mb-4 text-sm md:text-base">Top Items by Revenue</h3>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {itemSalesAnalysis.slice(0, 10).map((item, index) => (
              <div key={item.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category} • {item.qty} sold</p>
                  </div>
                </div>
                <p className="font-bold text-primary">रू {item.revenue.toLocaleString()}</p>
              </div>
            ))}
            {itemSalesAnalysis.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No sales in this period</div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm md:text-base">Recent Expenses</h3>
          <span className="text-xs text-muted-foreground">{filteredExpenses.length} expenses</span>
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {filteredExpenses.slice(0, 20).map(expense => (
            <div key={expense.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.color || 'bg-muted'}`}>
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{expense.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatNepalDateTime(expense.createdAt)}</span>
                    {expense.vendor && <span>• {expense.vendor}</span>}
                  </div>
                </div>
              </div>
              <p className="font-bold text-destructive">-रू {expense.amount.toLocaleString()}</p>
            </div>
          ))}
          {filteredExpenses.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No expenses in this period</div>
          )}
        </div>
      </div>

      {/* Cash Drawer History */}
      <div className="bg-card p-4 md:p-6 rounded-2xl border border-border">
        <h3 className="font-bold mb-4 text-sm md:text-base">Cash Drawer History</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {cashDrawerSessions.slice(-10).reverse().map(session => (
            <div key={session.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${session.status === 'open' ? 'bg-success/10' : 'bg-muted'}`}>
                  {session.status === 'open' ? (
                    <Clock className="w-4 h-4 text-success" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {session.status === 'open' ? 'Currently Open' : `Closed by ${session.closedBy}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Opened {formatNepalDateTime(session.openedAt)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm">
                  <span className="text-muted-foreground">Open:</span> रू {session.openingBalance.toLocaleString()}
                </p>
                {session.status === 'closed' && session.closingBalance !== undefined && (
                  <>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Close:</span> रू {session.closingBalance.toLocaleString()}
                    </p>
                    {session.discrepancy !== undefined && session.discrepancy !== 0 && (
                      <p className={`text-xs font-medium ${session.discrepancy >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {session.discrepancy >= 0 ? '+' : ''}रू {session.discrepancy.toLocaleString()} difference
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {cashDrawerSessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No cash drawer sessions</div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      <Dialog open={expenseModalOpen} onOpenChange={setExpenseModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount (रू)</label>
              <Input
                type="number"
                placeholder="0"
                value={newExpense.amount}
                onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="What was this expense for?"
                value={newExpense.description}
                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select 
                value={newExpense.category} 
                onValueChange={(v) => setNewExpense({ ...newExpense, category: v as ExpenseCategory })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Vendor (optional)</label>
                <Input
                  placeholder="Vendor name"
                  value={newExpense.vendor}
                  onChange={e => setNewExpense({ ...newExpense, vendor: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Receipt # (optional)</label>
                <Input
                  placeholder="Receipt number"
                  value={newExpense.receiptNumber}
                  onChange={e => setNewExpense({ ...newExpense, receiptNumber: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseModalOpen(false)}>Cancel</Button>
            <Button className="gradient-primary" onClick={handleAddExpense}>Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Drawer Modal */}
      <Dialog open={cashDrawerModalOpen} onOpenChange={setCashDrawerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{currentSession ? 'Close Cash Drawer' : 'Open Cash Drawer'}</DialogTitle>
          </DialogHeader>
          {currentSession ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Opening Balance</span>
                  <span className="font-medium">रू {currentSession.openingBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Opened By</span>
                  <span>{currentSession.openedBy}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Opened At</span>
                  <span>{formatNepalDateTime(currentSession.openedAt)}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Closing Balance (रू)</label>
                <Input
                  type="number"
                  placeholder="Count the cash in drawer"
                  value={closingBalance}
                  onChange={e => setClosingBalance(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <Textarea
                  placeholder="Any notes about discrepancies..."
                  value={closingNotes}
                  onChange={e => setClosingNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the amount of cash currently in the drawer to start a new session.
              </p>
              <div>
                <label className="text-sm font-medium">Opening Balance (रू)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={openingBalance}
                  onChange={e => setOpeningBalance(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashDrawerModalOpen(false)}>Cancel</Button>
            {currentSession ? (
              <Button variant="destructive" onClick={handleCloseDrawer}>Close Drawer</Button>
            ) : (
              <Button className="gradient-primary" onClick={handleOpenDrawer}>Open Drawer</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monthly Report Generator */}
      <MonthlyReportGenerator open={reportModalOpen} onOpenChange={setReportModalOpen} />
    </div>
  );
}