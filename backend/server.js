import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Initialize SQLite database
let db;
const DB_PATH = 'chiyadani.db';

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (existsSync(DB_PATH)) {
    const fileBuffer = readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      available INTEGER DEFAULT 1,
      description TEXT,
      image TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL,
      customer_phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL,
      customer_phones TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      status TEXT DEFAULT 'unpaid',
      payment_method TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS bill_orders (
      bill_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      PRIMARY KEY (bill_id, order_id),
      FOREIGN KEY (bill_id) REFERENCES bills(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      phone TEXT PRIMARY KEY,
      name TEXT,
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      points INTEGER DEFAULT 0,
      last_visit TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      restaurant_name TEXT DEFAULT 'Chiya Dani',
      table_count INTEGER DEFAULT 10,
      wifi_ssid TEXT,
      wifi_password TEXT,
      base_url TEXT,
      logo TEXT,
      instagram_url TEXT,
      facebook_url TEXT,
      tiktok_url TEXT,
      google_review_url TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS waiter_calls (
      id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL,
      customer_phone TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      acknowledged_at TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      table_number INTEGER NOT NULL,
      customer_phones TEXT NOT NULL,
      total REAL NOT NULL,
      discount REAL DEFAULT 0,
      payment_method TEXT NOT NULL,
      paid_at TEXT NOT NULL,
      items TEXT NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id)
    );
  `);
  
  db.run(`INSERT OR IGNORE INTO settings (id) VALUES (1);`);
  
  saveDatabase();
  console.log('Database initialized');
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

// Helper to run queries and get results
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results[0] || null;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Broadcast to all connected clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  let sentCount = 0;
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
      sentCount++;
    }
  });
  console.log(`[Broadcast] ${type} sent to ${sentCount}/${wss.clients.size} clients`);
}

// ============ MENU ITEMS ============
app.get('/api/menu', (req, res) => {
  const items = queryAll('SELECT * FROM menu_items');
  res.json(items.map(item => ({
    ...item,
    available: Boolean(item.available)
  })));
});

app.post('/api/menu', (req, res) => {
  const { id, name, price, category, available, description, image } = req.body;
  runQuery(`
    INSERT INTO menu_items (id, name, price, category, available, description, image)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, name, price, category, available ? 1 : 0, description, image]);
  broadcast('MENU_UPDATE', { action: 'add', item: req.body });
  res.json({ success: true });
});

app.put('/api/menu/:id', (req, res) => {
  const { name, price, category, available, description, image } = req.body;
  runQuery(`
    UPDATE menu_items SET name=?, price=?, category=?, available=?, description=?, image=?
    WHERE id=?
  `, [name, price, category, available ? 1 : 0, description, image, req.params.id]);
  broadcast('MENU_UPDATE', { action: 'update', item: { id: req.params.id, ...req.body } });
  res.json({ success: true });
});

app.delete('/api/menu/:id', (req, res) => {
  runQuery('DELETE FROM menu_items WHERE id=?', [req.params.id]);
  broadcast('MENU_UPDATE', { action: 'delete', id: req.params.id });
  res.json({ success: true });
});

// ============ ORDERS ============
app.get('/api/orders', (req, res) => {
  const orders = queryAll('SELECT * FROM orders');
  const orderItems = queryAll('SELECT * FROM order_items');
  
  const ordersWithItems = orders.map(order => ({
    id: order.id,
    tableNumber: order.table_number,
    customerPhone: order.customer_phone,
    status: order.status,
    total: order.total,
    notes: order.notes,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: orderItems.filter(item => item.order_id === order.id).map(item => ({
      id: item.id,
      menuItemId: item.menu_item_id,
      name: item.name,
      qty: item.qty,
      price: item.price
    }))
  }));
  res.json(ordersWithItems);
});

app.post('/api/orders', (req, res) => {
  const { id, tableNumber, customerPhone, items, status, total, notes, createdAt, updatedAt } = req.body;
  
  runQuery(`
    INSERT INTO orders (id, table_number, customer_phone, status, total, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, tableNumber, customerPhone, status, total, notes, createdAt, updatedAt]);
  
  items.forEach(item => {
    runQuery(`
      INSERT INTO order_items (id, order_id, menu_item_id, name, qty, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [item.id, id, item.menuItemId, item.name, item.qty, item.price]);
  });
  
  broadcast('ORDER_UPDATE', { action: 'add', order: req.body });
  res.json({ success: true });
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;
  const now = new Date().toISOString();
  runQuery('UPDATE orders SET status=?, updated_at=? WHERE id=?', [status, now, req.params.id]);
  broadcast('ORDER_UPDATE', { action: 'status', id: req.params.id, status });
  res.json({ success: true });
});

// ============ BILLS ============
app.get('/api/bills', (req, res) => {
  const bills = queryAll('SELECT * FROM bills');
  const billOrders = queryAll('SELECT * FROM bill_orders');
  const orders = queryAll('SELECT * FROM orders');
  const orderItems = queryAll('SELECT * FROM order_items');
  
  const billsWithOrders = bills.map(bill => {
    const orderIds = billOrders.filter(bo => bo.bill_id === bill.id).map(bo => bo.order_id);
    const billOrdersData = orders.filter(o => orderIds.includes(o.id)).map(order => ({
      id: order.id,
      tableNumber: order.table_number,
      customerPhone: order.customer_phone,
      status: order.status,
      total: order.total,
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      items: orderItems.filter(item => item.order_id === order.id).map(item => ({
        id: item.id,
        menuItemId: item.menu_item_id,
        name: item.name,
        qty: item.qty,
        price: item.price
      }))
    }));
    
    return {
      id: bill.id,
      tableNumber: bill.table_number,
      customerPhones: JSON.parse(bill.customer_phones),
      subtotal: bill.subtotal,
      discount: bill.discount,
      total: bill.total,
      status: bill.status,
      paymentMethod: bill.payment_method,
      paidAt: bill.paid_at,
      createdAt: bill.created_at,
      orders: billOrdersData
    };
  });
  res.json(billsWithOrders);
});

app.post('/api/bills', (req, res) => {
  const { id, tableNumber, orders, customerPhones, subtotal, discount, total, status, createdAt } = req.body;
  
  runQuery(`
    INSERT INTO bills (id, table_number, customer_phones, subtotal, discount, total, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, tableNumber, JSON.stringify(customerPhones), subtotal, discount, total, status, createdAt]);
  
  orders.forEach(order => {
    runQuery('INSERT INTO bill_orders (bill_id, order_id) VALUES (?, ?)', [id, order.id]);
  });
  
  broadcast('BILL_UPDATE', { action: 'add', bill: req.body });
  res.json({ success: true });
});

app.put('/api/bills/:id/pay', (req, res) => {
  const { paymentMethod, paidAt } = req.body;
  
  // Update bill status
  runQuery(`
    UPDATE bills SET status='paid', payment_method=?, paid_at=? WHERE id=?
  `, [paymentMethod, paidAt, req.params.id]);
  
  // Get all orders associated with this bill and mark them as 'served'
  const billOrders = queryAll('SELECT order_id FROM bill_orders WHERE bill_id=?', [req.params.id]);
  const now = new Date().toISOString();
  billOrders.forEach(bo => {
    runQuery('UPDATE orders SET status=?, updated_at=? WHERE id=?', ['served', now, bo.order_id]);
  });
  
  // Broadcast both bill and order updates
  broadcast('BILL_UPDATE', { action: 'pay', id: req.params.id, paymentMethod, paidAt });
  broadcast('ORDER_UPDATE', { action: 'bulk_status', orderIds: billOrders.map(bo => bo.order_id), status: 'served' });
  
  res.json({ success: true });
});

// ============ TRANSACTIONS ============
app.get('/api/transactions', (req, res) => {
  const transactions = queryAll('SELECT * FROM transactions');
  res.json(transactions.map(t => ({
    id: t.id,
    billId: t.bill_id,
    tableNumber: t.table_number,
    customerPhones: JSON.parse(t.customer_phones),
    total: t.total,
    discount: t.discount,
    paymentMethod: t.payment_method,
    paidAt: t.paid_at,
    items: JSON.parse(t.items)
  })));
});

app.post('/api/transactions', (req, res) => {
  try {
    const { id, billId, tableNumber, customerPhones, total, discount, paymentMethod, paidAt, items } = req.body;
    
    // Validate required fields
    if (!id || !billId || tableNumber === undefined || !paymentMethod || !paidAt) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    runQuery(`
      INSERT INTO transactions (id, bill_id, table_number, customer_phones, total, discount, payment_method, paid_at, items)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, 
      billId, 
      tableNumber, 
      JSON.stringify(customerPhones || []), 
      total || 0, 
      discount || 0, 
      paymentMethod, 
      paidAt, 
      JSON.stringify(items || [])
    ]);
    broadcast('TRANSACTION_UPDATE', { action: 'add', transaction: req.body });
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Transaction creation error:', error);
    res.status(500).json({ message: 'Failed to create transaction' });
  }
});

// ============ CUSTOMERS ============
app.get('/api/customers', (req, res) => {
  const customers = queryAll('SELECT * FROM customers');
  res.json(customers.map(c => ({
    phone: c.phone,
    name: c.name,
    totalOrders: c.total_orders,
    totalSpent: c.total_spent,
    points: c.points,
    lastVisit: c.last_visit
  })));
});

app.post('/api/customers', (req, res) => {
  const { phone, name, totalOrders, totalSpent, points, lastVisit } = req.body;
  runQuery(`
    INSERT OR REPLACE INTO customers (phone, name, total_orders, total_spent, points, last_visit)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [phone, name, totalOrders, totalSpent, points, lastVisit]);
  broadcast('CUSTOMER_UPDATE', req.body);
  res.json({ success: true });
});

// ============ STAFF ============
app.get('/api/staff', (req, res) => {
  const staff = queryAll('SELECT * FROM staff');
  res.json(staff.map(s => ({
    id: s.id,
    username: s.username,
    password: s.password,
    role: s.role,
    name: s.name,
    createdAt: s.created_at
  })));
});

app.post('/api/staff', (req, res) => {
  const { id, username, password, role, name, createdAt } = req.body;
  runQuery(`
    INSERT INTO staff (id, username, password, role, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, username, password, role, name, createdAt]);
  broadcast('STAFF_UPDATE', { action: 'add', staff: req.body });
  res.json({ success: true });
});

app.put('/api/staff/:id', (req, res) => {
  const { username, password, role, name } = req.body;
  runQuery(`
    UPDATE staff SET username=?, password=?, role=?, name=? WHERE id=?
  `, [username, password, role, name, req.params.id]);
  broadcast('STAFF_UPDATE', { action: 'update', staff: { id: req.params.id, ...req.body } });
  res.json({ success: true });
});

app.delete('/api/staff/:id', (req, res) => {
  runQuery('DELETE FROM staff WHERE id=?', [req.params.id]);
  broadcast('STAFF_UPDATE', { action: 'delete', id: req.params.id });
  res.json({ success: true });
});

app.delete('/api/expenses/:id', (req, res) => {
  runQuery('DELETE FROM expenses WHERE id=?', [req.params.id]);
  broadcast('EXPENSE_UPDATE', { action: 'delete', id: req.params.id });
  res.json({ success: true });
});

app.delete('/api/waiter-calls/:id', (req, res) => {
  runQuery('DELETE FROM waiter_calls WHERE id=?', [req.params.id]);
  broadcast('WAITER_CALL', { action: 'dismiss', id: req.params.id });
  res.json({ success: true });
});

// ============ SETTINGS ============
app.get('/api/settings', (req, res) => {
  const settings = queryOne('SELECT * FROM settings WHERE id=1');
  res.json({
    restaurantName: settings?.restaurant_name || 'Chiya Dani',
    tableCount: settings?.table_count || 10,
    wifiSSID: settings?.wifi_ssid,
    wifiPassword: settings?.wifi_password,
    baseUrl: settings?.base_url,
    logo: settings?.logo,
    instagramUrl: settings?.instagram_url,
    facebookUrl: settings?.facebook_url,
    tiktokUrl: settings?.tiktok_url,
    googleReviewUrl: settings?.google_review_url
  });
});

app.put('/api/settings', (req, res) => {
  const { restaurantName, tableCount, wifiSSID, wifiPassword, baseUrl, logo, instagramUrl, facebookUrl, tiktokUrl, googleReviewUrl } = req.body;
  runQuery(`
    UPDATE settings SET 
      restaurant_name=?, table_count=?, wifi_ssid=?, wifi_password=?, base_url=?, 
      logo=?, instagram_url=?, facebook_url=?, tiktok_url=?, google_review_url=?
    WHERE id=1
  `, [restaurantName, tableCount, wifiSSID, wifiPassword, baseUrl, logo, instagramUrl, facebookUrl, tiktokUrl, googleReviewUrl]);
  broadcast('SETTINGS_UPDATE', req.body);
  res.json({ success: true });
});

// ============ EXPENSES ============
app.get('/api/expenses', (req, res) => {
  const expenses = queryAll('SELECT * FROM expenses');
  res.json(expenses.map(e => ({
    id: e.id,
    amount: e.amount,
    description: e.description,
    category: e.category,
    createdAt: e.created_at,
    createdBy: e.created_by
  })));
});

app.post('/api/expenses', (req, res) => {
  const { id, amount, description, category, createdAt, createdBy } = req.body;
  runQuery(`
    INSERT INTO expenses (id, amount, description, category, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, amount, description, category, createdAt, createdBy]);
  broadcast('EXPENSE_UPDATE', { action: 'add', expense: req.body });
  res.json({ success: true });
});

// ============ WAITER CALLS ============
app.get('/api/waiter-calls', (req, res) => {
  const calls = queryAll('SELECT * FROM waiter_calls');
  res.json(calls.map(c => ({
    id: c.id,
    tableNumber: c.table_number,
    customerPhone: c.customer_phone,
    status: c.status,
    createdAt: c.created_at,
    acknowledgedAt: c.acknowledged_at
  })));
});

app.post('/api/waiter-calls', (req, res) => {
  const { id, tableNumber, customerPhone, status, createdAt } = req.body;
  runQuery(`
    INSERT INTO waiter_calls (id, table_number, customer_phone, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `, [id, tableNumber, customerPhone, status, createdAt]);
  broadcast('WAITER_CALL', { action: 'add', call: req.body });
  res.json({ success: true });
});

app.put('/api/waiter-calls/:id/acknowledge', (req, res) => {
  const now = new Date().toISOString();
  runQuery(`
    UPDATE waiter_calls SET status='acknowledged', acknowledged_at=? WHERE id=?
  `, [now, req.params.id]);
  broadcast('WAITER_CALL', { action: 'acknowledge', id: req.params.id });
  res.json({ success: true });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] Client connected from ${clientIp}. Total clients: ${wss.clients.size}`);
  
  // Send connection acknowledgment
  ws.send(JSON.stringify({ type: 'CONNECTED', data: { clientCount: wss.clients.size } }));
  
  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected. Remaining clients: ${wss.clients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error('[WebSocket] Client error:', error);
  });
});

const PORT = process.env.PORT || 3001;

// Initialize database then start server
initDatabase().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`WebSocket running on ws://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
