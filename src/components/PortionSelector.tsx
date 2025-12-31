import { useStore } from '@/store/useStore';
import { MenuItem, PortionOption } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Plus, Minus } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PortionSelectorProps {
  item: MenuItem;
  open: boolean;
  onClose: () => void;
  onSelect: (item: MenuItem, portion: PortionOption, price: number) => void;
}

export function PortionSelector({ item, open, onClose, onSelect }: PortionSelectorProps) {
  const { getPortionsByItem, getInventoryByMenuItemId } = useStore();
  const portions = getPortionsByItem(item.id);
  
  // Track quantities for each portion
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  // Get the inventory item for unit display
  const invItem = getInventoryByMenuItemId(item.id);
  
  // Filter out portions without prices
  const portionsWithPrices = portions.filter(p => p.fixedPrice != null);

  // Reset quantities when dialog closes
  useEffect(() => {
    if (!open) {
      setQuantities({});
    }
  }, [open]);

  if (portionsWithPrices.length === 0) return null;

  const getQuantity = (portionId: string) => quantities[portionId] || 0;

  const incrementQuantity = (portionId: string) => {
    setQuantities(prev => ({ ...prev, [portionId]: (prev[portionId] || 0) + 1 }));
  };

  const decrementQuantity = (portionId: string) => {
    setQuantities(prev => {
      const current = prev[portionId] || 0;
      if (current <= 0) return prev;
      return { ...prev, [portionId]: current - 1 };
    });
  };

  const handleAddToCart = () => {
    // Add each portion the specified number of times
    portionsWithPrices.forEach(portion => {
      const qty = getQuantity(portion.id);
      const price = portion.fixedPrice!;
      for (let i = 0; i < qty; i++) {
        onSelect(item, portion, price);
      }
    });
    onClose();
  };

  const totalItems = Object.values(quantities).reduce((sum, q) => sum + q, 0);
  const totalPrice = portionsWithPrices.reduce((sum, portion) => {
    return sum + (getQuantity(portion.id) * (portion.fixedPrice || 0));
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden z-[2000]">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">{item.name}</DialogTitle>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Select quantity for each portion</p>
        </DialogHeader>
        
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {portionsWithPrices
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(portion => {
              const price = portion.fixedPrice!;
              const qty = getQuantity(portion.id);
              return (
                <div
                  key={portion.id}
                  className="w-full flex items-center justify-between p-4 rounded-xl border border-border bg-card"
                >
                  <div className="text-left flex-1">
                    <div className="font-semibold text-foreground">{portion.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {portion.size} {invItem?.unit || 'units'}
                    </div>
                    <div className="text-sm font-bold text-primary mt-1">
                      Rs {price}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decrementQuantity(portion.id)}
                      disabled={qty === 0}
                      className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted/80 active:scale-95 transition-all"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold text-lg">{qty}</span>
                    <button
                      onClick={() => incrementQuantity(portion.id)}
                      className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
        
        <div className="p-4 pt-2 border-t border-border space-y-3">
          {totalItems > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{totalItems} item{totalItems > 1 ? 's' : ''}</span>
              <span className="font-bold text-foreground">Rs {totalPrice}</span>
            </div>
          )}
          <button 
            onClick={handleAddToCart}
            disabled={totalItems === 0}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {totalItems > 0 ? `Add ${totalItems} to Cart` : 'Select Portions'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
