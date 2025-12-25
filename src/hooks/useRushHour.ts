import { useMemo } from 'react';
import { useStore } from '@/store/useStore';

interface RushHourInfo {
  isRushHour: boolean;
  ordersPerHour: number;
  prepTimeMultiplier: number;
  message: string;
}

export function useRushHour(): RushHourInfo {
  const orders = useStore((state) => state.orders);

  return useMemo(() => {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Count orders in the last hour
    const recentOrders = orders.filter(order => {
      const orderTime = new Date(order.createdAt).getTime();
      return orderTime > oneHourAgo && ['pending', 'accepted', 'preparing'].includes(order.status);
    });

    const ordersPerHour = recentOrders.length;

    // Define rush hour thresholds
    if (ordersPerHour >= 15) {
      return {
        isRushHour: true,
        ordersPerHour,
        prepTimeMultiplier: 1.5,
        message: 'Very busy - expect longer wait times',
      };
    } else if (ordersPerHour >= 10) {
      return {
        isRushHour: true,
        ordersPerHour,
        prepTimeMultiplier: 1.25,
        message: 'Busy period - slight delays possible',
      };
    } else if (ordersPerHour <= 3) {
      return {
        isRushHour: false,
        ordersPerHour,
        prepTimeMultiplier: 0.8,
        message: 'Quiet period - faster than usual',
      };
    }

    return {
      isRushHour: false,
      ordersPerHour,
      prepTimeMultiplier: 1,
      message: 'Normal wait times',
    };
  }, [orders]);
}
