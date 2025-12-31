import { useState, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  FileText, Download, Calendar, TrendingUp, TrendingDown, 
  DollarSign, ShoppingBag, Receipt, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { getTransactionDateInNepal, formatNepalDateTime } from '@/lib/nepalTime';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExpenseCategory } from '@/types';

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ingredients: 'Ingredients',
  utilities: 'Utilities',
  salary: 'Salary',
  maintenance: 'Maintenance',
  rent: 'Rent',
  marketing: 'Marketing',
  equipment: 'Equipment',
  other: 'Other'
};

interface MonthlyReportGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonthlyReportGenerator({ open, onOpenChange }: MonthlyReportGeneratorProps) {
  const { transactions, expenses, menuItems, settings, cashDrawerSessions } = useStore();
  
  // Get available months from transactions
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const date = new Date(t.paidAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    expenses.forEach(e => {
      const date = new Date(e.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthKey);
    });
    return Array.from(months).sort().reverse();
  }, [transactions, expenses]);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // Get report data for selected month
  const reportData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Filter transactions for the month
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.paidAt);
      return date >= startDate && date <= endDate;
    });

    // Filter expenses for the month
    const monthExpenses = expenses.filter(e => {
      const date = new Date(e.createdAt);
      return date >= startDate && date <= endDate;
    });

    // Calculate totals
    const totalRevenue = monthTransactions.reduce((sum, t) => sum + t.total, 0);
    const totalDiscount = monthTransactions.reduce((sum, t) => sum + t.discount, 0);
    const grossRevenue = totalRevenue + totalDiscount;
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    // Payment method breakdown
    const cashSales = monthTransactions
      .filter(t => t.paymentMethod === 'cash' || t.paymentMethod === 'split')
      .reduce((sum, t) => {
        if (t.paymentMethod === 'split' && t.splitDetails) {
          return sum + t.splitDetails.cashAmount;
        }
        return sum + t.total;
      }, 0);

    const digitalSales = monthTransactions
      .filter(t => t.paymentMethod === 'fonepay' || t.paymentMethod === 'split')
      .reduce((sum, t) => {
        if (t.paymentMethod === 'split' && t.splitDetails) {
          return sum + t.splitDetails.fonepayAmount;
        }
        return sum + t.total;
      }, 0);

    // Expense breakdown by category
    const expenseByCategory: Record<ExpenseCategory, number> = {
      ingredients: 0, utilities: 0, salary: 0, maintenance: 0,
      rent: 0, marketing: 0, equipment: 0, other: 0
    };
    monthExpenses.forEach(e => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
    });

    // Daily breakdown
    const dailyData: Record<string, { revenue: number; expenses: number; orders: number }> = {};
    monthTransactions.forEach(t => {
      const day = getTransactionDateInNepal(t.paidAt);
      if (!dailyData[day]) dailyData[day] = { revenue: 0, expenses: 0, orders: 0 };
      dailyData[day].revenue += t.total;
      dailyData[day].orders += 1;
    });
    monthExpenses.forEach(e => {
      const day = getTransactionDateInNepal(e.createdAt);
      if (!dailyData[day]) dailyData[day] = { revenue: 0, expenses: 0, orders: 0 };
      dailyData[day].expenses += e.amount;
    });

    // Item sales breakdown
    const itemSales: Record<string, { qty: number; revenue: number; category: string }> = {};
    monthTransactions.forEach(t => {
      t.items.forEach(item => {
        if (!itemSales[item.name]) {
          const menuItem = menuItems.find(m => m.name === item.name);
          itemSales[item.name] = { qty: 0, revenue: 0, category: menuItem?.category || 'Other' };
        }
        itemSales[item.name].qty += item.qty;
        itemSales[item.name].revenue += item.price * item.qty;
      });
    });

    // Category sales breakdown
    const categorySales: Record<string, number> = {};
    Object.entries(itemSales).forEach(([_, data]) => {
      categorySales[data.category] = (categorySales[data.category] || 0) + data.revenue;
    });

    // Cash drawer sessions for the month
    const monthCashSessions = cashDrawerSessions.filter(s => {
      const date = new Date(s.openedAt);
      return date >= startDate && date <= endDate;
    });

    return {
      month: selectedMonth,
      monthName: startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      daysInMonth: endDate.getDate(),
      totalOrders: monthTransactions.length,
      grossRevenue,
      totalDiscount,
      totalRevenue,
      totalExpenses,
      netProfit,
      cashSales,
      digitalSales,
      expenseByCategory,
      dailyData: Object.entries(dailyData).sort((a, b) => a[0].localeCompare(b[0])),
      itemSales: Object.entries(itemSales).sort((a, b) => b[1].revenue - a[1].revenue),
      categorySales: Object.entries(categorySales).sort((a, b) => b[1] - a[1]),
      transactions: monthTransactions,
      expenses: monthExpenses,
      cashSessions: monthCashSessions
    };
  }, [selectedMonth, transactions, expenses, menuItems, cashDrawerSessions]);

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text(settings.restaurantName || 'Restaurant', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Monthly Financial Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
      
      doc.setFontSize(12);
      doc.text(reportData.monthName, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Generated on: ${formatNepalDateTime(new Date())}`, pageWidth / 2, yPos, { align: 'center' });
      doc.setTextColor(0);
      yPos += 12;

      // Summary Section
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIAL SUMMARY', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Description', 'Amount (NPR)']],
        body: [
          ['Gross Revenue (before discounts)', `Rs. ${reportData.grossRevenue.toLocaleString()}`],
          ['Total Discounts Given', `(Rs. ${reportData.totalDiscount.toLocaleString()})`],
          ['Net Revenue', `Rs. ${reportData.totalRevenue.toLocaleString()}`],
          ['Total Expenses', `(Rs. ${reportData.totalExpenses.toLocaleString()})`],
          ['Net Profit/Loss', `Rs. ${reportData.netProfit.toLocaleString()}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [6, 193, 103], textColor: 255 },
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } },
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Payment Methods
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT METHODS BREAKDOWN', 14, yPos);
      yPos += 8;

      autoTable(doc, {
        startY: yPos,
        head: [['Payment Method', 'Amount (NPR)', 'Percentage']],
        body: [
          ['Cash Payments', `Rs. ${reportData.cashSales.toLocaleString()}`, 
           `${reportData.totalRevenue > 0 ? ((reportData.cashSales / reportData.totalRevenue) * 100).toFixed(1) : 0}%`],
          ['Digital Payments (Fonepay)', `Rs. ${reportData.digitalSales.toLocaleString()}`,
           `${reportData.totalRevenue > 0 ? ((reportData.digitalSales / reportData.totalRevenue) * 100).toFixed(1) : 0}%`],
          ['Total', `Rs. ${reportData.totalRevenue.toLocaleString()}`, '100%'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Expense Breakdown
      doc.setFont('helvetica', 'bold');
      doc.text('EXPENSE BREAKDOWN BY CATEGORY', 14, yPos);
      yPos += 8;

      const expenseRows = Object.entries(reportData.expenseByCategory)
        .filter(([_, amount]) => amount > 0)
        .map(([category, amount]) => [
          EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] || category,
          `Rs. ${amount.toLocaleString()}`,
          `${reportData.totalExpenses > 0 ? ((amount / reportData.totalExpenses) * 100).toFixed(1) : 0}%`
        ]);

      if (expenseRows.length > 0) {
        expenseRows.push(['Total Expenses', `Rs. ${reportData.totalExpenses.toLocaleString()}`, '100%']);
        
        autoTable(doc, {
          startY: yPos,
          head: [['Category', 'Amount (NPR)', 'Percentage']],
          body: expenseRows,
          theme: 'striped',
          headStyles: { fillColor: [239, 68, 68], textColor: 255 },
          styles: { fontSize: 10 },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('No expenses recorded for this month.', 14, yPos);
        yPos += 10;
      }

      // Check if we need a new page
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      // Category Sales Breakdown
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('SALES BY MENU CATEGORY', 14, yPos);
      yPos += 8;

      if (reportData.categorySales.length > 0) {
        const categoryRows = reportData.categorySales.map(([category, revenue]) => [
          category,
          `Rs. ${revenue.toLocaleString()}`,
          `${reportData.totalRevenue > 0 ? ((revenue / reportData.totalRevenue) * 100).toFixed(1) : 0}%`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Category', 'Revenue (NPR)', 'Percentage']],
          body: categoryRows,
          theme: 'striped',
          headStyles: { fillColor: [139, 92, 246], textColor: 255 },
          styles: { fontSize: 10 },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      // New page for detailed data
      doc.addPage();
      yPos = 20;

      // Top Selling Items
      doc.setFont('helvetica', 'bold');
      doc.text('TOP SELLING ITEMS', 14, yPos);
      yPos += 8;

      if (reportData.itemSales.length > 0) {
        const topItems = reportData.itemSales.slice(0, 15).map(([name, data]) => [
          name,
          data.category,
          data.qty.toString(),
          `Rs. ${data.revenue.toLocaleString()}`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Item Name', 'Category', 'Qty Sold', 'Revenue (NPR)']],
          body: topItems,
          theme: 'striped',
          headStyles: { fillColor: [6, 193, 103], textColor: 255 },
          styles: { fontSize: 9 },
          columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' } },
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      // Check if we need a new page
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      // Daily Summary
      doc.setFont('helvetica', 'bold');
      doc.text('DAILY SUMMARY', 14, yPos);
      yPos += 8;

      if (reportData.dailyData.length > 0) {
        const dailyRows = reportData.dailyData.map(([date, data]) => [
          date,
          data.orders.toString(),
          `Rs. ${data.revenue.toLocaleString()}`,
          `Rs. ${data.expenses.toLocaleString()}`,
          `Rs. ${(data.revenue - data.expenses).toLocaleString()}`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Orders', 'Revenue', 'Expenses', 'Net']],
          body: dailyRows,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          styles: { fontSize: 8 },
          columnStyles: { 
            1: { halign: 'center' }, 
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
          },
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      // New page for expense details
      if (reportData.expenses.length > 0) {
        doc.addPage();
        yPos = 20;

        doc.setFont('helvetica', 'bold');
        doc.text('DETAILED EXPENSE LOG', 14, yPos);
        yPos += 8;

        const expenseDetailRows = reportData.expenses.map(e => [
          getTransactionDateInNepal(e.createdAt),
          e.description,
          EXPENSE_CATEGORY_LABELS[e.category] || e.category,
          e.vendor || '-',
          `Rs. ${e.amount.toLocaleString()}`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Description', 'Category', 'Vendor', 'Amount']],
          body: expenseDetailRows,
          theme: 'striped',
          headStyles: { fillColor: [239, 68, 68], textColor: 255 },
          styles: { fontSize: 8 },
          columnStyles: { 4: { halign: 'right' } },
        });
      }

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
          `Page ${i} of ${pageCount} | ${settings.restaurantName} | Tax Report - ${reportData.monthName}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Save the PDF
      const fileName = `${settings.restaurantName?.replace(/\s+/g, '_') || 'Restaurant'}_Report_${selectedMonth}.pdf`;
      doc.save(fileName);

      toast.success('Report generated successfully!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Monthly Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month Selection */}
          <div>
            <label className="text-sm font-medium">Select Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(month => (
                  <SelectItem key={month} value={month}>
                    {formatMonthLabel(month)}
                  </SelectItem>
                ))}
                {!availableMonths.includes(selectedMonth) && (
                  <SelectItem value={selectedMonth}>
                    {formatMonthLabel(selectedMonth)} (Current)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Report Preview */}
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm">Report Preview: {reportData.monthName}</h4>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Orders:</span>
                <span className="font-medium">{reportData.totalOrders}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-muted-foreground">Revenue:</span>
                <span className="font-medium">रू {reportData.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                <span className="text-muted-foreground">Expenses:</span>
                <span className="font-medium">रू {reportData.totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className={`w-4 h-4 ${reportData.netProfit >= 0 ? 'text-success' : 'text-destructive'}`} />
                <span className="text-muted-foreground">Net:</span>
                <span className={`font-medium ${reportData.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  रू {reportData.netProfit.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              <p>Report includes:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Financial summary with profit/loss</li>
                <li>Payment method breakdown</li>
                <li>Expense breakdown by category</li>
                <li>Sales by menu category</li>
                <li>Top selling items</li>
                <li>Daily summary</li>
                <li>Detailed expense log</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            className="gradient-primary" 
            onClick={generatePDF}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>Generating...</>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}