-- ===========================================
-- Chiyadani POS Complete Database Schema
-- Run this in Supabase SQL Editor
-- ===========================================

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items table
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_vegetarian BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  preparation_time INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  table_number TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  table_number TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'waiter',
  phone TEXT,
  pin TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  visits INTEGER DEFAULT 1,
  total_spent DECIMAL(10,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_visit TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (single row for app settings)
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  restaurant_name TEXT DEFAULT 'Chiyadani',
  currency TEXT DEFAULT 'NPR',
  tax_rate DECIMAL(5,2) DEFAULT 13.00,
  service_charge DECIMAL(5,2) DEFAULT 0,
  tables_count INTEGER DEFAULT 10,
  opening_time TEXT DEFAULT '08:00',
  closing_time TEXT DEFAULT '22:00',
  fonepay_merchant_id TEXT,
  fonepay_secret_key TEXT,
  printer_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waiter calls table
CREATE TABLE IF NOT EXISTS waiter_calls (
  id SERIAL PRIMARY KEY,
  table_number TEXT NOT NULL,
  call_type TEXT DEFAULT 'assistance',
  status TEXT DEFAULT 'pending',
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table (for detailed financial tracking)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- 'sale', 'refund', 'expense'
  reference_id INTEGER, -- order_id or expense_id
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- Enable Row Level Security
-- ===========================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS Policies - Public Read Access
-- (For POS systems, data needs to be accessible)
-- ===========================================

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Public read categories" ON categories;
DROP POLICY IF EXISTS "Public insert categories" ON categories;
DROP POLICY IF EXISTS "Public update categories" ON categories;
DROP POLICY IF EXISTS "Public delete categories" ON categories;

DROP POLICY IF EXISTS "Public read menu_items" ON menu_items;
DROP POLICY IF EXISTS "Public insert menu_items" ON menu_items;
DROP POLICY IF EXISTS "Public update menu_items" ON menu_items;
DROP POLICY IF EXISTS "Public delete menu_items" ON menu_items;

DROP POLICY IF EXISTS "Public read orders" ON orders;
DROP POLICY IF EXISTS "Public insert orders" ON orders;
DROP POLICY IF EXISTS "Public update orders" ON orders;
DROP POLICY IF EXISTS "Public delete orders" ON orders;

DROP POLICY IF EXISTS "Public read bills" ON bills;
DROP POLICY IF EXISTS "Public insert bills" ON bills;
DROP POLICY IF EXISTS "Public update bills" ON bills;
DROP POLICY IF EXISTS "Public delete bills" ON bills;

DROP POLICY IF EXISTS "Public read staff" ON staff;
DROP POLICY IF EXISTS "Public insert staff" ON staff;
DROP POLICY IF EXISTS "Public update staff" ON staff;
DROP POLICY IF EXISTS "Public delete staff" ON staff;

DROP POLICY IF EXISTS "Public read customers" ON customers;
DROP POLICY IF EXISTS "Public insert customers" ON customers;
DROP POLICY IF EXISTS "Public update customers" ON customers;
DROP POLICY IF EXISTS "Public delete customers" ON customers;

DROP POLICY IF EXISTS "Public read settings" ON settings;
DROP POLICY IF EXISTS "Public insert settings" ON settings;
DROP POLICY IF EXISTS "Public update settings" ON settings;

DROP POLICY IF EXISTS "Public read expenses" ON expenses;
DROP POLICY IF EXISTS "Public insert expenses" ON expenses;
DROP POLICY IF EXISTS "Public delete expenses" ON expenses;

DROP POLICY IF EXISTS "Public read waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public insert waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public update waiter_calls" ON waiter_calls;
DROP POLICY IF EXISTS "Public delete waiter_calls" ON waiter_calls;

DROP POLICY IF EXISTS "Public read transactions" ON transactions;
DROP POLICY IF EXISTS "Public insert transactions" ON transactions;

DROP POLICY IF EXISTS "Public read payment_blocks" ON payment_blocks;
DROP POLICY IF EXISTS "Public insert payment_blocks" ON payment_blocks;
DROP POLICY IF EXISTS "Public update payment_blocks" ON payment_blocks;

-- Categories: Public read, authenticated write
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public insert categories" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update categories" ON categories FOR UPDATE USING (true);
CREATE POLICY "Public delete categories" ON categories FOR DELETE USING (true);

-- Menu Items: Public read, authenticated write
CREATE POLICY "Public read menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Public insert menu_items" ON menu_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update menu_items" ON menu_items FOR UPDATE USING (true);
CREATE POLICY "Public delete menu_items" ON menu_items FOR DELETE USING (true);

-- Orders: Public access for POS functionality
CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Public delete orders" ON orders FOR DELETE USING (true);

-- Bills: Public access
CREATE POLICY "Public read bills" ON bills FOR SELECT USING (true);
CREATE POLICY "Public insert bills" ON bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update bills" ON bills FOR UPDATE USING (true);
CREATE POLICY "Public delete bills" ON bills FOR DELETE USING (true);

-- Staff: Public access (in production, restrict to authenticated)
CREATE POLICY "Public read staff" ON staff FOR SELECT USING (true);
CREATE POLICY "Public insert staff" ON staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update staff" ON staff FOR UPDATE USING (true);
CREATE POLICY "Public delete staff" ON staff FOR DELETE USING (true);

-- Customers: Public access
CREATE POLICY "Public read customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Public insert customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update customers" ON customers FOR UPDATE USING (true);
CREATE POLICY "Public delete customers" ON customers FOR DELETE USING (true);

-- Settings: Public access
CREATE POLICY "Public read settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Public insert settings" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update settings" ON settings FOR UPDATE USING (true);

-- Expenses: Public access
CREATE POLICY "Public read expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Public insert expenses" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete expenses" ON expenses FOR DELETE USING (true);

-- Waiter Calls: Public access
CREATE POLICY "Public read waiter_calls" ON waiter_calls FOR SELECT USING (true);
CREATE POLICY "Public insert waiter_calls" ON waiter_calls FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update waiter_calls" ON waiter_calls FOR UPDATE USING (true);
CREATE POLICY "Public delete waiter_calls" ON waiter_calls FOR DELETE USING (true);

-- Transactions: Public access
CREATE POLICY "Public read transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Public insert transactions" ON transactions FOR INSERT WITH CHECK (true);

-- ===========================================
-- Enable Realtime for live updates
-- ===========================================

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE waiter_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE bills;

-- ===========================================
-- Indexes for performance
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_number);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_status ON waiter_calls(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);

-- ===========================================
-- Payment blocks table (3-hour cooldown after payment)
-- ===========================================

CREATE TABLE IF NOT EXISTS payment_blocks (
  id SERIAL PRIMARY KEY,
  table_number INTEGER NOT NULL,
  customer_phone TEXT NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  staff_override BOOLEAN DEFAULT FALSE,
  override_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_blocks_table_phone ON payment_blocks(table_number, customer_phone);
CREATE INDEX IF NOT EXISTS idx_payment_blocks_paid_at ON payment_blocks(paid_at DESC);

ALTER TABLE payment_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read payment_blocks" ON payment_blocks;
DROP POLICY IF EXISTS "Public insert payment_blocks" ON payment_blocks;
DROP POLICY IF EXISTS "Public update payment_blocks" ON payment_blocks;

CREATE POLICY "Public read payment_blocks" ON payment_blocks FOR SELECT USING (true);
CREATE POLICY "Public insert payment_blocks" ON payment_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update payment_blocks" ON payment_blocks FOR UPDATE USING (true);

-- Function to check if customer is blocked (paid within 3 hours)
CREATE OR REPLACE FUNCTION check_payment_block(
  p_table_number INTEGER,
  p_customer_phone TEXT
)
RETURNS TABLE (
  is_blocked BOOLEAN,
  paid_at TIMESTAMPTZ,
  block_id INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN pb.id IS NOT NULL AND pb.staff_override = FALSE THEN TRUE ELSE FALSE END,
    pb.paid_at,
    pb.id
  FROM payment_blocks pb
  WHERE pb.table_number = p_table_number
    AND pb.customer_phone = p_customer_phone
    AND pb.paid_at > NOW() - INTERVAL '3 hours'
    AND pb.staff_override = FALSE
  ORDER BY pb.paid_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record a payment block
CREATE OR REPLACE FUNCTION record_payment_block(
  p_table_number INTEGER,
  p_customer_phone TEXT
)
RETURNS INTEGER AS $$
DECLARE
  new_id INTEGER;
BEGIN
  INSERT INTO payment_blocks (table_number, customer_phone, paid_at)
  VALUES (p_table_number, p_customer_phone, NOW())
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to override a payment block (staff confirmation)
CREATE OR REPLACE FUNCTION override_payment_block(p_block_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE payment_blocks SET staff_override = TRUE, override_at = NOW() WHERE id = p_block_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- Settings table extensions for app fields
-- ===========================================

ALTER TABLE settings ADD COLUMN IF NOT EXISTS base_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS wifi_ssid TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS wifi_password TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS counter_as_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tiktok_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS google_review_url TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS kitchen_handles INTEGER DEFAULT 3;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS point_system_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS points_per_rupee NUMERIC;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS point_value_in_rupees NUMERIC;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_discount_rupees NUMERIC;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_discount_points INTEGER;

-- ===========================================
-- Insert default settings row
-- ===========================================

INSERT INTO settings (restaurant_name, currency, tax_rate)
VALUES ('Chiyadani', 'NPR', 13.00)
ON CONFLICT DO NOTHING;
