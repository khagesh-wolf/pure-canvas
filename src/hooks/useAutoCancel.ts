import { useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';

const AUTO_CANCEL_MINUTES = 30;

export function useAutoCancel() {
  const orders = useStore((state) => state.orders);
  const updateOrderStatus = useStore((state) => state.updateOrderStatus);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkAndCancelOrders = () => {
      const now = Date.now();
      const cancelThreshold = AUTO_CANCEL_MINUTES * 60 * 1000;

      orders
        .filter(order => order.status === 'pending')
        .forEach(order => {
          const orderAge = now - new Date(order.createdAt).getTime();
          if (orderAge > cancelThreshold) {
            updateOrderStatus(order.id, 'cancelled');
            toast.info(`Order #${order.id.slice(-6)} auto-cancelled (30min timeout)`);
          }
        });
    };

    // Check every minute
    intervalRef.current = setInterval(checkAndCancelOrders, 60 * 1000);
    
    // Initial check
    checkAndCancelOrders();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [orders, updateOrderStatus]);
}
