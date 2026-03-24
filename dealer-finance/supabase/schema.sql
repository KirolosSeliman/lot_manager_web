-- ═══════════════════════════════════════════════════════
-- DEALER FINANCE MANAGER — Supabase Schema
-- Colle ce SQL dans Supabase > SQL Editor > Run
-- ═══════════════════════════════════════════════════════

-- 1. PROFILES (linked to Supabase Auth)
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'employee' check (role in ('admin','employee')),
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "Profiles visible to authenticated" on profiles for select using (auth.role() = 'authenticated');
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role','employee'));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. VEHICLES
create table if not exists vehicles (
  id               uuid primary key default gen_random_uuid(),
  vin              text,
  year             int,
  make             text not null,
  model            text not null,
  color            text,
  transmission     text check (transmission in ('Automatique','Manuelle')),
  mileage          int,
  origin_province  text default 'Québec',
  purchase_source  text check (purchase_source in ('OpenLane','Autre encan','Achat privé','Reprise')),
  purchase_date    date,
  status           text not null default 'bought' check (status in ('bought','repair','lot','sold')),
  notes            text,
  created_by       uuid references profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table vehicles enable row level security;
create policy "Vehicles: auth read" on vehicles for select using (auth.role() = 'authenticated');
create policy "Vehicles: auth insert" on vehicles for insert with check (auth.role() = 'authenticated');
create policy "Vehicles: auth update" on vehicles for update using (auth.role() = 'authenticated');
create policy "Vehicles: admin delete" on vehicles for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- 3. VEHICLE COSTS
create table if not exists vehicle_costs (
  id                  uuid primary key default gen_random_uuid(),
  vehicle_id          uuid not null references vehicles(id) on delete cascade,
  cost_type           text not null,
  label               text,
  amount              numeric(12,2) not null default 0,
  is_tax_recoverable  boolean default false,
  created_at          timestamptz default now()
);
alter table vehicle_costs enable row level security;
create policy "Costs: auth all" on vehicle_costs for all using (auth.role() = 'authenticated');

-- 4. VEHICLE SALES
create table if not exists vehicle_sales (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade unique,
  sale_price    numeric(12,2) not null,
  sale_date     date not null,
  sale_channel  text check (sale_channel in ('marketplace','private','auction','other')),
  sale_notes    text,
  created_at    timestamptz default now()
);
alter table vehicle_sales enable row level security;
create policy "Sales: auth all" on vehicle_sales for all using (auth.role() = 'authenticated');

-- 5. VEHICLE MEDIA
create table if not exists vehicle_media (
  id            uuid primary key default gen_random_uuid(),
  vehicle_id    uuid not null references vehicles(id) on delete cascade,
  type          text check (type in ('photo','document')),
  storage_path  text not null,
  label         text,
  display_order int default 0,
  created_at    timestamptz default now()
);
alter table vehicle_media enable row level security;
create policy "Media: auth all" on vehicle_media for all using (auth.role() = 'authenticated');

-- 6. FIXED EXPENSES
create table if not exists fixed_expenses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  amount      numeric(12,2) not null,
  frequency   text not null check (frequency in ('monthly','annual','weekly')),
  category    text check (category in ('plates','subscriptions','insurance','office','other')),
  start_date  date default current_date,
  is_active   boolean default true,
  created_at  timestamptz default now()
);
alter table fixed_expenses enable row level security;
create policy "Expenses: admin all" on fixed_expenses for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Expenses: employee read" on fixed_expenses for select using (auth.role() = 'authenticated');

-- 7. SETTINGS (key-value)
create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz default now()
);
alter table settings enable row level security;
create policy "Settings: auth read" on settings for select using (auth.role() = 'authenticated');
create policy "Settings: admin write" on settings for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- 8. OPENLANE FEE BRACKETS
create table if not exists openlane_brackets (
  id          uuid primary key default gen_random_uuid(),
  min_price   numeric(12,2) not null,
  max_price   numeric(12,2),
  fee_amount  numeric(12,2) not null
);
alter table openlane_brackets enable row level security;
create policy "Brackets: auth read" on openlane_brackets for select using (auth.role() = 'authenticated');
create policy "Brackets: admin write" on openlane_brackets for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- ── SEED DEFAULT DATA ────────────────────────────────────

-- Default settings
insert into settings (key, value) values
  ('commission_fixed',    '250'),
  ('lot_time_alert_days', '60'),
  ('currency',            '"CAD"'),
  ('tax_rates', '{
    "QC": {"TPS": 0.05, "TVQ": 0.09975},
    "ON": {"TPS": 0.05, "TVP": 0.08},
    "AB": {"TPS": 0.05, "TVP": 0.00},
    "BC": {"TPS": 0.05, "TVP": 0.07},
    "MB": {"TPS": 0.05, "TVP": 0.07},
    "SK": {"TPS": 0.05, "TVP": 0.06},
    "NS": {"TPS": 0.05, "TVP": 0.10},
    "NB": {"TPS": 0.05, "TVP": 0.10},
    "PE": {"TPS": 0.05, "TVP": 0.10},
    "NL": {"TPS": 0.05, "TVP": 0.10}
  }')
on conflict (key) do nothing;

-- Default OpenLane brackets
insert into openlane_brackets (min_price, max_price, fee_amount) values
  (0,       999,   100),
  (1000,    1999,  150),
  (2000,    3999,  200),
  (4000,    5999,  250),
  (6000,    7999,  300),
  (8000,    9999,  375),
  (10000,   14999, 425),
  (15000,   null,  500)
on conflict do nothing;

-- ── STORAGE BUCKETS ──────────────────────────────────────
-- Run these separately in Supabase Dashboard > Storage:
-- 1. Create bucket "vehicle-photos" (public: true)
-- 2. Create bucket "vehicle-documents" (public: false)

-- ── HELPER VIEWS ─────────────────────────────────────────

-- Vehicle with total cost and profit
create or replace view vehicle_summary as
select
  v.*,
  coalesce(costs.total_cost, 0) as total_cost,
  s.sale_price,
  s.sale_date,
  s.sale_channel,
  case when s.sale_price is not null
    then s.sale_price - coalesce(costs.total_cost, 0)
    else null
  end as net_profit,
  case when s.sale_date is not null
    then (s.sale_date - v.purchase_date)
    else (current_date - v.purchase_date)
  end as days_on_lot
from vehicles v
left join (
  select vehicle_id, sum(amount) as total_cost
  from vehicle_costs
  group by vehicle_id
) costs on costs.vehicle_id = v.id
left join vehicle_sales s on s.vehicle_id = v.id;
