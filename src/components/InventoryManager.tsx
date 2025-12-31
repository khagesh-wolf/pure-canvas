import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Package, AlertTriangle, Settings2, Trash2, DollarSign, Pencil, X, Layers, History, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { InventoryUnitType, MenuItem, InventoryItem, InventoryTransaction } from '@/types';
import { format } from 'date-fns';
import { PortionPriceEditor } from './PortionPriceEditor';

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
    { name: '1000ml', size: 1000, multiplier: 13.3 },
  ],
  pcs: [
    { name: '1 Piece', size: 1, multiplier: 1 },
    { name: 'Pack (20)', size: 20, multiplier: 18 },
  ],
};

const DEFAULT_BOTTLE_SIZES = [180, 375, 750, 1000];

// Default low stock thresholds by unit type
const DEFAULT_THRESHOLDS: Record<InventoryUnitType, number> = {
  ml: 500,      // 500ml threshold for liquids
  pcs: 5,       // 5 pieces
  grams: 200,   // 200 grams
  bottle: 2,    // 2 bottles
  pack: 2,      // 2 packs
};

export function InventoryManager() {
  const { 
    menuItems, inventoryItems, portionOptions, lowStockItems, inventoryTransactions,
    addInventoryItem, updateInventoryItem, deleteInventoryItem,
    addStock, addPortionOption, deletePortionOption, getInventoryByMenuItemId,
    getPortionsByItem
  } = useStore();

  // Helper to get menu item name from inventory item ID
  const getMenuItemName = (inventoryItemId: string): string => {
    const invItem = inventoryItems.find(ii => ii.id === inventoryItemId);
    if (!invItem) return 'Unknown';
    const menuItem = menuItems.find(m => m.id === invItem.menuItemId);
    return menuItem?.name || 'Unknown';
  };

  // Sort transactions by date (newest first)
  const sortedTransactions = [...inventoryTransactions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const [activeTab, setActiveTab] = useState('stock');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<InventoryUnitType>('pcs');
  const [lowStockThreshold, setLowStockThreshold] = useState(DEFAULT_THRESHOLDS.pcs.toString());
  const [defaultBottleSize, setDefaultBottleSize] = useState('750');
  
  const [stockMenuItemId, setStockMenuItemId] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockNotes, setStockNotes] = useState('');
  const [priceEditorItem, setPriceEditorItem] = useState<MenuItem | null>(null);
  
  // Bottle-based stock entry
  const [bottleCount, setBottleCount] = useState('');
  const [bottleSize, setBottleSize] = useState('750');
  const [customBottleSize, setCustomBottleSize] = useState('');
  
  // Edit bottle size modal
  const [editBottleSizeItemId, setEditBottleSizeItemId] = useState<string | null>(null);
  const [editBottleSizeValue, setEditBottleSizeValue] = useState('');

  // Manage portions modal
  const [portionEditorItem, setPortionEditorItem] = useState<{ menuItem: MenuItem; invItem: InventoryItem } | null>(null);
  const [newPortionName, setNewPortionName] = useState('');
  const [newPortionSize, setNewPortionSize] = useState('');
  const [newPortionPrice, setNewPortionPrice] = useState('');

  // Menu items with inventory tracking - sorted by threshold (low to high)
  const inventoryMenuItems = menuItems
    .filter(m => inventoryItems.some(ii => ii.menuItemId === m.id))
    .sort((a, b) => {
      const invA = inventoryItems.find(ii => ii.menuItemId === a.id);
      const invB = inventoryItems.find(ii => ii.menuItemId === b.id);
      return (invA?.lowStockThreshold || 0) - (invB?.lowStockThreshold || 0);
    });

  // Menu items not yet tracked
  const unTrackedMenuItems = menuItems.filter(m => 
    !inventoryItems.some(ii => ii.menuItemId === m.id)
  );

  // Update threshold when unit changes
  const handleUnitChange = (unit: InventoryUnitType) => {
    setSelectedUnit(unit);
    setLowStockThreshold(DEFAULT_THRESHOLDS[unit].toString());
  };

  const handleAddInventoryItem = () => {
    if (!selectedMenuItem) {
      toast.error('Select a menu item');
      return;
    }

    const item = menuItems.find(m => m.id === selectedMenuItem);
    if (!item) return;

    // Create the inventory item
    addInventoryItem({
      menuItemId: selectedMenuItem,
      currentStock: 0,
      defaultBottleSize: selectedUnit === 'ml' ? parseInt(defaultBottleSize) : undefined,
      unit: selectedUnit,
      lowStockThreshold: parseFloat(lowStockThreshold),
    });

    // Get the newly created inventory item
    setTimeout(() => {
      const newInvItem = useStore.getState().inventoryItems.find(ii => ii.menuItemId === selectedMenuItem);
      if (newInvItem) {
        // Add default portions for this item
        const defaultPortions = DEFAULT_PORTIONS[selectedUnit] || DEFAULT_PORTIONS.pcs;
        defaultPortions.forEach((p, i) => {
          addPortionOption({
            inventoryItemId: newInvItem.id,
            name: p.name,
            size: p.size,
            priceMultiplier: p.multiplier,
            sortOrder: i,
          });
        });
      }
    }, 100);

    toast.success(`${item.name} added to inventory tracking`);
    setShowAddItemModal(false);
    setSelectedMenuItem('');
    setSelectedUnit('pcs');
    setLowStockThreshold(DEFAULT_THRESHOLDS.pcs.toString());
    setDefaultBottleSize('750');
  };

  const handleAddStock = () => {
    if (!stockMenuItemId || (!stockQuantity && !bottleCount)) {
      toast.error('Select item and enter quantity');
      return;
    }

    const invItem = getInventoryByMenuItemId(stockMenuItemId);
    if (!invItem) {
      toast.error('Item not tracked in inventory');
      return;
    }

    // Calculate total quantity
    let totalQuantity = 0;
    if (bottleCount && bottleSize) {
      const size = bottleSize === 'custom' ? parseFloat(customBottleSize) : parseFloat(bottleSize);
      totalQuantity = parseFloat(bottleCount) * size;
    } else if (stockQuantity) {
      totalQuantity = parseFloat(stockQuantity);
    }
    
    if (totalQuantity <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }

    const notes = bottleCount ? `${bottleCount} bottles × ${bottleSize === 'custom' ? customBottleSize : bottleSize}ml` + (stockNotes ? ` - ${stockNotes}` : '') : stockNotes;
    
    addStock(stockMenuItemId, totalQuantity, invItem.unit, notes);
    toast.success('Stock added successfully');
    setShowAddStockModal(false);
    setStockMenuItemId('');
    setStockQuantity('');
    setBottleCount('');
    setBottleSize('750');
    setCustomBottleSize('');
    setStockNotes('');
  };

  const handleRemoveItem = (menuItemId: string) => {
    if (!confirm('Remove this item from inventory tracking? All stock data will be lost.')) return;
    
    const invItem = inventoryItems.find(ii => ii.menuItemId === menuItemId);
    if (invItem) {
      // Delete portion options for this item
      portionOptions.filter(p => p.inventoryItemId === invItem.id).forEach(p => {
        deletePortionOption(p.id);
      });
      
      deleteInventoryItem(invItem.id);
    }
    toast.success('Item removed from inventory');
  };

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
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="stock">Stock Entry</TabsTrigger>
          <TabsTrigger value="items">Inventory</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
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
                <p className="text-sm">Go to Settings tab to add items.</p>
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
          
          {inventoryMenuItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No items in inventory yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {inventoryMenuItems.map(item => {
                const invItem = inventoryItems.find(ii => ii.menuItemId === item.id);
                if (!invItem) return null;
                const portions = getPortionsByItem(item.id);
                const isLow = invItem.currentStock <= (invItem.lowStockThreshold || 5);
                
                return (
                  <Card key={item.id} className={isLow ? 'border-warning' : ''}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{item.name}</h4>
                            <Badge variant="outline">{invItem.unit}</Badge>
                            {isLow && <AlertTriangle className="w-4 h-4 text-warning" />}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.category}</p>
                          {invItem.unit === 'ml' && invItem.defaultBottleSize && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Default bottle: {invItem.defaultBottleSize}ml
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {portions.map(p => (
                              <Badge key={p.id} variant="secondary" className="text-xs">
                                {p.name} {p.fixedPrice ? `- Rs ${p.fixedPrice}` : ''}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-xl font-bold ${isLow ? 'text-warning' : ''}`}>
                            {invItem.currentStock} {invItem.unit}
                          </span>
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setPriceEditorItem(item)}
                            >
                              <DollarSign className="w-4 h-4 mr-1" /> Prices
                            </Button>
                            {invItem.unit === 'ml' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setEditBottleSizeItemId(item.id);
                                  setEditBottleSizeValue(invItem.defaultBottleSize?.toString() || '750');
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" />
              Stock History
            </h3>
            <Badge variant="outline">{sortedTransactions.length} entries</Badge>
          </div>

          {sortedTransactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No stock transactions yet.</p>
                <p className="text-sm">Add stock to see history here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedTransactions.map((tx) => {
                const isPositive = tx.transactionType === 'receive';
                const typeLabels: Record<string, string> = {
                  receive: 'Stock Added',
                  sale: 'Sale',
                  adjustment: 'Adjustment',
                  waste: 'Waste',
                };
                
                return (
                  <Card key={tx.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${isPositive ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                            {isPositive ? (
                              <ArrowUp className="w-4 h-4 text-green-500" />
                            ) : (
                              <ArrowDown className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{getMenuItemName(tx.inventoryItemId)}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={isPositive ? 'default' : 'secondary'} className="text-xs">
                                {typeLabels[tx.transactionType] || tx.transactionType}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(tx.createdAt), 'MMM dd, yyyy • hh:mm a')}
                              </span>
                            </div>
                            {tx.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{tx.notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                            {isPositive ? '+' : '-'}{Math.abs(tx.quantity)} {tx.unit}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Inventory Items</h3>
            <Button onClick={() => setShowAddItemModal(true)} disabled={unTrackedMenuItems.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </div>

          {inventoryMenuItems.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Settings2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No items added to inventory.</p>
                <p className="text-sm">Add items to start tracking stock.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {inventoryMenuItems.map(item => {
                const invItem = inventoryItems.find(ii => ii.menuItemId === item.id);
                if (!invItem) return null;
                const portions = getPortionsByItem(item.id);
                
                return (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {item.category} • Unit: {invItem.unit} • Threshold: {invItem.lowStockThreshold}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {portions.map(p => (
                              <Badge key={p.id} variant="secondary" className="text-xs">
                                {p.name} {p.fixedPrice ? `- Rs ${p.fixedPrice}` : ''}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const inv = inventoryItems.find(ii => ii.menuItemId === item.id);
                              if (inv) setPortionEditorItem({ menuItem: item, invItem: inv });
                            }}
                          >
                            <Layers className="w-4 h-4 mr-1" /> Portions
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setPriceEditorItem(item)}
                          >
                            <DollarSign className="w-4 h-4 mr-1" /> Prices
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Item Modal */}
      <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item to Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Menu Item</label>
              <Select value={selectedMenuItem} onValueChange={setSelectedMenuItem}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {unTrackedMenuItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Unit Type</label>
              <Select value={selectedUnit} onValueChange={(v) => handleUnitChange(v as InventoryUnitType)}>
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
                <label className="text-sm font-medium">Default Bottle Size (ml)</label>
                <Select value={defaultBottleSize} onValueChange={setDefaultBottleSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_BOTTLE_SIZES.map(size => (
                      <SelectItem key={size} value={size.toString()}>{size}ml</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Low Stock Threshold ({selectedUnit})</label>
              <Input type="number" value={lowStockThreshold} onChange={e => setLowStockThreshold(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">
                Default: {DEFAULT_THRESHOLDS[selectedUnit]} {selectedUnit}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItemModal(false)}>Cancel</Button>
            <Button onClick={handleAddInventoryItem}>Add Item</Button>
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
            
            {/* Bottle-based entry for ml items */}
            {inventoryItems.find(i => i.menuItemId === stockMenuItemId)?.unit === 'ml' && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                <label className="text-sm font-medium">Quick Entry: Bottles</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Number of Bottles</label>
                    <Input 
                      type="number" 
                      value={bottleCount} 
                      onChange={e => setBottleCount(e.target.value)} 
                      placeholder="e.g., 3"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Bottle Size (ml)</label>
                    <Select value={bottleSize} onValueChange={setBottleSize}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEFAULT_BOTTLE_SIZES.map(size => (
                          <SelectItem key={size} value={size.toString()}>{size}ml</SelectItem>
                        ))}
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {bottleSize === 'custom' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Custom Size (ml)</label>
                    <Input 
                      type="number" 
                      value={customBottleSize} 
                      onChange={e => setCustomBottleSize(e.target.value)} 
                      placeholder="Enter size"
                    />
                  </div>
                )}
                {bottleCount && bottleSize && (
                  <div className="text-sm text-muted-foreground">
                    Total: {parseFloat(bottleCount || '0') * (bottleSize === 'custom' ? parseFloat(customBottleSize || '0') : parseFloat(bottleSize))}ml
                  </div>
                )}
              </div>
            )}
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or enter manually</span></div>
            </div>
            
            <div>
              <label className="text-sm font-medium">
                Direct Quantity ({inventoryItems.find(i => i.menuItemId === stockMenuItemId)?.unit || 'units'})
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

      {/* Price Editor */}
      {priceEditorItem && (
        <PortionPriceEditor
          menuItem={priceEditorItem}
          open={true}
          onClose={() => setPriceEditorItem(null)}
        />
      )}

      {/* Edit Bottle Size Modal */}
      <Dialog open={!!editBottleSizeItemId} onOpenChange={(open) => !open && setEditBottleSizeItemId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Default Bottle Size</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set the default bottle size for: <strong>{menuItems.find(m => m.id === editBottleSizeItemId)?.name}</strong>
            </p>
            <div>
              <label className="text-sm font-medium">Default Bottle Size (ml)</label>
              <Select value={editBottleSizeValue} onValueChange={setEditBottleSizeValue}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEFAULT_BOTTLE_SIZES.map(size => (
                    <SelectItem key={size} value={size.toString()}>{size}ml</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editBottleSizeValue === 'custom' && (
              <div>
                <label className="text-sm font-medium">Custom Size (ml)</label>
                <Input
                  type="number"
                  value={editBottleSizeValue}
                  onChange={e => setEditBottleSizeValue(e.target.value)}
                  placeholder="Enter size in ml"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBottleSizeItemId(null)}>Cancel</Button>
            <Button onClick={() => {
              if (editBottleSizeItemId) {
                const invItem = inventoryItems.find(ii => ii.menuItemId === editBottleSizeItemId);
                if (invItem) {
                  const size = parseFloat(editBottleSizeValue);
                  if (size > 0) {
                    updateInventoryItem(invItem.id, { defaultBottleSize: size });
                    toast.success('Default bottle size updated');
                  }
                }
              }
              setEditBottleSizeItemId(null);
            }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Portions Modal */}
      <Dialog open={!!portionEditorItem} onOpenChange={(open) => !open && setPortionEditorItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Portions: {portionEditorItem?.menuItem.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add or remove portion sizes for this item. Set prices in the Prices editor.
            </p>
            
            {/* Existing portions */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {portionEditorItem && getPortionsByItem(portionEditorItem.menuItem.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(portion => (
                  <div key={portion.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <div className="font-medium">{portion.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {portion.size} {portionEditorItem.invItem.unit}
                        {portion.fixedPrice ? ` • Rs ${portion.fixedPrice}` : ' • No price set'}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        if (confirm(`Delete portion "${portion.name}"?`)) {
                          deletePortionOption(portion.id);
                          toast.success('Portion deleted');
                        }
                      }}
                    >
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
            </div>

            {/* Add new portion */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Add Custom Portion</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    value={newPortionName}
                    onChange={e => setNewPortionName(e.target.value)}
                    placeholder="e.g., 120ml"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Size ({portionEditorItem?.invItem.unit})</label>
                  <Input
                    type="number"
                    value={newPortionSize}
                    onChange={e => setNewPortionSize(e.target.value)}
                    placeholder="e.g., 120"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Price (Rs)</label>
                  <Input
                    type="number"
                    value={newPortionPrice}
                    onChange={e => setNewPortionPrice(e.target.value)}
                    placeholder="e.g., 300"
                  />
                </div>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={() => {
                  if (!portionEditorItem || !newPortionName || !newPortionSize) {
                    toast.error('Enter name and size');
                    return;
                  }
                  const existingPortions = getPortionsByItem(portionEditorItem.menuItem.id);
                  addPortionOption({
                    inventoryItemId: portionEditorItem.invItem.id,
                    name: newPortionName,
                    size: parseFloat(newPortionSize),
                    priceMultiplier: 1,
                    fixedPrice: newPortionPrice ? parseFloat(newPortionPrice) : undefined,
                    sortOrder: existingPortions.length,
                  });
                  toast.success('Portion added');
                  setNewPortionName('');
                  setNewPortionSize('');
                  setNewPortionPrice('');
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Portion
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPortionEditorItem(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}