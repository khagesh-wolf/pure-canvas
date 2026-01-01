# Network Print Server Setup Guide

This guide explains how to set up network printing for remote kitchen/bar printers when USB connection isn't possible due to distance.

## Overview

Since web browsers cannot directly connect to raw TCP sockets (which thermal printers use), we need a **print server** running on your local network that:
1. Receives print jobs from the browser via HTTP
2. Forwards them to the network printer via TCP

```
┌─────────────┐     HTTP      ┌──────────────┐     TCP      ┌─────────────┐
│   Browser   │ ──────────── │ Print Server │ ──────────── │   Printer   │
│  (Counter)  │   Port 3001   │  (Node.js)   │   Port 9100  │  (Kitchen)  │
└─────────────┘               └──────────────┘              └─────────────┘
```

## Requirements

1. **Network Printer**: A thermal printer with WiFi or Ethernet (e.g., XPrinter XP-N160II WiFi)
2. **Print Server Computer**: Any always-on computer on your network (can be a Raspberry Pi, old laptop, or the POS computer itself)
3. **Node.js**: Installed on the print server computer

## Step 1: Find Your Printer's IP Address

### Method 1: Router Admin Panel
1. Access your router (usually 192.168.1.1 or 192.168.0.1)
2. Look for connected devices
3. Find your printer and note its IP

### Method 2: Printer Self-Test
1. Turn off the printer
2. Hold the FEED button while turning on
3. The printer will print its network settings including IP

### Method 3: Network Scan
```bash
# On Windows (Command Prompt)
arp -a

# On Mac/Linux
nmap -sn 192.168.1.0/24
```

## Step 2: Set Up the Print Server

### Option A: Simple Node.js Server

1. Install Node.js from https://nodejs.org/

2. Create a folder and file:
```bash
mkdir print-server
cd print-server
```

3. Create `print-server.js`:
```javascript
const http = require('http');
const net = require('net');

const PORT = 3001;

const server = http.createServer((req, res) => {
  // Enable CORS for browser requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }
  
  // Health check endpoint
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }
  
  // Print endpoint
  if (req.url === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { printerIp, printerPort, data } = JSON.parse(body);
        
        console.log(`Printing to ${printerIp}:${printerPort}`);
        
        const client = new net.Socket();
        client.setTimeout(5000);
        
        client.connect(printerPort || 9100, printerIp, () => {
          const buffer = Buffer.from(data);
          client.write(buffer);
          client.end();
          console.log('Print job sent successfully');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        });
        
        client.on('error', (err) => {
          console.error('Printer error:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
        
        client.on('timeout', () => {
          console.error('Printer connection timeout');
          client.destroy();
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Connection timeout' }));
        });
      } catch (err) {
        console.error('Parse error:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
      }
    });
    return;
  }
  
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🖨️  Print Server running on http://0.0.0.0:${PORT}`);
  console.log('Ready to receive print jobs...');
});
```

4. Run the server:
```bash
node print-server.js
```

### Option B: Using PM2 (Auto-restart)

For production use, install PM2 to keep the server running:

```bash
npm install -g pm2
pm2 start print-server.js --name "print-server"
pm2 save
pm2 startup  # Follow instructions to auto-start on boot
```

### Option C: Raspberry Pi Setup

Raspberry Pi is perfect for a dedicated print server:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Create and run print server
mkdir ~/print-server && cd ~/print-server
# Create print-server.js as above
node print-server.js
```

## Step 3: Configure in POS App

1. Open the Counter page
2. Click the **Printer** icon in the header
3. Go to **Network (Remote)** tab
4. For Kitchen Printer:
   - **Printer IP**: Your printer's IP (e.g., 192.168.1.100)
   - **Printer Port**: 9100 (default for most thermal printers)
   - **Print Server URL**: http://[print-server-computer-ip]:3001
5. Click **Save Config** then **Test**

## Troubleshooting

### "Connection failed"
- Verify printer IP is correct
- Check if printer is on the same network
- Ping the printer: `ping 192.168.1.100`
- Check printer port (usually 9100 for raw printing)

### "Print server not responding"
- Verify print server is running: visit http://localhost:3001/status in browser
- Check firewall allows port 3001
- On Windows: Allow Node.js through Windows Firewall
- On Linux: `sudo ufw allow 3001`

### "Prints are garbled"
- Printer may not be ESC/POS compatible
- Check printer documentation for correct port

### Network Printer Recommendations (Nepal)

| Model | Price (NPR) | Connection | Notes |
|-------|-------------|------------|-------|
| XPrinter XP-N160II | ₹4,000-5,000 | WiFi + Ethernet | Best for remote kitchen |
| XPrinter XP-E200M | ₹3,500-4,500 | Ethernet | Budget option |
| Epson TM-T82X | ₹15,000+ | WiFi + Ethernet | Premium, very reliable |

## Security Notes

- The print server should only run on your local network
- Do not expose port 3001 to the internet
- For multiple locations, set up a VPN

## Support

If you need help setting up network printing, contact your IT support or the printer vendor.
