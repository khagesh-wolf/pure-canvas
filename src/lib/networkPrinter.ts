/**
 * Network Printer Support
 * Enables printing to thermal printers connected via WiFi or Ethernet
 * 
 * Since browsers cannot directly connect to raw TCP sockets,
 * this requires a local print server to relay print jobs.
 * 
 * The print server receives ESC/POS commands via HTTP POST
 * and forwards them to the printer on the network.
 */

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

export const ESC_POS_COMMANDS = {
  INIT: [ESC, 0x40],
  CENTER: [ESC, 0x61, 0x01],
  LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  CUT: [GS, 0x56, 0x00],
  PARTIAL_CUT: [GS, 0x56, 0x01],
  FEED_LINES: (n: number) => [ESC, 0x64, n],
};

export interface NetworkPrinterConfig {
  name: string;
  printerIp: string;
  printerPort: number;
  printServerUrl: string; // Local print server URL (e.g., http://localhost:9100)
}

export interface PrintJob {
  restaurantName: string;
  tableNumber: number;
  orderId: string;
  time: string;
  items: Array<{ name: string; qty: number }>;
  notes?: string;
  waiterName?: string;
  printerLabel?: string;
}

export class NetworkPrinter {
  private config: NetworkPrinterConfig | null = null;
  private connected: boolean = false;
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Configure network printer settings
   */
  configure(config: NetworkPrinterConfig): void {
    this.config = config;
    this.name = config.name;
    // Save to localStorage for persistence
    localStorage.setItem(`network_printer_${this.name}`, JSON.stringify(config));
  }

  /**
   * Load saved configuration
   */
  loadConfig(): NetworkPrinterConfig | null {
    const saved = localStorage.getItem(`network_printer_${this.name}`);
    if (saved) {
      try {
        this.config = JSON.parse(saved);
        return this.config;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Test connection to print server
   */
  async testConnection(): Promise<boolean> {
    if (!this.config) {
      console.log(`[${this.name}] No configuration set`);
      return false;
    }

    try {
      const response = await fetch(`${this.config.printServerUrl}/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        this.connected = true;
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[${this.name}] Connection test failed:`, error);
      this.connected = false;
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.config !== null;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getConfig(): NetworkPrinterConfig | null {
    return this.config;
  }

  /**
   * Generate ESC/POS commands for a KOT
   */
  private generateKOTCommands(data: PrintJob): number[] {
    const commands: number[] = [];
    const encoder = new TextEncoder();

    const addCommand = (cmd: number[]) => {
      commands.push(...cmd);
    };

    const addText = (text: string) => {
      const encoded = encoder.encode(text + '\n');
      for (let i = 0; i < encoded.length; i++) {
        commands.push(encoded[i]);
      }
    };

    // Initialize and center
    addCommand(ESC_POS_COMMANDS.INIT);
    addCommand(ESC_POS_COMMANDS.CENTER);
    addCommand(ESC_POS_COMMANDS.DOUBLE_SIZE);
    addText(data.printerLabel || 'KITCHEN ORDER');
    addCommand(ESC_POS_COMMANDS.NORMAL_SIZE);
    addText('='.repeat(32));

    // Left align for details
    addCommand(ESC_POS_COMMANDS.LEFT);
    addCommand(ESC_POS_COMMANDS.BOLD_ON);
    addText(`Table: ${data.tableNumber}`);
    addCommand(ESC_POS_COMMANDS.BOLD_OFF);
    addText(`Time: ${data.time}`);
    addText(`Order: #${data.orderId}`);
    if (data.waiterName) {
      addText(`Waiter: ${data.waiterName}`);
    }
    addText('-'.repeat(32));

    // Items with double height
    addCommand(ESC_POS_COMMANDS.DOUBLE_HEIGHT);
    for (const item of data.items) {
      addText(`${item.qty}x ${item.name}`);
    }
    addCommand(ESC_POS_COMMANDS.NORMAL_SIZE);

    // Notes
    if (data.notes) {
      addText('-'.repeat(32));
      addText(`Notes: ${data.notes}`);
    }

    addText('='.repeat(32));
    addCommand(ESC_POS_COMMANDS.FEED_LINES(3));
    addCommand(ESC_POS_COMMANDS.CUT);

    return commands;
  }

  /**
   * Print KOT via network print server
   */
  async printKOT(data: PrintJob): Promise<boolean> {
    if (!this.config) {
      console.log(`[${this.name}] Not configured - logging KOT to console`);
      console.log('='.repeat(32));
      console.log(`  ${data.printerLabel || 'KITCHEN ORDER TICKET'}`);
      console.log('='.repeat(32));
      console.log(`Table: ${data.tableNumber}`);
      console.log(`Time: ${data.time}`);
      console.log(`Order: #${data.orderId}`);
      if (data.waiterName) console.log(`Waiter: ${data.waiterName}`);
      console.log('-'.repeat(32));
      data.items.forEach(item => console.log(`${item.qty}x ${item.name}`));
      if (data.notes) {
        console.log('-'.repeat(32));
        console.log(`Notes: ${data.notes}`);
      }
      console.log('='.repeat(32));
      return true;
    }

    try {
      const commands = this.generateKOTCommands(data);
      
      const response = await fetch(`${this.config.printServerUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerIp: this.config.printerIp,
          printerPort: this.config.printerPort,
          data: commands,
        }),
      });

      if (response.ok) {
        console.log(`[${this.name}] KOT sent to print server`);
        return true;
      } else {
        console.error(`[${this.name}] Print server error:`, await response.text());
        return false;
      }
    } catch (error) {
      console.error(`[${this.name}] Print error:`, error);
      return false;
    }
  }

  /**
   * Print raw ESC/POS commands
   */
  async printRaw(commands: number[]): Promise<boolean> {
    if (!this.config) return false;

    try {
      const response = await fetch(`${this.config.printServerUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printerIp: this.config.printerIp,
          printerPort: this.config.printerPort,
          data: commands,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error(`[${this.name}] Raw print error:`, error);
      return false;
    }
  }

  /**
   * Clear configuration
   */
  disconnect(): void {
    this.connected = false;
    this.config = null;
    localStorage.removeItem(`network_printer_${this.name}`);
  }
}

// Create network printer instances
export const networkKitchenPrinter = new NetworkPrinter('network_kitchen');
export const networkBarPrinter = new NetworkPrinter('network_bar');

// Initialize from saved config
networkKitchenPrinter.loadConfig();
networkBarPrinter.loadConfig();
