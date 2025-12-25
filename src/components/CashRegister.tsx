import { useState, memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Calculator, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { formatNepalDateTime } from '@/lib/nepalTime';
import { toast } from 'sonner';

interface CashRegisterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todayRevenue: number;
  todayExpenses: number;
  cashPayments: number;
  fonepayPayments: number;
}

const CashRegister = memo(function CashRegister({
  open,
  onOpenChange,
  todayRevenue,
  todayExpenses,
  cashPayments,
  fonepayPayments,
}: CashRegisterProps) {
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerOpenTime, setRegisterOpenTime] = useState<string>('');

  const expectedCash = (parseFloat(openingBalance) || 0) + cashPayments - todayExpenses;
  const totalInRegister = cashPayments + fonepayPayments;

  const handleOpenRegister = () => {
    if (!openingBalance || parseFloat(openingBalance) < 0) {
      toast.error('Please enter a valid opening balance');
      return;
    }
    setIsRegisterOpen(true);
    setRegisterOpenTime(new Date().toISOString());
    toast.success('Cash register opened');
  };

  const handleCloseRegister = () => {
    setIsRegisterOpen(false);
    toast.success('Cash register closed');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Daily Cash Register
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isRegisterOpen ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Opening Balance</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">रू</span>
                  <Input
                    type="number"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="pl-8"
                    placeholder="0"
                  />
                </div>
              </div>
              <Button onClick={handleOpenRegister} className="w-full">
                Open Register
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Register Status */}
              <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-success">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Register Open</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {registerOpenTime && formatNepalDateTime(new Date(registerOpenTime))}
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <div className="text-xs text-muted-foreground mb-1">Opening</div>
                  <div className="text-lg font-bold">रू{parseFloat(openingBalance).toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-success/10">
                  <div className="text-xs text-success mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Cash In
                  </div>
                  <div className="text-lg font-bold text-success">रू{cashPayments.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-destructive/10">
                  <div className="text-xs text-destructive mb-1 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Cash Out
                  </div>
                  <div className="text-lg font-bold text-destructive">रू{todayExpenses.toLocaleString()}</div>
                </div>
                <div className="p-3 rounded-xl bg-primary/10">
                  <div className="text-xs text-primary mb-1 flex items-center gap-1">
                    <Calculator className="w-3 h-3" /> Expected
                  </div>
                  <div className="text-lg font-bold text-primary">रू{expectedCash.toLocaleString()}</div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="p-4 rounded-xl border bg-card">
                <h4 className="font-semibold mb-3">Payment Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cash Payments</span>
                    <span className="font-medium">रू{cashPayments.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fonepay Payments</span>
                    <span className="font-medium">रू{fonepayPayments.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                    <span>Total Revenue</span>
                    <span className="text-primary">रू{todayRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {isRegisterOpen && (
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseRegister}>
              Close Register
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
});

export { CashRegister };
