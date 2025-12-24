import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Order, OrderStatus } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Check, X, Clock, ChefHat, Bell, CheckCircle, LogOut, Coffee, RefreshCw, MonitorDot } from 'lucide-react';
import { toast } from 'sonner';
import { formatNepalTime, formatNepalDateTime } from '@/lib/nepalTime';

const statusFlow: OrderStatus[] = ['pending', 'accepted'];

export default function Kitchen() {
  const navigate = useNavigate();
  const { orders, updateOrderStatus, isAuthenticated, logout, settings } = useStore();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');

  if (!isAuthenticated) {
    navigate('/auth');
    return null;
  }

  const activeOrders = orders.filter(o => 
    ['pending', 'accepted'].includes(o.status)
  );

  const filteredOrders = filter === 'all' 
    ? activeOrders 
    : activeOrders.filter(o => o.status === filter);

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const acceptedCount = orders.filter(o => o.status === 'accepted').length;

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    updateOrderStatus(order.id, newStatus);
    toast.success(`Order marked as ${newStatus}`);
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = statusFlow.indexOf(current);
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="page-header px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 gradient-primary rounded-xl sm:rounded-2xl flex items-center justify-center shadow-warm">
              <ChefHat className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-base sm:text-xl font-bold text-foreground">{settings.restaurantName}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Kitchen Display</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
            {pendingCount > 0 && (
              <span className="pill bg-warning/15 text-warning border border-warning/20 animate-pulse-soft text-xs sm:text-sm">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {pendingCount}
              </span>
            )}
            <span className="text-xs text-muted-foreground hidden lg:block">{formatNepalDateTime(new Date())}</span>
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
              onClick={() => navigate('/counter')}
              title="Go to Counter"
            >
              <MonitorDot className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 sm:mb-6 flex-wrap">
          <FilterTab 
            label="All Orders" 
            count={activeOrders.length} 
            active={filter === 'all'} 
            onClick={() => setFilter('all')} 
          />
          <FilterTab 
            label="Pending" 
            count={pendingCount} 
            active={filter === 'pending'} 
            onClick={() => setFilter('pending')} 
            variant="warning" 
          />
          <FilterTab 
            label="Accepted" 
            count={acceptedCount} 
            active={filter === 'accepted'} 
            onClick={() => setFilter('accepted')} 
            variant="success" 
          />
        </div>

        {/* Orders Grid */}
        {filteredOrders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 sm:p-16 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Coffee className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-muted-foreground mb-2">No active orders</h3>
            <p className="text-sm sm:text-base text-muted-foreground/70">New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredOrders.map((order, index) => (
              <div 
                key={order.id} 
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <OrderCard 
                  order={order}
                  onStatusChange={handleStatusChange}
                  nextStatus={getNextStatus(order.status)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterTab({ 
  label, count, active, onClick, variant = 'default'
}: { 
  label: string; count: number; active: boolean; onClick: () => void;
  variant?: 'default' | 'warning' | 'success';
}) {
  const baseClasses = "px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all duration-200 flex items-center gap-1 sm:gap-2";
  
  const variantClasses = {
    default: active 
      ? 'gradient-primary text-primary-foreground shadow-warm' 
      : 'bg-muted text-muted-foreground hover:bg-muted/80',
    warning: active 
      ? 'bg-warning text-warning-foreground shadow-lg' 
      : 'bg-warning/15 text-warning hover:bg-warning/25',
    success: active 
      ? 'bg-success text-success-foreground shadow-lg' 
      : 'bg-success/15 text-success hover:bg-success/25',
  };

  return (
    <button 
      onClick={onClick} 
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {label}
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${active ? 'bg-white/20' : 'bg-background/60'}`}>
        {count}
      </span>
    </button>
  );
}

function OrderCard({ order, onStatusChange, nextStatus }: { 
  order: Order; 
  onStatusChange: (order: Order, status: OrderStatus) => void;
  nextStatus: OrderStatus | null;
}) {
  const isPending = order.status === 'pending';

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden card-shadow-lg transition-all duration-200 hover:card-shadow-xl ${
      isPending ? 'border-warning/50 ring-2 ring-warning/20' : 'border-border'
    }`}>
      {/* Header */}
      <div className={`p-5 border-b border-border ${isPending ? 'bg-warning/10' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isPending ? 'bg-warning/20' : 'bg-muted'
            }`}>
              {isPending ? (
                <Clock className="w-5 h-5 text-warning" />
              ) : (
                <ChefHat className="w-5 h-5 text-success" />
              )}
            </div>
            <span className="font-serif text-xl font-bold">Table {order.tableNumber}</span>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{order.customerPhone}</span>
          <span>{formatNepalTime(order.createdAt)}</span>
        </div>
      </div>

      {/* Items */}
      <div className="p-5 space-y-3">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="font-medium">
              <span className="text-primary font-bold text-lg mr-2">{item.qty}×</span>
              {item.name}
            </span>
          </div>
        ))}
        {order.notes && (
          <div className="bg-muted/50 rounded-xl p-3 mt-3 border border-border">
            <p className="text-xs text-muted-foreground">{order.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 pt-0 flex gap-2">
        {isPending && (
          <>
            <Button 
              size="sm" 
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground rounded-xl h-11"
              onClick={() => onStatusChange(order, 'accepted')}
            >
              <Check className="w-4 h-4 mr-2" /> Accept
            </Button>
            <Button 
              size="sm" 
              variant="destructive"
              className="rounded-xl h-11"
              onClick={() => onStatusChange(order, 'cancelled')}
            >
              <X className="w-4 h-4" />
            </Button>
          </>
        )}
        {nextStatus && !isPending && (
          <Button 
            size="sm" 
            className="w-full gradient-primary text-primary-foreground rounded-xl h-11"
            onClick={() => onStatusChange(order, nextStatus)}
          >
            Mark as {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
          </Button>
        )}
      </div>

      <div className="px-5 pb-4 text-xs text-muted-foreground/50">
        ID: #{order.id.slice(-6)}
      </div>
    </div>
  );
}
