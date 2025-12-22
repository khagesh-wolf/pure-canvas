import { useState, useEffect, useSyncExternalStore } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { OrderItem } from '@/types';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Minus, 
  X,
  Menu,
  RefreshCw,
  FileText,
  Check,
  Heart,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { formatNepalTime } from '@/lib/nepalTime';
import { useFavorites } from '@/hooks/useFavorites';
import { useWaitTime } from '@/hooks/useWaitTime';

type Category = 'Tea' | 'Snacks' | 'Cold Drink' | 'Pastry' | 'Favorites';

export default function TableOrder() {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const { menuItems, settings, addOrder, orders, getCustomerPoints, customers } = useStore();
  
  const [phone, setPhone] = useState('');
  const [isPhoneEntered, setIsPhoneEntered] = useState(false);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('Tea');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const table = parseInt(tableNumber || '0');
  
  // Favorites hook
  const { favorites, toggleFavorite, isFavorite } = useFavorites(phone);
  
  // Wait time hook
  const { formatWaitTime, getWaitTimeForNewOrder, queueLength } = useWaitTime();

  // Validate table number
  useEffect(() => {
    if (!table || table < 1 || table > settings.tableCount) {
      toast.error('Invalid table number');
      navigate('/');
    }
  }, [table, settings.tableCount, navigate]);

  const categories: Category[] = ['Favorites', 'Tea', 'Snacks', 'Cold Drink', 'Pastry'];
  
  // Get favorite items
  const favoriteItems = menuItems.filter(item => favorites.includes(item.id) && item.available);
  
  const filteredItems = activeCategory === 'Favorites' 
    ? favoriteItems
    : menuItems.filter(item => item.category === activeCategory && item.available);

  // Calculate estimated wait time for current cart
  const estimatedWait = cart.length > 0 
    ? getWaitTimeForNewOrder(cart.map(c => ({ name: c.name, qty: c.qty })))
    : 0;

  // Get customer's orders for this table - subscribe to orders from store directly for real-time updates
  const storeOrders = useStore(state => state.orders);
  const myOrders = storeOrders.filter(
    o => o.tableNumber === table && o.customerPhone === phone && ['pending', 'accepted'].includes(o.status)
  );
  const totalDue = myOrders.reduce((sum, o) => 
    sum + o.items.reduce((s, i) => s + i.price * i.qty, 0), 0
  );

  // Get customer points
  const customerPoints = phone ? getCustomerPoints(phone) : 0;

  const addToCart = (item: typeof menuItems[0]) => {
    const existing = cart.find(c => c.menuItemId === item.id);
    if (existing) {
      setCart(cart.map(c =>
        c.menuItemId === item.id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setCart([...cart, {
        id: Math.random().toString(36).substring(2, 9),
        menuItemId: item.id,
        name: item.name,
        qty: 1,
        price: item.price,
      }]);
    }
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.menuItemId === menuItemId) {
        const newQty = c.qty + delta;
        return newQty > 0 ? { ...c, qty: newQty } : c;
      }
      return c;
    }).filter(c => c.qty > 0 || cart.find(x => x.menuItemId === menuItemId)?.qty !== 1 || delta !== -1));
    
    // Remove items with qty 0
    setCart(prev => prev.filter(c => {
      const item = prev.find(x => x.menuItemId === menuItemId);
      if (item && item.qty + delta <= 0 && c.menuItemId === menuItemId) {
        return false;
      }
      return true;
    }));
  };

  const getItemQty = (menuItemId: string) => {
    return cart.find(c => c.menuItemId === menuItemId)?.qty || 0;
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setIsPhoneEntered(true);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error('Please add items to your cart');
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    addOrder(table, phone, cart, undefined);
    
    setCart([]);
    setCartModalOpen(false);
    setSuccessModalOpen(true);
    setIsSubmitting(false);
  };

  const scrollToCategory = (cat: Category) => {
    setActiveCategory(cat);
    if (cat === 'Favorites') return; // No scroll for favorites
    const el = document.getElementById(`cat-${cat}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'Pending', color: '#f39c12' };
      case 'accepted': return { text: 'Accepted', color: '#27ae60' };
      case 'preparing': return { text: 'Preparing', color: '#3498db' };
      case 'ready': return { text: 'Ready', color: '#27ae60' };
      case 'served': return { text: 'Served', color: '#27ae60' };
      default: return { text: status, color: '#666' };
    }
  };

  // Phone entry screen (Login Modal Style)
  if (!isPhoneEntered) {
    return (
      <div className="min-h-screen bg-black/50 flex items-end justify-center">
        <div className="bg-white w-full rounded-t-[20px] p-8 animate-slide-up">
          <h2 className="text-2xl font-bold mb-2">Let's start ordering</h2>
          <p className="text-[#666] mb-5">Enter your mobile number to continue.</p>
          <form onSubmit={handlePhoneSubmit}>
            <input
              type="tel"
              placeholder="98XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="w-full p-4 border-2 border-[#eee] rounded-lg text-lg mb-4 outline-none focus:border-[#06C167]"
              maxLength={10}
              autoFocus
            />
            <button
              type="submit"
              disabled={phone.length < 10}
              className="w-full bg-black text-white p-4 rounded-lg text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </form>
          <p className="text-xs text-center text-[#999] mt-6">
            Table {table} • {formatNepalTime(new Date())}
          </p>
        </div>
      </div>
    );
  }

  // Main ordering interface
  return (
    <div className="min-h-screen bg-white pb-24 select-none">
      {/* Header */}
      <header className="grid grid-cols-[auto_1fr_auto] items-center px-4 py-2.5 bg-white sticky top-0 z-[999] shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍵</span>
          <span className="text-lg font-bold tracking-tight text-[#333]">{settings.restaurantName}</span>
        </div>
        
        <div className="justify-self-end flex items-center gap-2">
          <div className="text-sm bg-[#f6f6f6] px-3 py-1.5 rounded-full font-medium">
            Table {table}
          </div>
        </div>

        <div className="justify-self-end flex items-center gap-1 ml-2">
          <button 
            onClick={() => setBillModalOpen(true)}
            className="bg-[#f6f6f6] border border-[#eee] px-3 py-1.5 rounded-full text-sm font-semibold text-[#333] flex items-center gap-1"
          >
            🧾 Bill
          </button>
          <button 
            onClick={() => setDrawerOpen(true)}
            className="text-2xl bg-transparent border-none p-1 ml-1"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[2000] transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      
      {/* Side Drawer */}
      <div className={`fixed top-0 right-0 w-[280px] h-full bg-white z-[2001] transition-transform duration-300 shadow-[-5px_0_15px_rgba(0,0,0,0.1)] flex flex-col ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-5 border-b border-[#eee] flex justify-between items-center">
          <h3 className="font-bold text-lg">My Account</h3>
          <button onClick={() => setDrawerOpen(false)} className="text-2xl">✕</button>
        </div>
        <div className="p-5 flex-1">
          <div className="bg-[#fff8e1] p-4 rounded-xl border border-[#ffe0b2] mb-5">
            <span className="font-bold text-lg block mb-1">{phone}</span>
            <div className="text-[#f39c12] font-semibold flex items-center gap-1">
              ⭐ {customerPoints} Points
            </div>
            <div className="font-semibold text-[#7f8c8d] text-sm mt-2">
              Table {table}
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <button 
              onClick={() => { setBillModalOpen(true); setDrawerOpen(false); }}
              className="w-full bg-[#f6f6f6] border border-[#eee] px-3 py-2 rounded-full text-sm font-semibold text-[#333] flex items-center gap-2 justify-start"
            >
              <FileText className="w-4 h-4" /> View Current Bill
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-[#f6f6f6] border border-[#eee] px-3 py-2 rounded-full text-sm font-semibold text-[#333] flex items-center gap-2 justify-start"
            >
              <RefreshCw className="w-4 h-4" /> Refresh App
            </button>
          </div>
        </div>
        <div className="p-5 bg-[#f9f9f9] border-t border-[#eee] text-sm text-[#666]">
          © {new Date().getFullYear()} {settings.restaurantName}
        </div>
      </div>

      {/* Hero */}
      <div className="h-[100px] bg-gradient-to-b from-black/40 to-black/40 bg-[url('https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&auto=format&fit=crop')] bg-cover bg-center flex items-end p-5">
        <div className="text-white">
          <h2 className="text-xl font-bold drop-shadow-md">Quality Tea & Snacks</h2>
          <p className="text-sm opacity-90">Freshly prepared for you</p>
        </div>
      </div>

      {/* Category Pills */}
      <div className="sticky top-[52px] bg-white px-5 py-4 flex gap-2.5 overflow-x-auto z-[998] shadow-[0_4px_10px_rgba(0,0,0,0.05)] scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => scrollToCategory(cat)}
            className={`px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex items-center gap-1 ${
              activeCategory === cat
                ? 'bg-black text-white'
                : 'bg-[#f6f6f6] text-[#333]'
            }`}
          >
            {cat === 'Favorites' && <Heart className="w-3 h-3" />}
            {cat}
            {cat === 'Favorites' && favorites.length > 0 && (
              <span className="bg-white/20 px-1.5 rounded-full text-xs ml-1">{favorites.length}</span>
            )}
          </button>
        ))}
        
        {/* Wait Time Badge */}
        {queueLength > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 bg-[#fff3e0] rounded-full text-sm text-[#e65100] whitespace-nowrap">
            <Clock className="w-3 h-3" />
            ~{formatWaitTime(estimatedWait)} wait
          </div>
        )}
      </div>

      {/* Menu Feed */}
      <div className="px-5 pt-5">
        {/* Favorites Section */}
        {activeCategory === 'Favorites' && (
          <div id="cat-Favorites">
            <h2 className="text-2xl font-bold mb-5 flex items-center gap-2">
              <Heart className="w-6 h-6 text-[#e74c3c]" /> Favorites
            </h2>
            {favoriteItems.length === 0 ? (
              <div className="text-center py-8 text-[#999]">
                <Heart className="w-12 h-12 mx-auto mb-3 text-[#ddd]" />
                <p>No favorites yet</p>
                <p className="text-sm">Tap the heart icon on items to add them here</p>
              </div>
            ) : (
              favoriteItems.map(item => {
                const qty = getItemQty(item.id);
                return (
                  <div key={item.id} className="flex justify-between border-b border-[#eee] pb-4 mb-5">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                          className="text-[#e74c3c]"
                        >
                          <Heart className="w-4 h-4 fill-current" />
                        </button>
                      </div>
                      <p className="font-medium text-[#333]">रू{item.price}</p>
                      
                      <div className="mt-3">
                        {qty === 0 ? (
                          <button
                            onClick={() => addToCart(item)}
                            className="bg-white border border-[#ddd] text-[#06C167] font-bold px-5 py-1.5 rounded-full shadow-sm hover:shadow-md transition-shadow"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="inline-flex items-center bg-white border border-[#eee] rounded-full overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              −
                            </button>
                            <span className="font-bold text-sm w-6 text-center">{qty}</span>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-[100px] h-[100px] rounded-xl bg-[#eee] overflow-hidden">
                      <img 
                        src={`https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&auto=format&fit=crop`}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Regular Categories */}
        {categories.filter(c => c !== 'Favorites').map(cat => {
          if (activeCategory === 'Favorites') return null;
          const items = menuItems.filter(item => item.category === cat && item.available);
          if (items.length === 0) return null;
          
          return (
            <div key={cat} id={`cat-${cat}`}>
              <h2 className="text-2xl font-bold mb-5">{cat}</h2>
              {items.map(item => {
                const qty = getItemQty(item.id);
                const isFav = isFavorite(item.id);
                return (
                  <div key={item.id} className="flex justify-between border-b border-[#eee] pb-4 mb-5">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold mb-1">{item.name}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                          className={isFav ? 'text-[#e74c3c]' : 'text-[#ccc]'}
                        >
                          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                      <p className="font-medium text-[#333]">रू{item.price}</p>
                      
                      {/* Inline Quantity Control */}
                      <div className="mt-3">
                        {qty === 0 ? (
                          <button
                            onClick={() => addToCart(item)}
                            className="bg-white border border-[#ddd] text-[#06C167] font-bold px-5 py-1.5 rounded-full shadow-sm hover:shadow-md transition-shadow"
                          >
                            ADD
                          </button>
                        ) : (
                          <div className="inline-flex items-center bg-white border border-[#eee] rounded-full overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                            <button
                              onClick={() => updateQty(item.id, -1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              −
                            </button>
                            <span className="font-bold text-sm w-6 text-center">{qty}</span>
                            <button
                              onClick={() => updateQty(item.id, 1)}
                              className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0]"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-[100px] h-[100px] rounded-xl bg-[#eee] overflow-hidden">
                      <img 
                        src={`https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&auto=format&fit=crop`}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Floating Cart */}
      {cartCount > 0 && (
        <div 
          onClick={() => setCartModalOpen(true)}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 w-[90%] max-w-[500px] bg-[#06C167] text-white p-4 rounded-lg flex justify-between items-center font-semibold shadow-[0_10px_20px_rgba(6,193,103,0.3)] cursor-pointer z-[1000]"
        >
          <div className="flex gap-2.5">
            <div className="bg-black/10 px-2 rounded">{cartCount}</div>
            <span>View Cart</span>
          </div>
          <div>रू{cartTotal}</div>
        </div>
      )}

      {/* Cart Modal */}
      {cartModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end">
          <div className="bg-white w-full rounded-t-[20px] p-8 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold">Your Order</h2>
              <button onClick={() => setCartModalOpen(false)} className="text-2xl">×</button>
            </div>
            
            {cart.map(item => (
              <div key={item.id} className="flex justify-between items-center mb-4 pb-3 border-b border-[#eee]">
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-[#666] text-sm">रू{item.price}</div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => updateQty(item.menuItemId, -1)}
                    className="w-8 h-8 rounded-full bg-[#eee] font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-medium">{item.qty}</span>
                  <button 
                    onClick={() => updateQty(item.menuItemId, 1)}
                    className="w-8 h-8 rounded-full bg-[#eee] font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <div className="mt-5 pt-5 border-t border-[#eee]">
              <div className="flex justify-between font-bold text-xl mb-5">
                <span>Total</span>
                <span>रू{cartTotal}</span>
              </div>
              <button 
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
                className="w-full bg-black text-white p-4 rounded-lg text-lg font-semibold disabled:opacity-50"
              >
                {isSubmitting ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end">
          <div className="bg-white w-full rounded-t-[20px] p-8 text-center pb-10 animate-slide-up">
            <div className="w-20 h-20 bg-[#27ae60] rounded-full mx-auto mb-5 flex items-center justify-center animate-[popIn_0.5s_cubic-bezier(0.68,-0.55,0.265,1.55)]">
              <Check className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Order Placed!</h2>
            <p className="text-[#666] mb-8">The counter has received your order.</p>
            <button 
              onClick={() => { setSuccessModalOpen(false); setBillModalOpen(true); }}
              className="w-full bg-black text-white p-4 rounded-lg text-lg font-semibold"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {billModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-end">
          <div className="bg-white w-full rounded-t-[20px] p-8 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold">My Orders</h2>
              <button onClick={() => setBillModalOpen(false)} className="text-2xl">×</button>
            </div>
            
            {myOrders.length === 0 ? (
              <p className="text-center text-[#999] py-5">No active orders.</p>
            ) : (
              myOrders.map(order => (
                <div key={order.id} className="mb-4">
                  {order.items.map((item, idx) => {
                    const status = getStatusText(order.status);
                    return (
                      <div key={idx} className="flex justify-between items-center py-3 border-b border-[#eee]">
                        <div>
                          <div className="font-semibold">{item.qty}x {item.name}</div>
                          <div className="text-sm text-[#888]">रू{item.price * item.qty}</div>
                        </div>
                        <span style={{ color: status.color }} className="font-bold text-sm">
                          {status.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            <div className="mt-5 border-t border-[#eee] pt-4 text-right">
              <h3 className="text-xl font-bold">Total Due: रू{totalDue}</h3>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @keyframes popIn {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
