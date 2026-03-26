-- ═══════════════════════════════════════════════════
-- AJOUTS AU SCHÉMA — colle dans SQL Editor → Run
-- ═══════════════════════════════════════════════════

-- 1. Ajoute "payé de ma poche" aux coûts de véhicule
alter table vehicle_costs
  add column if not exists paid_out_of_pocket boolean default false;

-- 2. Table pour les injections de capital
create table if not exists capital_transactions (
  id          uuid primary key default gen_random_uuid(),
  amount      numeric(12,2) not null,
  label       text not null default 'Ajout de capital',
  note        text,
  date        date not null default current_date,
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

alter table capital_transactions enable row level security;

drop policy if exists "Capital: admin all"    on capital_transactions;
drop policy if exists "Capital: employee read" on capital_transactions;

create policy "Capital: admin all"
  on capital_transactions for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Capital: employee read"
  on capital_transactions for select using (auth.role() = 'authenticated');

-- 3. Remplace la vue vehicle_summary avec paid_out_of_pocket
drop view if exists vehicle_summary;
create view vehicle_summary as
select
  v.*,
  -- Coût total incluant dépenses perso (pour calcul du vrai profit)
  coalesce(costs.total_cost, 0)              as total_cost,
  -- Coût payé par la compagnie seulement (pour calcul du cash)
  coalesce(costs.company_cost, 0)            as company_cost,
  -- Coût payé de la poche (pour déclaration taxes)
  coalesce(costs.pocket_cost, 0)             as pocket_cost,
  s.sale_price,
  s.sale_date,
  s.sale_channel,
  s.sale_notes,
  -- Profit net = prix vente - TOUS les coûts (vrai profit)
  case
    when s.sale_price is not null
    then s.sale_price - coalesce(costs.total_cost, 0)
    else null
  end as net_profit,
  case
    when s.sale_date is not null then (s.sale_date - v.purchase_date)
    else (current_date - v.purchase_date)
  end as days_on_lot,
  (
    select storage_path from vehicle_media
    where vehicle_id = v.id and type = 'photo'
    order by display_order limit 1
  ) as photo_path
from vehicles v
left join (
  select
    vehicle_id,
    sum(amount)                                          as total_cost,
    sum(case when not paid_out_of_pocket then amount else 0 end) as company_cost,
    sum(case when paid_out_of_pocket     then amount else 0 end) as pocket_cost
  from vehicle_costs
  group by vehicle_id
) costs on costs.vehicle_id = v.id
left join vehicle_sales s on s.vehicle_id = v.id;
