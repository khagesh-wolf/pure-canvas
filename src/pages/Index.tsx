import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Coffee, User, ChefHat, CreditCard, Settings, TrendingUp, Users, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { ServerConfig } from '@/components/ServerConfig';
import { formatNepalDateTime } from '@/lib/nepalTime';

const modules = [
  {
    path: '/kitchen',
    title: 'Kitchen Display',
    description: 'Real-time order management for your cooking staff',
    icon: ChefHat,
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    path: '/counter',
    title: 'Counter POS',
    description: 'Streamlined billing and payment processing',
    icon: CreditCard,
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    path: '/admin',
    title: 'Admin Dashboard',
    description: 'Complete control over menu, analytics & settings',
    icon: Settings,
    gradient: 'from-violet-500 to-purple-600',
  },
];

export default function Index() {
  const { settings, isAuthenticated, currentUser, getTodayStats, getPendingOrders } = useStore();
  const stats = getTodayStats();
  const pendingOrders = getPendingOrders();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="page-header">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 gradient-primary rounded-xl sm:rounded-2xl flex items-center justify-center shadow-warm">
              <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-base sm:text-xl font-semibold text-foreground">{settings.restaurantName}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Management Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <ServerConfig />
            {isAuthenticated && currentUser ? (
              <Link to={currentUser.role === 'admin' ? '/admin' : '/counter'}>
                <Button variant="outline" size="sm" className="rounded-xl border-border hover:bg-muted text-xs sm:text-sm h-8 sm:h-9">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{currentUser.name}</span>
                  <span className="sm:hidden">Me</span>
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button size="sm" className="gradient-primary text-primary-foreground rounded-xl shadow-warm hover:opacity-90 transition-opacity text-xs sm:text-sm h-8 sm:h-9">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Staff</span> Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl gradient-primary p-6 sm:p-10 md:p-14 mb-6 sm:mb-10 shadow-warm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Coffee className="w-5 h-5 sm:w-7 sm:h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-serif text-xl sm:text-3xl md:text-4xl font-bold text-primary-foreground">{settings.restaurantName}</h2>
                <p className="text-xs sm:text-base text-primary-foreground/80">Tea Restaurant Management Portal</p>
              </div>
            </div>
            
            <p className="text-xs sm:text-sm text-primary-foreground/70 mt-4 sm:mt-6">{formatNepalDateTime(new Date())} • Nepal Time</p>
            
            {pendingOrders.length > 0 && (
              <div className="mt-4 sm:mt-6 bg-white/15 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 sm:px-5 py-2 sm:py-3 inline-flex items-center gap-2 sm:gap-3 border border-white/20">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-white animate-pulse-soft" />
                <span className="font-medium text-xs sm:text-base text-primary-foreground">{pendingOrders.length} pending orders</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-10">
          <StatCard icon={TrendingUp} label="Today's Revenue" value={`रू ${stats.revenue.toLocaleString()}`} />
          <StatCard icon={ShoppingBag} label="Orders Completed" value={stats.orders.toString()} />
          <StatCard icon={ChefHat} label="Active Orders" value={stats.activeOrders.toString()} highlight={stats.activeOrders > 0} />
          <StatCard icon={Users} label="Active Tables" value={stats.activeTables.toString()} />
        </div>

        {/* Quick Access */}
        <div className="mb-6 sm:mb-10">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h2 className="font-serif text-xl sm:text-2xl font-semibold">Quick Access</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.path}
                  to={module.path}
                  className="group bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 hover:shadow-soft hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${module.gradient} flex items-center justify-center mb-4 sm:mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <h3 className="font-serif text-lg sm:text-xl font-semibold mb-1 sm:mb-2 group-hover:text-primary transition-colors">{module.title}</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4">{module.description}</p>
                  <div className="flex items-center gap-2 text-primary font-medium text-xs sm:text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-muted/50 rounded-xl sm:rounded-2xl p-5 sm:p-8 text-center border border-border">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Coffee className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <h3 className="font-serif text-lg sm:text-xl font-semibold mb-2">For Customers</h3>
          <p className="text-sm sm:text-base text-muted-foreground">
            Scan the QR code at your table to place an order directly from your phone.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">
            Tables 1 - {settings.tableCount} available
          </p>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-muted-foreground text-sm">
          <p>{settings.restaurantName} v2.0</p>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, highlight }: { 
  icon: any; label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`stat-card p-3 sm:p-4 ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center ${highlight ? 'bg-primary/15' : 'bg-muted'}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </div>
      <p className={`font-serif text-lg sm:text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{label}</p>
    </div>
  );
}
