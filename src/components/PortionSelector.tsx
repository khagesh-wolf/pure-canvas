import { useStore } from '@/store/useStore';
import { MenuItem, PortionOption } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Plus, Check } from 'lucide-react';
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
  
  // Track which portions were just added (for visual feedback)
  const [addedPortions, setAddedPortions] = useState<Record<string, boolean>>({});
  
  // Get the inventory item for unit display
  const invItem = getInventoryByMenuItemId(item.id);
  
  // Filter out portions without prices
  const portionsWithPrices = portions.filter(p => p.fixedPrice != null);

  // Reset added state when dialog closes
  useEffect(() => {
    if (!open) {
      setAddedPortions({});
    }
  }, [open]);

  if (portionsWithPrices.length === 0) return null;

  const handleAddPortion = (portion: PortionOption, price: number) => {
    onSelect(item, portion, price);
    // Show visual feedback
    setAddedPortions(prev => ({ ...prev, [portion.id]: true }));
    // Reset after animation
    setTimeout(() => {
      setAddedPortions(prev => ({ ...prev, [portion.id]: false }));
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden z-[100]">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold">{item.name}</DialogTitle>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">Tap to add portions to cart</p>
        </DialogHeader>
        
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {portionsWithPrices
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(portion => {
              const price = portion.fixedPrice!;
              const justAdded = addedPortions[portion.id];
              return (
                <button
                  key={portion.id}
                  onClick={() => handleAddPortion(portion, price)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98] ${
                    justAdded 
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30' 
                      : 'border-border bg-card hover:bg-muted/50 hover:border-primary/50'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-semibold text-foreground">{portion.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {portion.size} {invItem?.unit || 'units'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold text-primary">
                      Rs {price}
                    </div>
                    {justAdded ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Plus className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
        </div>
        
        <div className="p-4 pt-2 border-t border-border">
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
