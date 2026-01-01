import { useStore } from '@/store/useStore';
import { MenuItem, PortionOption } from '@/types';
import { Plus, Minus, ShoppingBag, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface PortionSelectorProps {
  item: MenuItem;
  open: boolean;
  onClose: () => void;
  onSelect: (item: MenuItem, portion: PortionOption, price: number) => void;
  existingCartQty?: Record<string, number>; // Track quantities already in cart per portion
}

export function PortionSelector({ item, open, onClose, onSelect, existingCartQty = {} }: PortionSelectorProps) {
  const { getPortionsByItem, getInventoryByMenuItemId } = useStore();
  const portions = getPortionsByItem(item.id);
  
  // Track quantities for each portion
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  // Get the inventory item for unit display and stock checking
  const invItem = getInventoryByMenuItemId(item.id);
  
  // Filter out portions without prices
  const portionsWithPrices = portions.filter(p => p.fixedPrice != null);

  // Reset quantities when dialog closes
  useEffect(() => {
    if (!open) {
      setQuantities({});
    }
  }, [open]);

  // Calculate available stock for a specific portion
  const getAvailablePortions = useCallback((portion: PortionOption): number | null => {
    if (!invItem) return null; // Not tracked in inventory - unlimited
    
    const currentStock = invItem.currentStock;
    
    // Calculate total units already in cart (including from existing cart and current selection)
    const existingInCart = Object.entries(existingCartQty).reduce((sum, [portionId, qty]) => {
      const p = portionsWithPrices.find(port => port.id === portionId);
      return sum + (p ? p.size * qty : 0);
    }, 0);
    
    // Calculate total units in current selection (excluding this portion)
    const currentSelectionUnits = portionsWithPrices.reduce((sum, p) => {
      if (p.id === portion.id) return sum;
      return sum + (quantities[p.id] || 0) * p.size;
    }, 0);
    
    const availableUnits = currentStock - existingInCart - currentSelectionUnits;
    
    if (portion.size > 0) {
      return Math.floor(availableUnits / portion.size);
    }
    return Math.floor(availableUnits);
  }, [invItem, existingCartQty, quantities, portionsWithPrices]);

  if (!open || portionsWithPrices.length === 0) return null;

  const getQuantity = (portionId: string) => quantities[portionId] || 0;

  const incrementQuantity = (portionId: string) => {
    const portion = portionsWithPrices.find(p => p.id === portionId);
    if (!portion) return;
    
    const available = getAvailablePortions(portion);
    const currentQty = getQuantity(portionId);
    
    if (available !== null && currentQty >= available) {
      toast.error(`Only ${available} ${portion.name} available in stock`);
      return;
    }
    
    setQuantities(prev => ({ ...prev, [portionId]: currentQty + 1 }));
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
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {portionsWithPrices
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map(portion => {
                const price = portion.fixedPrice!;
                const qty = getQuantity(portion.id);
                const isSelected = qty > 0;
                const available = getAvailablePortions(portion);
                const isOutOfStock = available !== null && available <= 0 && qty === 0;
                const isAtLimit = available !== null && qty >= available;
                
                return (
                  <div
                    key={portion.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      isOutOfStock
                        ? 'border-destructive/30 bg-destructive/5 opacity-60'
                        : isSelected 
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
                        {isOutOfStock && (
                          <span className="text-xs text-destructive px-2 py-0.5 bg-destructive/10 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Out of stock
                          </span>
                        )}
                        {available !== null && available > 0 && available <= 5 && (
                          <span className="text-xs text-amber-600 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                            Only {available} left
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-bold text-primary mt-1">
                        Rs {price}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {isOutOfStock ? (
                        <span className="text-sm text-destructive font-medium px-3">Unavailable</span>
                      ) : qty > 0 ? (
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
                            disabled={isAtLimit}
                            className={`w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                              isAtLimit 
                                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
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
