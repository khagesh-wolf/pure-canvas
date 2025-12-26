import { useMemo } from "react";
import { useStore } from "@/store/useStore";

const AVERAGE_PREP_TIME = 8; // Default fallback in minutes

export function useWaitTime() {
  const orders = useStore((state) => state.orders);
  const categories = useStore((state) => state.categories);
  const settings = useStore((state) => state.settings);
  const menuItems = useStore((state) => state.menuItems);

  // Get kitchen parallel capacity from settings (default: 3)
  const kitchenHandles = settings.kitchenHandles || 3;

  // Build a map of category name to prep time
  const categoryPrepTimes = useMemo(() => {
    const map: Record<string, number> = {};
    categories.forEach((cat) => {
      map[cat.name] = cat.prepTime || AVERAGE_PREP_TIME;
    });
    return map;
  }, [categories]);

  // Get prep time for a menu item by looking up its category
  const getPrepTimeForItem = (itemName: string, menuItemId?: string): number => {
    // First try to find by menuItemId
    if (menuItemId) {
      const menuItem = menuItems.find((m) => m.id === menuItemId);
      if (menuItem && categoryPrepTimes[menuItem.category]) {
        return categoryPrepTimes[menuItem.category];
      }
    }

    // Fallback: try to match item name to category
    const category = Object.keys(categoryPrepTimes).find((cat) => itemName.toLowerCase().includes(cat.toLowerCase()));

    return category ? categoryPrepTimes[category] : AVERAGE_PREP_TIME;
  };

  const estimateWaitTime = useMemo(() => {
    // Get orders that are pending or accepted (in queue)
    const queuedOrders = orders.filter(
      (o) => o.status === "pending" || o.status === "accepted" || o.status === "preparing",
    );

    // Calculate total queue time
    let totalQueueMinutes = 0;

    queuedOrders.forEach((order) => {
      order.items.forEach((item) => {
        const prepTime = getPrepTimeForItem(item.name, item.menuItemId);
        totalQueueMinutes += prepTime * item.qty;
      });
    });

    // Divide by kitchen parallel capacity
    const estimatedMinutes = Math.ceil(totalQueueMinutes / kitchenHandles);

    return estimatedMinutes;
  }, [orders, categoryPrepTimes, kitchenHandles, menuItems]);

  const getWaitTimeForNewOrder = (cartItems: { name: string; qty: number }[]) => {
    let newOrderTime = 0;

    cartItems.forEach((item) => {
      const prepTime = getPrepTimeForItem(item.name);
      newOrderTime += prepTime * item.qty;
    });

    // Total wait = current queue + new order time (divided by 2 for partial parallelism)
    const totalWait = estimateWaitTime + Math.ceil(newOrderTime / 2);

    return totalWait;
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes <= 0) return "Ready now";
    if (minutes < 5) return "< 5 min";
    if (minutes < 10) return "5-10 min";
    if (minutes < 15) return "10-15 min";
    if (minutes < 20) return "15-20 min";
    return `~${minutes} min`;
  };

  const getQueueLength = () => {
    return orders.filter((o) => o.status === "pending" || o.status === "accepted" || o.status === "preparing").length;
  };

  return {
    estimatedWaitTime: estimateWaitTime,
    getWaitTimeForNewOrder,
    formatWaitTime,
    queueLength: getQueueLength(),
  };
}
