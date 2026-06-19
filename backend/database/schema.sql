CREATE TABLE IF NOT EXISTS tenants (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  lot_no VARCHAR(60) NOT NULL,
  lease_type VARCHAR(80) NOT NULL,
  monthly_rate NUMERIC(12, 2) NOT NULL CHECK (monthly_rate >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month CHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'partial')),
  payment_date DATE,
  reference_no VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, month)
);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('renovation', 'maintenance', 'misc')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

CREATE TABLE IF NOT EXISTS visitor_profiles (
  visitor_id UUID PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_count INTEGER NOT NULL DEFAULT 1,
  is_returning BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent TEXT,
  ip_address INET
);

CREATE TABLE IF NOT EXISTS visitor_events (
  id BIGSERIAL PRIMARY KEY,
  visitor_id UUID NOT NULL REFERENCES visitor_profiles(visitor_id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  event_type VARCHAR(40) NOT NULL CHECK (event_type IN ('consent_accepted', 'page_view')),
  page_key VARCHAR(60),
  page_path VARCHAR(255),
  device_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent TEXT,
  ip_address INET,
  is_returning BOOLEAN NOT NULL DEFAULT FALSE,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_events_visited_at ON visitor_events(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_page_key ON visitor_events(page_key);

-- Example parameterized insert used by API:
-- INSERT INTO visitor_events(visitor_id, session_id, event_type, page_key, page_path, device_info, user_agent, ip_address, is_returning)
-- VALUES($1, $2, 'page_view', $3, $4, $5::jsonb, $6, $7, $8);