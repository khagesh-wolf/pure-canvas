import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, AlertTriangle, TrendingDown, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { InventoryUnitType } from '@/types';

const UNIT_OPTIONS: { value: InventoryUnitType; label: string }[] = [
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'bottle', label: 'Bottles' },
  { value: 'pack', label: 'Packs' },
];

const DEFAULT_PORTIONS: Record<string, { name: string; size: number; multiplier: number }[]> = {
  ml: [
    { name: '30ml (Peg)', size: 30, multiplier: 0.5 },
    { name: '60ml (Large)', size: 60, multiplier: 1 },
    { name: '90ml', size: 90, multiplier: 1.5 },
    { name: '180ml (QTR)', size: 180, multiplier: 2.8 },
    { name: '375ml (Half)', size: 375, multiplier: 5.5 },
    { name: '750ml (Full)', size: 750, multiplier: 10 },
  ],
  pcs: [
    { name: '1 Piece', size: 1, multiplier: 1 },
    { name: 'Pack (20)', size: 20, multiplier: 18 },
  ],
};

export function InventoryManager() {
  const { 
    categories, menuItems, inventoryCategories, inventoryItems, portionOptions, lowStockItems,
    addInventoryCategory, deleteInventoryCategory, addInventoryItem, updateInventoryItem,
    deleteInventoryItem, addStock, addPortionOption, deletePortionOption, getInventoryByMenuItemId
  } = useStore();

  const [activeTab, setActiveTab] = useState('stock');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnitType>('pcs');
  const [containerSize, setContainerSize] = useState('750');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  
  const [stockMenuItemId, setStockMenuItemId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockNotes, setStockNotes] = useState('');

  // Categories with inventory tracking
  const trackedCategories = categories.filter(c => 
    inventoryCategories.some(ic => ic.categoryId === c.id)
  );

  // Menu items with inventory
  const inventoryMenuItems = menuItems.filter(m => 
    inventoryItems.some(ii => ii.menuItemId === m.id)
  );

  const handleAddInventoryCategory = () => {
    if (!selectedCategory) {
      toast.error('Select a category');
      return;
    }

    const cat = categories.find(c => c.id === selectedCategory);
    if (!cat) return;

    addInventoryCategory({
      categoryId: selectedCategory,
      unitType: selectedUnit,
      defaultContainerSize: selectedUnit === 'ml' ? parseFloat(containerSize) : undefined,
      lowStockThreshold: parseFloat(lowStockThreshold),
    });

    // Add default portions for this category
    const newInvCat = useStore.getState().inventoryCategories.find(ic => ic.categoryId === selectedCategory);
    if (newInvCat) {
      const defaultPortions = DEFAULT_PORTIONS[selectedUnit] || DEFAULT_PORTIONS.pcs;
      defaultPortions.forEach((p, i) => {
        addPortionOption({
          inventoryCategoryId: newInvCat.id,
          name: p.name,
          size: p.size,
          priceMultiplier: p.multiplier,
          sortOrder: i,
        });
      });
    }

    // Create inventory items for all menu items in this category
    const itemsInCategory = menuItems.filter(m => m.category === cat.name);
    itemsInCategory.forEach(item => {
      addInventoryItem({
        menuItemId: item.id,
        currentStock: 0,
        containerSize: selectedUnit === 'ml' ? parseFloat(containerSize) : undefined,
        unit: selectedUnit,
        lowStockThreshold: parseFloat(lowStockThreshold),
      });
    });

    toast.success(`${cat.name} added to inventory tracking`);
    setShowAddCategoryModal(false);
    setSelectedCategory('');
  };

  const handleAddStock = () => {
    if (!stockMenuItemId || !stockQuantity) {
      toast.error('Select item and enter quantity');
      return;
    }

    const invItem = getInventoryByMenuItemId(stockMenuItemId);
    if (!invItem) {
      toast.error('Item not tracked in inventory');
      return;
    }

    addStock(stockMenuItemId, parseFloat(stockQuantity), invItem.unit, stockNotes);
    toast.success('Stock added successfully');
    setShowAddStockModal(false);
    setStockMenuItemId('');
    setStockQuantity('');
    setStockNotes('');
  };

  const handleRemoveCategory = (catId: string) => {
    if (!confirm('Remove this category from inventory tracking? All stock data will be lost.')) return;
    
    const invCat = inventoryCategories.find(ic => ic.categoryId === catId);
    if (invCat) {
      // Delete portion options
      portionOptions.filter(p => p.inventoryCategoryId === invCat.id).forEach(p => {
        deletePortionOption(p.id);
      });
      
      // Delete inventory items
      const cat = categories.find(c => c.id === catId);
      if (cat) {
        const itemsInCat = menuItems.filter(m => m.category === cat.name);
        itemsInCat.forEach(item => {
          const invItem = inventoryItems.find(ii => ii.menuItemId === item.id);
          if (invItem) deleteInventoryItem(invItem.id);
        });
      }
      
      deleteInventoryCategory(invCat.id);
    }
    toast.success('Category removed from inventory');
  };

  // Categories not yet tracked
  const unTrackedCategories = categories.filter(c => 
    !inventoryCategories.some(ic => ic.categoryId === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-warning bg-warning/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-warning flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Low Stock Alerts ({lowStockItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(item => (
                <Badge key={item.inventoryItemId} variant="outline" className="bg-warning/20">
                  {item.menuItemName}: {item.currentStock} {item.unit}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="stock">Stock Entry</TabsTrigger>
          <TabsTrigger value="items">Inventory</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Stock Entry Tab */}
        <TabsContent value="stock" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Add Stock</h3>
            <Button onClick={() => setShowAddStockModal(true)} disabled={inventoryMenuItems.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> Add Stock
            </Button>
          </div>

          {inventoryMenuItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No items tracked in inventory yet.</p>
                <p className="text-sm">Go to Settings tab to add categories.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inventoryMenuItems.map(item => {
                const invItem = inventoryItems.find(ii => ii.menuItemId === item.id);
                if (!invItem) return null;
                const isLow = invItem.currentStock <= (invItem.lowStockThreshold || 5);
                
                return (
                  <Card key={item.id} className={isLow ? 'border-warning' : ''}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">{item.category}</p>
                        </div>
                        {isLow && <AlertTriangle className="w-5 h-5 text-warning" />}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`text-2xl font-bold ${isLow ? 'text-warning' : ''}`}>
                          {invItem.currentStock}
                        </span>
                        <span className="text-muted-foreground">{invItem.unit}</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full mt-3"
                        onClick={() => {
                          setStockMenuItemId(item.id);
                          setShowAddStockModal(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Stock
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Inventory Items Tab */}
        <TabsContent value="items" className="space-y-4">
          <h3 className="text-lg font-semibold">Current Inventory</h3>
          
          {trackedCategories.map(cat => {
            const invCat = inventoryCategories.find(ic => ic.categoryId === cat.id);
            const itemsInCat = menuItems.filter(m => m.category === cat.name);
            
            return (
              <Card key={cat.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span>{cat.name}</span>
                    <Badge variant="outline">{invCat?.unitType}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {itemsInCat.map(item => {
                      const invItem = inventoryItems.find(ii => ii.menuItemId === item.id);
                      if (!invItem) return null;
                      
                      return (
                        <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-0">
                          <span>{item.name}</span>
                          <div className="flex items-center gap-4">
                            <span className={`font-mono ${invItem.currentStock <= (invItem.lowStockThreshold || 5) ? 'text-warning' : ''}`}>
                              {invItem.currentStock} {invItem.unit}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Inventory Categories</h3>
            <Button onClick={() => setShowAddCategoryModal(true)} disabled={unTrackedCategories.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> Add Category
            </Button>
          </div>

          {trackedCategories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Settings2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No categories added to inventory.</p>
                <p className="text-sm">Add a category to start tracking stock.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {trackedCategories.map(cat => {
                const invCat = inventoryCategories.find(ic => ic.categoryId === cat.id);
                const portions = portionOptions.filter(p => p.inventoryCategoryId === invCat?.id);
                
                return (
                  <Card key={cat.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{cat.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Unit: {invCat?.unitType} • Threshold: {invCat?.lowStockThreshold}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {portions.map(p => (
                              <Badge key={p.id} variant="secondary" className="text-xs">
                                {p.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveCategory(cat.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Category Modal */}
      <Dialog open={showAddCategoryModal} onOpenChange={setShowAddCategoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category to Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {unTrackedCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Unit Type</label>
              <Select value={selectedUnit} onValueChange={(v) => setSelectedUnit(v as InventoryUnitType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedUnit === 'ml' && (
              <div>
                <label className="text-sm font-medium">Default Container Size (ml)</label>
                <Input type="number" value={containerSize} onChange={e => setContainerSize(e.target.value)} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Low Stock Threshold</label>
              <Input type="number" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategoryModal(false)}>Cancel</Button>
            <Button onClick={handleAddInventoryCategory}>Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stock Modal */}
      <Dialog open={showAddStockModal} onOpenChange={setShowAddStockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Item</label>
              <Select value={stockMenuItemId} onValueChange={setStockMenuItemId}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {inventoryMenuItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">
                Quantity ({inventoryItems.find(i => i.menuItemId === stockMenuItemId)?.unit || 'units'})
              </label>
              <Input 
                type="number" 
                value={stockQuantity} 
                onChange={e => setStockQuantity(e.target.value)} 
                placeholder="Enter quantity"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input value={stockNotes} onChange={e => setStockNotes(e.target.value)} placeholder="e.g., Received from supplier" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStockModal(false)}>Cancel</Button>
            <Button onClick={handleAddStock}>Add Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}