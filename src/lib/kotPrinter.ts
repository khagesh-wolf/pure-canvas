/**
 * Kitchen Order Ticket (KOT) Printing
 * Prints KOT when waiter sends an order (if enabled in settings)
 * 
 * Supports dual printer mode:
 * - When enabled, splits items by category (useBarPrinter flag)
 * - Kitchen items → Kitchen printer / console
 * - Bar items → Bar printer / console
 */

import { receiptPrinter } from './receiptPrinter';
import { dualPrinter } from './dualPrinter';
import { Order, Category, MenuItem } from '@/types';

export interface KOTData {
  restaurantName: string;
  tableNumber: number;
  orderId: string;
  time: string;
  items: Array<{
    name: string;
    qty: number;
  }>;
  notes?: string;
  waiterName?: string;
  printerLabel?: string;
}

class KOTPrinter {
  // Format and print a Kitchen Order Ticket
  async printKOT(data: KOTData): Promise<boolean> {
    if (!receiptPrinter.isSupported()) {
      console.log('Web USB not supported - KOT printing unavailable');
      return false;
    }

    if (!receiptPrinter.isConnected()) {
      console.log('Printer not connected - attempting to connect...');
      try {
        await receiptPrinter.connect();
      } catch (error) {
        console.error('Failed to connect to printer:', error);
        return false;
      }
    }

    try {
      // For now, we'll format KOT as a simple receipt
      // In a full implementation, this would use specific KOT formatting
      const kotContent = this.formatKOT(data);
      console.log('KOT Content:', kotContent);
      
      // Note: Full implementation would send ESC/POS commands
      // For demo, we log the content
      this.logKOTToConsole(data);
      
      return true;
    } catch (error) {
      console.error('Failed to print KOT:', error);
      return false;
    }
  }

  // Log KOT to console (for demo/preview)
  logKOTToConsole(data: KOTData): void {
    console.log('='.repeat(32));
    console.log(`  ${data.printerLabel || 'KITCHEN ORDER TICKET'}`);
    console.log('='.repeat(32));
    console.log(`Table: ${data.tableNumber}`);
    console.log(`Time: ${data.time}`);
    console.log(`Order: #${data.orderId}`);
    if (data.waiterName) {
      console.log(`Waiter: ${data.waiterName}`);
    }
    console.log('-'.repeat(32));
    data.items.forEach(item => {
      console.log(`${item.qty}x ${item.name}`);
    });
    if (data.notes) {
      console.log('-'.repeat(32));
      console.log(`Notes: ${data.notes}`);
    }
    console.log('='.repeat(32));
  }

  // Open print window for KOT (browser print dialog)
  openPrintWindow(data: KOTData): void {
    const printContent = `
      <div style="font-family: monospace; width: 300px; padding: 10px;">
        <div style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px;">
          <h2 style="margin: 0;">${data.printerLabel || 'KITCHEN ORDER TICKET'}</h2>
          <div>${data.time}</div>
        </div>
        <div style="font-size: 1.2rem; font-weight: bold; text-align: center; margin: 10px 0; border: 2px solid black; padding: 5px;">
          TABLE ${data.tableNumber}
        </div>
        ${data.waiterName ? `<div style="text-align: center; margin-bottom: 10px;">Waiter: ${data.waiterName}</div>` : ''}
        <div style="border-bottom: 2px solid black; margin-bottom: 10px;"></div>
        ${data.items.map(i => `
          <div style="display: flex; justify-content: space-between; font-size: 1.2rem; font-weight: bold; margin-bottom: 5px;">
            <span>${i.qty} x</span>
            <span>${i.name}</span>
          </div>
        `).join('')}
        ${data.notes ? `
          <div style="border-top: 1px dashed black; margin-top: 10px; padding-top: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px;">📝 Notes:</div>
            <div style="font-size: 1.1rem;">${data.notes}</div>
          </div>
        ` : ''}
        <div style="border-top: 2px solid black; margin-top: 20px; padding-top: 10px; text-align: center;">
          Order: #${data.orderId}
        </div>
      </div>
    `;
    
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    }
  }

  private formatKOT(data: KOTData): string {
    let content = '';
    content += `${'='.repeat(32)}\n`;
    content += `  ${data.printerLabel || 'KITCHEN ORDER TICKET'}\n`;
    content += `${'='.repeat(32)}\n`;
    content += `Table: ${data.tableNumber}\n`;
    content += `Time: ${data.time}\n`;
    content += `Order: #${data.orderId}\n`;
    if (data.waiterName) {
      content += `Waiter: ${data.waiterName}\n`;
    }
    content += `${'-'.repeat(32)}\n`;
    
    data.items.forEach(item => {
      content += `${item.qty}x ${item.name}\n`;
    });
    
    if (data.notes) {
      content += `${'-'.repeat(32)}\n`;
      content += `Notes: ${data.notes}\n`;
    }
    
    content += `${'='.repeat(32)}\n`;
    return content;
  }
}

export const kotPrinter = new KOTPrinter();

/**
 * Print KOT from an Order - supports both single and dual printer modes
 */
export async function printKOTFromOrder(
  order: Order,
  restaurantName: string,
  waiterName?: string,
  options?: {
    dualPrinterEnabled?: boolean;
    categories?: Category[];
    menuItems?: MenuItem[];
  }
): Promise<boolean> {
  const time = new Date(order.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Check if dual printer mode is enabled
  if (options?.dualPrinterEnabled && options.categories && options.menuItems) {
    return printDualKOT(order, restaurantName, waiterName, time, options.categories, options.menuItems);
  }

  // Single printer mode - print all items together
  const kotData: KOTData = {
    restaurantName,
    tableNumber: order.tableNumber,
    orderId: order.id.slice(-6),
    time,
    items: order.items.map(item => ({
      name: item.name,
      qty: item.qty
    })),
    notes: order.notes,
    waiterName
  };

  return kotPrinter.printKOT(kotData);
}

/**
 * Print split KOT for dual printer mode
 * Separates items into Kitchen and Bar tickets based on category settings
 */
async function printDualKOT(
  order: Order,
  restaurantName: string,
  waiterName: string | undefined,
  time: string,
  categories: Category[],
  menuItems: MenuItem[]
): Promise<boolean> {
  // Build menuItemId -> categoryName map
  const menuItemCategoryMap = new Map<string, string>();
  menuItems.forEach(item => {
    menuItemCategoryMap.set(item.id, item.category);
  });

  // Build categoryName -> useBarPrinter map
  const categoryBarPrinterMap = new Map<string, boolean>();
  categories.forEach(cat => {
    categoryBarPrinterMap.set(cat.name, cat.useBarPrinter || false);
  });

  // Split items by printer destination
  const kitchenItems: Array<{ name: string; qty: number }> = [];
  const barItems: Array<{ name: string; qty: number }> = [];

  order.items.forEach(item => {
    const categoryName = menuItemCategoryMap.get(item.menuItemId);
    const useBarPrinter = categoryName ? categoryBarPrinterMap.get(categoryName) : false;
    
    if (useBarPrinter) {
      barItems.push({ name: item.name, qty: item.qty });
    } else {
      kitchenItems.push({ name: item.name, qty: item.qty });
    }
  });

  const baseData = {
    restaurantName,
    tableNumber: order.tableNumber,
    orderId: order.id.slice(-6),
    time,
    notes: order.notes,
    waiterName
  };

  let success = true;

  // Print Kitchen KOT if there are kitchen items
  if (kitchenItems.length > 0) {
    const kitchenStatus = dualPrinter.kitchenPrinter.isConnected();
    if (kitchenStatus) {
      const printed = await dualPrinter.kitchenPrinter.printKOT({
        ...baseData,
        items: kitchenItems,
        printerLabel: '🍳 KITCHEN ORDER'
      });
      success = success && printed;
    } else {
      // Open print window when printer not connected
      kotPrinter.openPrintWindow({
        ...baseData,
        items: kitchenItems,
        printerLabel: '🍳 KITCHEN ORDER'
      });
    }
  }

  // Print Bar KOT if there are bar items
  if (barItems.length > 0) {
    const barStatus = dualPrinter.barPrinter.isConnected();
    if (barStatus) {
      const printed = await dualPrinter.barPrinter.printKOT({
        ...baseData,
        items: barItems,
        printerLabel: '🍹 BAR ORDER'
      });
      success = success && printed;
    } else {
      // Open print window when printer not connected (with small delay to avoid popup block)
      setTimeout(() => {
        kotPrinter.openPrintWindow({
          ...baseData,
          items: barItems,
          printerLabel: '🍹 BAR ORDER'
        });
      }, 500);
    }
  }

  return success;
}

// Browser notification for KOT (fallback when printer not available)
export function showKOTNotification(order: Order) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const itemsList = order.items.map(i => `${i.qty}x ${i.name}`).join(', ');
    new Notification(`New Order - Table ${order.tableNumber}`, {
      body: itemsList,
      icon: '/pwa-192x192.png',
      tag: `kot-${order.id}`,
      requireInteraction: true
    });
  }
}
