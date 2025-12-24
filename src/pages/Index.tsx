import { Link } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Coffee, User, ChefHat, CreditCard, Settings, TrendingUp, Users, ShoppingBag, ArrowRight, Sparkles } from 'lucide-react';
import { BackendConfig } from '@/components/BackendConfig';
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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center shadow-warm">
              <Coffee className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold text-foreground">{settings.restaurantName}</h1>
              <p className="text-sm text-muted-foreground">Management Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <BackendConfig />
            {isAuthenticated && currentUser ? (
              <Link to={currentUser.role === 'admin' ? '/admin' : '/counter'}>
                <Button variant="outline" className="rounded-xl border-border hover:bg-muted">
                  <User className="w-4 h-4 mr-2" />
                  {currentUser.name}
                </Button>
              </Link>
            ) : (
              <Link to="/auth">
                <Button className="gradient-primary text-primary-foreground rounded-xl shadow-warm hover:opacity-90 transition-opacity">
                  <User className="w-4 h-4 mr-2" /> Staff Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl gradient-primary p-10 md:p-14 mb-10 shadow-warm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Coffee className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-primary-foreground">{settings.restaurantName}</h2>
                <p className="text-primary-foreground/80">Tea Restaurant Management Portal</p>
              </div>
            </div>
            
            <p className="text-sm text-primary-foreground/70 mt-6">{formatNepalDateTime(new Date())} • Nepal Time</p>
            
            {pendingOrders.length > 0 && (
              <div className="mt-6 bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 inline-flex items-center gap-3 border border-white/20">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse-soft" />
                <span className="font-medium text-primary-foreground">{pendingOrders.length} pending orders waiting</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard icon={TrendingUp} label="Today's Revenue" value={`रू ${stats.revenue.toLocaleString()}`} />
          <StatCard icon={ShoppingBag} label="Orders Completed" value={stats.orders.toString()} />
          <StatCard icon={ChefHat} label="Active Orders" value={stats.activeOrders.toString()} highlight={stats.activeOrders > 0} />
          <StatCard icon={Users} label="Active Tables" value={stats.activeTables.toString()} />
        </div>

        {/* Quick Access */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-serif text-2xl font-semibold">Quick Access</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.path}
                  to={module.path}
                  className="group bg-card rounded-2xl border border-border p-6 hover:shadow-soft hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${module.gradient} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold mb-2 group-hover:text-primary transition-colors">{module.title}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{module.description}</p>
                  <div className="flex items-center gap-2 text-primary font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-muted/50 rounded-2xl p-8 text-center border border-border">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Coffee className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-serif text-xl font-semibold mb-2">For Customers</h3>
          <p className="text-muted-foreground">
            Scan the QR code at your table to place an order directly from your phone.
          </p>
          <p className="text-sm text-muted-foreground mt-3">
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
    <div className={`stat-card ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? 'bg-primary/15' : 'bg-muted'}`}>
          <Icon className={`w-5 h-5 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </div>
      <p className={`font-serif text-2xl font-bold ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
