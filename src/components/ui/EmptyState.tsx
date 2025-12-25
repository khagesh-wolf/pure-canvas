import { memo, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { 
  ShoppingCart, 
  FileText, 
  Users, 
  ClipboardList,
  Package,
  Receipt,
  Wallet
} from 'lucide-react';

type EmptyStateType = 'cart' | 'orders' | 'customers' | 'menu' | 'expenses' | 'transactions' | 'bills';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const emptyStateConfig = {
  cart: {
    icon: ShoppingCart,
    defaultTitle: 'Your cart is empty',
    defaultDescription: 'Browse the menu and add items to get started',
    color: 'text-primary/40',
    bgColor: 'bg-primary/5',
  },
  orders: {
    icon: ClipboardList,
    defaultTitle: 'No orders yet',
    defaultDescription: 'Orders will appear here once customers place them',
    color: 'text-warning/50',
    bgColor: 'bg-warning/5',
  },
  customers: {
    icon: Users,
    defaultTitle: 'No customers found',
    defaultDescription: 'Customer data will appear after their first order',
    color: 'text-success/50',
    bgColor: 'bg-success/5',
  },
  menu: {
    icon: Package,
    defaultTitle: 'No menu items',
    defaultDescription: 'Add menu items to get started',
    color: 'text-muted-foreground/50',
    bgColor: 'bg-muted/30',
  },
  expenses: {
    icon: Wallet,
    defaultTitle: 'No expenses recorded',
    defaultDescription: 'Track your expenses by adding them here',
    color: 'text-destructive/40',
    bgColor: 'bg-destructive/5',
  },
  transactions: {
    icon: Receipt,
    defaultTitle: 'No transactions',
    defaultDescription: 'Completed payments will appear here',
    color: 'text-primary/40',
    bgColor: 'bg-primary/5',
  },
  bills: {
    icon: FileText,
    defaultTitle: 'No pending bills',
    defaultDescription: 'Bills will appear when orders are ready for payment',
    color: 'text-success/50',
    bgColor: 'bg-success/5',
  },
};

const EmptyState = memo(function EmptyState({ 
  type, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  const config = emptyStateConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center mb-4", config.bgColor)}>
        <Icon className={cn("w-10 h-10", config.color)} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        {title || config.defaultTitle}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {description || config.defaultDescription}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
});

export { EmptyState };
