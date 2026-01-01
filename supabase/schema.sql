-- ===========================================
-- Sajilo Orders POS - Optimized Database Schema
-- Version 3.1 - Fixed for Fresh Deployments
-- Optimized for: Free-tier Supabase, 50k+ monthly customers
-- ===========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fast text search

-- Note: pg_cron and pg_net may not be available on all Supabase plans
-- Uncomment if available:
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";
-- CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ===========================================
-- DROP EXISTING OBJECTS (Clean Slate)
-- ===========================================

-- Drop tables FIRST (CASCADE will drop triggers, indexes, policies automatically)
DROP TABLE IF EXISTS item_portion_prices CASCADE;
DROP TABLE IF EXISTS portion_options CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS inventory_categories CASCADE;
DROP TABLE IF EXISTS payment_blocks CASCADE;
DROP TABLE IF EXISTS waiter_calls CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- Drop types (CASCADE handles dependencies)
DROP TYPE IF EXISTS inventory_unit_type CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS get_low_stock_items() CASCADE;
DROP FUNCTION IF EXISTS get_inventory_summary() CASCADE;
DROP FUNCTION IF EXISTS get_item_portion_prices(TEXT) CASCADE;
DROP FUNCTION IF EXISTS deduct_inventory(TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS deduct_inventory_batch(JSONB, TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_unit_default_threshold(inventory_unit_type) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_payment_blocks() CASCADE;
DROP FUNCTION IF EXISTS override_payment_block(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS record_payment_block(SMALLINT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS check_payment_block(SMALLINT, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS get_daily_stats(DATE) CASCADE;
DROP FUNCTION IF EXISTS get_active_orders_summary() CASCADE;
DROP FUNCTION IF EXISTS archive_old_orders(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_customer_analytics(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_customer_stats() CASCADE;
DROP FUNCTION IF EXISTS immutable_date(TIMESTAMPTZ) CASCADE;

-- ===========================================
-- HELPER FUNCTIONS (Must be created before tables)
-- ===========================================

-- Immutable date extraction function (fixes "generation expression is not immutable" error)
-- IMPORTANT: Use plpgsql to prevent inlining during generated-column immutability checks.
CREATE OR REPLACE FUNCTION immutable_date(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  RETURN (ts AT TIME ZONE 'UTC')::DATE;
END;
$$;

-- Immutable timestamptz + interval helper for generated columns
CREATE OR REPLACE FUNCTION immutable_add_interval(ts TIMESTAMPTZ, i INTERVAL)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  RETURN ts + i;
END;
$$;

-- ===========================================
-- CUSTOM TYPES (Enums for performance)
-- ===========================================

CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'preparing', 'ready', 'served', 'cancelled');
CREATE TYPE payment_method AS ENUM ('cash', 'fonepay', 'card', 'credit');
CREATE TYPE inventory_unit_type AS ENUM ('ml', 'pcs', 'grams', 'bottle', 'pack', 'kg', 'liter');

-- ===========================================
-- CORE TABLES - Optimized Structure
-- ===========================================

-- Categories table with materialized path for hierarchy
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order SMALLINT DEFAULT 0,
  prep_time SMALLINT DEFAULT 5,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  path TEXT DEFAULT '',
  use_bar_printer BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items table - optimized column order for alignment
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL,
  available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table - optimized for high-frequency writes
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  table_number SMALLINT NOT NULL,
  status order_status DEFAULT 'pending',
  priority SMALLINT DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_phone VARCHAR(20) DEFAULT '',
  notes TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  created_by TEXT,
  is_waiter_order BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills table - optimized for payment processing
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  table_number SMALLINT NOT NULL,
  status VARCHAR(10) DEFAULT 'unpaid',
  payment_method payment_method,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  orders JSONB NOT NULL DEFAULT '[]',
  customer_phones JSONB NOT NULL DEFAULT '[]',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table - append-only for sales history
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  bill_id TEXT,
  table_number SMALLINT NOT NULL,
  payment_method payment_method NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  customer_phones JSONB DEFAULT '[]',
  items JSONB DEFAULT '[]',
  paid_at TIMESTAMPTZ NOT NULL,
  -- Denormalized for fast daily reports (uses immutable function)
  paid_date DATE GENERATED ALWAYS AS (immutable_date(paid_at)) STORED
);

-- Customers table - optimized for loyalty lookups
CREATE TABLE customers (
  phone VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) DEFAULT '',
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  points INTEGER DEFAULT 0,
  last_visit TIMESTAMPTZ DEFAULT NOW(),
  first_visit TIMESTAMPTZ DEFAULT NOW(),
  -- Denormalized for fast tier queries
  tier VARCHAR(10) GENERATED ALWAYS AS (
    CASE 
      WHEN total_spent >= 50000 THEN 'platinum'
      WHEN total_spent >= 20000 THEN 'gold'
      WHEN total_spent >= 5000 THEN 'silver'
      ELSE 'bronze'
    END
  ) STORED
);

-- Staff table
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  pin VARCHAR(6) DEFAULT '',
  role VARCHAR(20) DEFAULT 'counter',
  name VARCHAR(100) DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table (single row)
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  restaurant_name VARCHAR(100) DEFAULT 'Sajilo Orders',
  restaurant_sub_name VARCHAR(100) DEFAULT '',
  table_count SMALLINT DEFAULT 10,
  wifi_ssid VARCHAR(100) DEFAULT '',
  wifi_password VARCHAR(100) DEFAULT '',
  base_url TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  instagram_url TEXT DEFAULT '',
  facebook_url TEXT DEFAULT '',
  tiktok_url TEXT DEFAULT '',
  google_review_url TEXT DEFAULT '',
  counter_as_admin BOOLEAN DEFAULT false,
  counter_kitchen_access BOOLEAN DEFAULT false,
  counter_kot_enabled BOOLEAN DEFAULT false,
  kitchen_handles SMALLINT DEFAULT 3,
  point_system_enabled BOOLEAN DEFAULT false,
  kds_enabled BOOLEAN DEFAULT false,
  kot_printing_enabled BOOLEAN DEFAULT false,
  kitchen_fullscreen_mode BOOLEAN DEFAULT false,
  accepted_order_cancel_admin_only BOOLEAN DEFAULT false,
  dual_printer_enabled BOOLEAN DEFAULT false,
  theme VARCHAR(10) DEFAULT 'system',
  sound_alerts_enabled BOOLEAN DEFAULT true,
  points_per_rupee NUMERIC(5,3) DEFAULT 0.1,
  point_value_in_rupees NUMERIC(5,2) DEFAULT 1,
  max_discount_rupees NUMERIC(8,2) DEFAULT 500,
  max_discount_points INTEGER DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_settings CHECK (id = 1)
);

-- Expenses table
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  category VARCHAR(30) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT DEFAULT '',
  created_by VARCHAR(50) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Denormalized date for fast daily reports (uses immutable function)
  expense_date DATE GENERATED ALWAYS AS (immutable_date(created_at)) STORED
);

-- Waiter calls table
CREATE TABLE waiter_calls (
  id TEXT PRIMARY KEY,
  table_number SMALLINT NOT NULL,
  customer_phone VARCHAR(20) DEFAULT '',
  status VARCHAR(15) DEFAULT 'pending',
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment blocks table (3-hour cooldown)
CREATE TABLE payment_blocks (
  id SERIAL PRIMARY KEY,
  table_number SMALLINT NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  staff_override BOOLEAN DEFAULT FALSE,
  override_at TIMESTAMPTZ,
  -- Auto-expire after 24 hours (generated columns require immutable expressions)
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (immutable_add_interval(paid_at, INTERVAL '24 hours')) STORED
);

-- ===========================================
-- INVENTORY SYSTEM - Optimized
-- ===========================================

-- Inventory categories
CREATE TABLE inventory_categories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  unit_type inventory_unit_type NOT NULL DEFAULT 'pcs',
  default_container_size NUMERIC(10,2),
  low_stock_threshold NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id)
);

-- Inventory items (stock tracking)
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  container_size NUMERIC(10,2),
  unit inventory_unit_type NOT NULL DEFAULT 'pcs',
  low_stock_threshold NUMERIC(10,2),
  -- Denormalized for fast stock status
  stock_status VARCHAR(10) GENERATED ALWAYS AS (
    CASE 
      WHEN current_stock <= 0 THEN 'out'
      WHEN current_stock <= COALESCE(low_stock_threshold, 10) * 0.25 THEN 'critical'
      WHEN current_stock <= COALESCE(low_stock_threshold, 10) THEN 'low'
      ELSE 'ok'
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(menu_item_id)
);

-- Inventory transactions (audit log)
CREATE TABLE inventory_transactions (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type VARCHAR(15) NOT NULL CHECK (transaction_type IN ('receive', 'sale', 'adjustment', 'waste')),
  quantity NUMERIC(10,2) NOT NULL,
  unit inventory_unit_type NOT NULL,
  order_id TEXT,
  notes TEXT DEFAULT '',
  created_by VARCHAR(50) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portion options
CREATE TABLE portion_options (
  id TEXT PRIMARY KEY,
  inventory_category_id TEXT NOT NULL REFERENCES inventory_categories(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  size NUMERIC(10,2) NOT NULL,
  price_multiplier NUMERIC(5,2) DEFAULT 1.0,
  fixed_price NUMERIC(10,2),
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Item-specific portion prices
CREATE TABLE item_portion_prices (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  portion_option_id TEXT NOT NULL REFERENCES portion_options(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(menu_item_id, portion_option_id)
);

-- ===========================================
-- OPTIMIZED INDEXES
-- ===========================================

-- Categories
CREATE INDEX idx_categories_sort ON categories(sort_order);
CREATE INDEX idx_categories_parent ON categories(parent_id) WHERE parent_id IS NOT NULL;

-- Menu Items
CREATE INDEX idx_menu_category ON menu_items(category);
CREATE INDEX idx_menu_available ON menu_items(category, available) WHERE available = true;
CREATE INDEX idx_menu_popular ON menu_items(is_popular) WHERE is_popular = true;

-- Orders - Critical for restaurant operations
CREATE INDEX idx_orders_active ON orders(status, created_at DESC) 
  WHERE status IN ('pending', 'accepted', 'preparing', 'ready');
CREATE INDEX idx_orders_table_active ON orders(table_number, status) 
  WHERE status NOT IN ('served', 'cancelled');
CREATE INDEX idx_orders_pending ON orders(created_at DESC) WHERE status = 'pending';
-- NOTE: Partial indexes must use IMMUTABLE predicates. Avoid CURRENT_DATE/NOW() in predicates.
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Bills
CREATE INDEX idx_bills_unpaid ON bills(table_number, created_at DESC) WHERE status = 'unpaid';
CREATE INDEX idx_bills_paid_at ON bills(paid_at DESC);

-- Transactions - For reports
CREATE INDEX idx_tx_date ON transactions(paid_date DESC);
CREATE INDEX idx_tx_method_date ON transactions(payment_method, paid_date);

-- Customers
CREATE INDEX idx_customers_tier ON customers(tier, total_spent DESC);
CREATE INDEX idx_customers_points ON customers(points DESC) WHERE points > 0;
CREATE INDEX idx_customers_recent ON customers(last_visit DESC);

-- Staff
CREATE INDEX idx_staff_active ON staff(role) WHERE is_active = true;

-- Expenses
CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_category_date ON expenses(category, expense_date);

-- Waiter calls
CREATE INDEX idx_waiter_pending ON waiter_calls(table_number, created_at DESC) 
  WHERE status = 'pending';

-- Payment blocks
CREATE INDEX idx_blocks_active ON payment_blocks(table_number, customer_phone, paid_at DESC) 
  WHERE staff_override = false;

-- Inventory
CREATE INDEX idx_inv_status ON inventory_items(stock_status) WHERE stock_status != 'ok';
CREATE INDEX idx_inv_menu ON inventory_items(menu_item_id);
CREATE INDEX idx_inv_tx_item ON inventory_transactions(inventory_item_id, created_at DESC);
CREATE INDEX idx_inv_tx_order ON inventory_transactions(order_id) WHERE order_id IS NOT NULL;

-- Portion prices
CREATE INDEX idx_portion_lookup ON item_portion_prices(menu_item_id, portion_option_id);

-- ===========================================
-- AUTO-UPDATE TRIGGERS
-- ===========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update customer stats on transaction
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers 
  SET 
    total_orders = total_orders + 1,
    total_spent = total_spent + NEW.total,
    last_visit = NEW.paid_at
  WHERE phone = ANY(
    SELECT jsonb_array_elements_text(NEW.customer_phones)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_customer_stats
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_customer_stats();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portion_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_portion_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Public access for restaurant POS)
CREATE POLICY "allow_all" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON waiter_calls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payment_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON portion_options FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON item_portion_prices FOR ALL USING (true) WITH CHECK (true);

-- ===========================================
-- REALTIME SUBSCRIPTIONS
-- (Configured later in the "API ACCESS (Grants) + REALTIME SETUP" section)
-- ===========================================

-- ===========================================
-- OPTIMIZED FUNCTIONS
-- ===========================================

-- Fast daily stats (uses denormalized paid_date)
CREATE OR REPLACE FUNCTION get_daily_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_revenue NUMERIC,
  total_orders BIGINT,
  total_transactions BIGINT,
  cash_revenue NUMERIC,
  digital_revenue NUMERIC,
  total_expenses NUMERIC,
  net_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH tx_stats AS (
    SELECT 
      COALESCE(SUM(t.total), 0) as revenue,
      COUNT(*) as tx_count,
      COALESCE(SUM(t.total) FILTER (WHERE t.payment_method = 'cash'), 0) as cash,
      COALESCE(SUM(t.total) FILTER (WHERE t.payment_method != 'cash'), 0) as digital
    FROM transactions t
    WHERE t.paid_date = target_date
  ),
  order_stats AS (
    SELECT COUNT(*) as order_count
    FROM orders o
    WHERE immutable_date(o.created_at) = target_date
      AND o.status NOT IN ('cancelled')
  ),
  expense_stats AS (
    SELECT COALESCE(SUM(e.amount), 0) as expenses
    FROM expenses e
    WHERE e.expense_date = target_date
  )
  SELECT 
    ts.revenue,
    os.order_count,
    ts.tx_count,
    ts.cash,
    ts.digital,
    es.expenses,
    ts.revenue - es.expenses
  FROM tx_stats ts, order_stats os, expense_stats es;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get active orders summary for counter display
CREATE OR REPLACE FUNCTION get_active_orders_summary()
RETURNS TABLE (
  pending_count BIGINT,
  accepted_count BIGINT,
  preparing_count BIGINT,
  ready_count BIGINT,
  oldest_pending_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE o.status = 'pending'),
    COUNT(*) FILTER (WHERE o.status = 'accepted'),
    COUNT(*) FILTER (WHERE o.status = 'preparing'),
    COUNT(*) FILTER (WHERE o.status = 'ready'),
    EXTRACT(EPOCH FROM (NOW() - MIN(o.created_at) FILTER (WHERE o.status = 'pending')))::INTEGER / 60
  FROM orders o
  WHERE o.status IN ('pending', 'accepted', 'preparing', 'ready');
END;
$$ LANGUAGE plpgsql STABLE;

-- Batch inventory deduction (single transaction for order)
CREATE OR REPLACE FUNCTION deduct_inventory_batch(
  p_items JSONB,
  p_order_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  item RECORD;
  inv_id TEXT;
BEGIN
  FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(menu_item_id TEXT, quantity NUMERIC, unit TEXT)
  LOOP
    SELECT ii.id INTO inv_id FROM inventory_items ii WHERE ii.menu_item_id = item.menu_item_id;
    
    IF inv_id IS NOT NULL THEN
      UPDATE inventory_items 
      SET current_stock = current_stock - item.quantity
      WHERE id = inv_id;
      
      INSERT INTO inventory_transactions (id, inventory_item_id, transaction_type, quantity, unit, order_id)
      VALUES (uuid_generate_v4()::text, inv_id, 'sale', -item.quantity, item.unit::inventory_unit_type, p_order_id);
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Get low stock items (optimized with generated column)
CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS TABLE (
  inventory_item_id TEXT,
  menu_item_name TEXT,
  current_stock NUMERIC,
  threshold NUMERIC,
  unit inventory_unit_type,
  stock_status VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ii.id,
    mi.name,
    ii.current_stock,
    COALESCE(ii.low_stock_threshold, 10)::NUMERIC,
    ii.unit,
    ii.stock_status
  FROM inventory_items ii
  JOIN menu_items mi ON ii.menu_item_id = mi.id
  WHERE ii.stock_status != 'ok'
  ORDER BY 
    CASE ii.stock_status
      WHEN 'out' THEN 1
      WHEN 'critical' THEN 2
      WHEN 'low' THEN 3
    END,
    ii.current_stock ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get unit default threshold
CREATE OR REPLACE FUNCTION get_unit_default_threshold(p_unit inventory_unit_type)
RETURNS NUMERIC AS $$
SELECT CASE p_unit
  WHEN 'ml' THEN 500
  WHEN 'liter' THEN 2
  WHEN 'pcs' THEN 10
  WHEN 'grams' THEN 500
  WHEN 'kg' THEN 1
  WHEN 'bottle' THEN 5
  WHEN 'pack' THEN 3
  ELSE 10
END::NUMERIC;
$$ LANGUAGE sql IMMUTABLE;

-- Payment block functions
CREATE OR REPLACE FUNCTION check_payment_block(p_table SMALLINT, p_phone VARCHAR)
RETURNS TABLE (is_blocked BOOLEAN, paid_at TIMESTAMPTZ, block_id INTEGER) AS $$
  SELECT TRUE, pb.paid_at, pb.id
  FROM payment_blocks pb
  WHERE pb.table_number = p_table
    AND pb.customer_phone = p_phone
    AND pb.paid_at > NOW() - INTERVAL '3 hours'
    AND pb.staff_override = FALSE
  ORDER BY pb.paid_at DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION record_payment_block(p_table SMALLINT, p_phone VARCHAR)
RETURNS INTEGER AS $$
  INSERT INTO payment_blocks (table_number, customer_phone)
  VALUES (p_table, p_phone)
  RETURNING id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION override_payment_block(p_id INTEGER)
RETURNS BOOLEAN AS $$
  UPDATE payment_blocks SET staff_override = TRUE, override_at = NOW() WHERE id = p_id RETURNING TRUE;
$$ LANGUAGE sql;

-- Archive old orders (run weekly via cron)
CREATE OR REPLACE FUNCTION archive_old_orders(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM orders 
  WHERE status IN ('served', 'cancelled') 
    AND created_at < NOW() - (days_old || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  
  DELETE FROM payment_blocks WHERE expires_at < NOW();
  
  RETURN deleted;
END;
$$ LANGUAGE plpgsql;

-- Customer analytics for loyalty
CREATE OR REPLACE FUNCTION get_customer_analytics(p_phone VARCHAR)
RETURNS TABLE (
  phone VARCHAR,
  name VARCHAR,
  tier VARCHAR,
  total_orders INTEGER,
  total_spent NUMERIC,
  points INTEGER,
  avg_order_value NUMERIC,
  days_since_last_visit INTEGER,
  favorite_items JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.phone,
    c.name,
    c.tier,
    c.total_orders,
    c.total_spent,
    c.points,
    CASE WHEN c.total_orders > 0 THEN ROUND(c.total_spent / c.total_orders, 2) ELSE 0 END,
    EXTRACT(DAY FROM NOW() - c.last_visit)::INTEGER,
    COALESCE(
      (SELECT jsonb_agg(item_name ORDER BY cnt DESC)
       FROM (
         SELECT item->>'name' as item_name, COUNT(*) as cnt
         FROM transactions t,
              jsonb_array_elements(t.items) as item
         WHERE t.customer_phones ? c.phone
         GROUP BY item->>'name'
         LIMIT 5
       ) top_items
      ), '[]'::JSONB
    )
  FROM customers c
  WHERE c.phone = p_phone;
END;
$$ LANGUAGE plpgsql STABLE;

-- Item portion prices helper
CREATE OR REPLACE FUNCTION get_item_portion_prices(p_menu_item_id TEXT)
RETURNS TABLE (
  portion_id TEXT,
  portion_name VARCHAR,
  portion_size NUMERIC,
  price NUMERIC,
  is_item_specific BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.name,
    po.size,
    COALESCE(ipp.price, po.fixed_price, 0)::NUMERIC,
    ipp.id IS NOT NULL
  FROM menu_items mi
  JOIN inventory_items ii ON ii.menu_item_id = mi.id
  JOIN inventory_categories ic ON mi.category = (SELECT c.name FROM categories c WHERE c.id = ic.category_id)
  JOIN portion_options po ON po.inventory_category_id = ic.id
  LEFT JOIN item_portion_prices ipp ON ipp.menu_item_id = mi.id AND ipp.portion_option_id = po.id
  WHERE mi.id = p_menu_item_id
  ORDER BY po.sort_order;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================================
-- API ACCESS (Grants) + REALTIME SETUP
-- ===========================================

-- Grants for REST/RPC access via anon key (RLS is NOT enabled by this schema)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Explicit RPC grants (keeps working even if default privileges change)
GRANT EXECUTE ON FUNCTION get_low_stock_items() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_daily_stats(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_active_orders_summary() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION deduct_inventory_batch(JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_item_portion_prices(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_payment_block(SMALLINT, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_payment_block(SMALLINT, VARCHAR) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION override_payment_block(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION archive_old_orders(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_customer_analytics(VARCHAR) TO anon, authenticated;

-- Realtime (required for multi-device syncing)
-- Make UPDATE payloads complete for the critical tables.
ALTER TABLE IF EXISTS orders REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS bills REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS inventory_items REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS inventory_transactions REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS menu_items REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS categories REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS settings REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS expenses REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS staff REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS customers REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS transactions REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS portion_options REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS item_portion_prices REPLICA IDENTITY FULL;

-- Add tables to the realtime publication (idempotent; safe to re-run after DROP/CREATE)
DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'orders',
    'bills',
    'inventory_items',
    'inventory_transactions',
    'waiter_calls',
    'menu_items',
    'categories',
    'settings',
    'expenses',
    'staff',
    'customers',
    'transactions',
    'portion_options',
    'item_portion_prices'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN
    -- Publication doesn't exist on some setups; ignore.
    NULL;
END $$;

-- ===========================================
-- DEFAULT DATA
-- ===========================================

INSERT INTO settings (id, restaurant_name, table_count)
VALUES (1, 'Sajilo Orders', 10)
ON CONFLICT (id) DO NOTHING;

-- ===========================================
-- OPTIONAL: SCHEDULED CRON JOBS
-- Uncomment if pg_cron extension is available
-- ===========================================

/*
-- Unschedule existing jobs if they exist
SELECT cron.unschedule('weekly-archive-old-orders') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-archive-old-orders');

SELECT cron.unschedule('daily-cleanup-payment-blocks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-cleanup-payment-blocks');

-- Weekly cleanup: Archive orders older than 30 days (runs every Sunday at 3 AM)
SELECT cron.schedule(
  'weekly-archive-old-orders',
  '0 3 * * 0',
  $$SELECT archive_old_orders(30)$$
);

-- Daily cleanup: Remove expired payment blocks (runs at 4 AM daily)
SELECT cron.schedule(
  'daily-cleanup-payment-blocks',
  '0 4 * * *',
  $$DELETE FROM payment_blocks WHERE expires_at < NOW()$$
);
*/

-- ===========================================
-- MAINTENANCE & OPTIMIZATION NOTES
-- ===========================================
-- 
-- PERFORMANCE OPTIMIZATIONS APPLIED:
-- 1. Generated columns for stock_status, tier, paid_date (avoid runtime calculations)
-- 2. Immutable helper function for date extraction (fixes "not immutable" error)
-- 3. Partial indexes for active records (pending orders, unpaid bills)
-- 4. SMALLINT for small numbers (table_number, sort_order)
-- 5. VARCHAR with limits instead of unlimited TEXT where appropriate
-- 6. NUMERIC instead of DECIMAL for exact decimal math
-- 7. ENUM types for status fields (smaller, faster comparisons)
-- 8. Single RLS policy per table for simplicity
-- 9. REPLICA IDENTITY FULL for realtime subscriptions
-- 10. Triggers for auto-updating timestamps and customer stats
-- 11. Batch inventory deduction function to reduce round-trips
--
-- FREE TIER LIMITS:
-- - 500MB database (schema optimized for minimal storage)
-- - 50 concurrent connections (use connection pooling)
-- - 2GB bandwidth (indexes reduce data transfer)
--
-- MANUAL MAINTENANCE (if pg_cron not available):
-- Run periodically: SELECT archive_old_orders(30);
-- ===========================================
