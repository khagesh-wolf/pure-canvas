import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { PortionOption, MenuItem } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';

interface PortionPriceEditorProps {
  menuItem: MenuItem;
  open: boolean;
  onClose: () => void;
}

export function PortionPriceEditor({ menuItem, open, onClose }: PortionPriceEditorProps) {
  const { updatePortionOption, getPortionsByItem, getInventoryByMenuItemId } = useStore();
  
  // Get the inventory item for unit display
  const invItem = getInventoryByMenuItemId(menuItem.id);
  const portions = getPortionsByItem(menuItem.id);
  
  // Local state for editing prices
  const [prices, setPrices] = useState<Record<string, string>>({});

  // Initialize prices from store when opening
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      portions.forEach(p => {
        initial[p.id] = p.fixedPrice?.toString() || '';
      });
      setPrices(initial);
    }
  }, [open, menuItem.id, portions]);

  const handleSave = () => {
    let hasChanges = false;
    
    portions.forEach(portion => {
      const priceStr = prices[portion.id];
      const newPrice = priceStr ? parseFloat(priceStr) : undefined;
      
      // Only update if price changed
      if (newPrice !== portion.fixedPrice) {
        updatePortionOption(portion.id, { fixedPrice: newPrice });
        hasChanges = true;
      }
    });

    if (hasChanges) {
      toast.success(`Prices updated for ${menuItem.name}`);
    }
    onClose();
  };

  const handlePriceChange = (portionId: string, value: string) => {
    setPrices(prev => ({ ...prev, [portionId]: value }));
  };

  if (!invItem) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Prices: {menuItem.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Set the price for each portion size. Only portions with prices will be shown to customers.
          </p>
          
          {portions
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(portion => {
              const hasPrice = prices[portion.id] !== '';
              return (
                <div key={portion.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-1">
                    <div className="font-medium">{portion.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {portion.size} {invItem.unit}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rs</span>
                    <Input
                      type="number"
                      value={prices[portion.id]}
                      onChange={(e) => handlePriceChange(portion.id, e.target.value)}
                      placeholder="Price"
                      className="w-24"
                    />
                  </div>
                  {hasPrice && (
                    <Badge variant="secondary" className="text-xs">Set</Badge>
                  )}
                </div>
              );
            })}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" /> Save Prices
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}