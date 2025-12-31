import { useStore } from '@/store/useStore';
import { MenuItem, PortionOption } from '@/types';
import { Plus, Minus, ShoppingBag } from 'lucide-react';
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

  if (!open || portionsWithPrices.length === 0) return null;

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
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-[2000] transition-opacity"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[2001] animate-slide-up">
        <div className="bg-card rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.2)] max-h-[85vh] flex flex-col">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>
          
          {/* Header */}
          <div className="px-5 pb-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">{item.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">Choose portion size & quantity</p>
          </div>
          
          {/* Portions List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {portionsWithPrices
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(portion => {
                const price = portion.fixedPrice!;
                const qty = getQuantity(portion.id);
                const isSelected = qty > 0;
                return (
                  <div
                    key={portion.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border bg-background hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{portion.name}</span>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                          {portion.size} {invItem?.unit || 'units'}
                        </span>
                      </div>
                      <div className="text-lg font-bold text-primary mt-1">
                        Rs {price}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {qty > 0 ? (
                        <>
                          <button
                            onClick={() => decrementQuantity(portion.id)}
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span className="w-10 text-center font-bold text-lg text-foreground">{qty}</span>
                          <button
                            onClick={() => incrementQuantity(portion.id)}
                            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => incrementQuantity(portion.id)}
                          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-border bg-card safe-area-bottom">
            {totalItems > 0 ? (
              <button 
                onClick={handleAddToCart}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-3 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
              >
                <ShoppingBag className="w-5 h-5" />
                <span>Add {totalItems} to Cart</span>
                <span className="bg-primary-foreground/20 px-3 py-1 rounded-full text-sm">
                  Rs {totalPrice}
                </span>
              </button>
            ) : (
              <button 
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-muted text-muted-foreground font-semibold text-lg hover:bg-muted/80 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .safe-area-bottom {
          padding-bottom: max(1rem, env(safe-area-inset-bottom));
        }
      `}</style>
    </>
  );
}
