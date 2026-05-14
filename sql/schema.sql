-- ============================================================
-- LogLife — Schema Supabase
-- Execute no SQL Editor do seu projeto Supabase
-- ============================================================

-- Extensões
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: shipments (envios)
-- ============================================================
create table if not exists shipments (
  id            uuid primary key default uuid_generate_v4(),
  order_id      text not null unique,
  tracking_code text,
  carrier       text not null check (carrier in ('jt','loggi','yampi')),
  status        text not null default 'pending'
                check (status in ('pending','posted','in_transit','out_for_delivery','delivered','failed','returned')),

  -- Remetente
  sender_name   text,
  sender_cep    text,
  sender_city   text,
  sender_state  text,

  -- Destinatário
  recipient_name  text not null,
  recipient_phone text,
  recipient_cep   text not null,
  recipient_city  text not null,
  recipient_state text not null,
  recipient_addr  text,
  recipient_num   text,
  recipient_comp  text,

  -- Pacote
  weight_kg     numeric(8,3),
  length_cm     numeric(6,1),
  width_cm      numeric(6,1),
  height_cm     numeric(6,1),
  value_brl     numeric(10,2),

  -- Produto
  product_name  text,

  -- Datas
  ordered_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  posted_at     timestamptz,
  delivered_at  timestamptz,

  -- Express (Pimenta / Piumhi)
  is_express    boolean not null default false,

  -- NF-e
  nfe_chave     text,
  nfe_numero    text,
  nfe_serie     text,
  nfe_xml_url   text
);

-- ============================================================
-- TABELA: labels (etiquetas)
-- ============================================================
create table if not exists labels (
  id          uuid primary key default uuid_generate_v4(),
  shipment_id uuid references shipments(id) on delete cascade,
  carrier     text not null,
  status      text not null default 'pending'
              check (status in ('pending','printing','printed','error')),
  label_url   text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: express_queue (fila Entregar Agora)
-- ============================================================
create table if not exists express_queue (
  id          uuid primary key default uuid_generate_v4(),
  shipment_id uuid references shipments(id) on delete cascade,
  cep         text not null,
  city        text not null,
  status      text not null default 'waiting'
              check (status in ('waiting','dispatched','delivered','failed')),
  dispatched_at timestamptz,
  created_at    timestamptz not null default now()
);

-- CEPs configurados para a fila express
create table if not exists express_ceps (
  id         uuid primary key default uuid_generate_v4(),
  cep        text not null unique,
  city       text not null,
  state      text not null default 'MG',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- CEPs padrão: Pimenta e Piumhi
insert into express_ceps (cep, city, state) values
  ('35585-000', 'Pimenta', 'MG'),
  ('37925-000', 'Piumhi',  'MG')
on conflict (cep) do nothing;

-- ============================================================
-- TABELA: tickets (suporte)
-- ============================================================
create table if not exists tickets (
  id          uuid primary key default uuid_generate_v4(),
  number      serial unique,
  shipment_id uuid references shipments(id) on delete set null,
  title       text not null,
  description text,
  priority    text not null default 'medium'
              check (priority in ('low','medium','high')),
  status      text not null default 'open'
              check (status in ('open','in_progress','resolved','closed')),
  opened_by   text,
  carrier     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================
-- TABELA: webhooks
-- ============================================================
create table if not exists webhooks (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  url        text not null,
  events     text[] not null default '{}',
  active     boolean not null default true,
  secret     text,
  created_at timestamptz not null default now()
);

create table if not exists webhook_logs (
  id          uuid primary key default uuid_generate_v4(),
  webhook_id  uuid references webhooks(id) on delete cascade,
  event       text not null,
  payload     jsonb,
  status_code int,
  response_ms int,
  success     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABELA: system_logs (logs internos do sistema)
-- ============================================================
create table if not exists system_logs (
  id         uuid primary key default uuid_generate_v4(),
  level      text not null default 'info'
             check (level in ('info','warning','error','success')),
  message    text not null,
  source     text,
  details    jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- TABELA: freight_quotes (histórico de simulações)
-- ============================================================
create table if not exists freight_quotes (
  id            uuid primary key default uuid_generate_v4(),
  origin_cep    text not null,
  dest_cep      text not null,
  weight_kg     numeric(8,3),
  value_brl     numeric(10,2),
  quotes        jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- FUNÇÃO: auto-detectar CEP express ao inserir shipment
-- CORRIGIDO: BEFORE INSERT para que new.is_express seja aplicado
-- ============================================================
create or replace function fn_check_express_cep()
returns trigger language plpgsql as $$
declare
  v_cep_row express_ceps%rowtype;
begin
  select * into v_cep_row
  from express_ceps
  where cep = new.recipient_cep and active = true
  limit 1;

  if found then
    new.is_express := true;
  end if;

  return new;
end;
$$;

-- CORRIGIDO: BEFORE INSERT (era AFTER INSERT — não funcionava)
create trigger trg_check_express_cep
  before insert on shipments
  for each row execute function fn_check_express_cep();

-- Trigger separado para inserir na express_queue APÓS o shipment existir
create or replace function fn_insert_express_queue()
returns trigger language plpgsql as $$
declare
  v_cep_row express_ceps%rowtype;
begin
  if new.is_express then
    select * into v_cep_row
    from express_ceps
    where cep = new.recipient_cep and active = true
    limit 1;

    if found then
      insert into express_queue (shipment_id, cep, city)
      values (new.id, v_cep_row.cep, v_cep_row.city)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_insert_express_queue
  after insert on shipments
  for each row execute function fn_insert_express_queue();

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- ============================================================
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_shipments_updated_at
  before update on shipments
  for each row execute function fn_set_updated_at();

create trigger trg_tickets_updated_at
  before update on tickets
  for each row execute function fn_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table shipments      enable row level security;
alter table labels         enable row level security;
alter table express_queue  enable row level security;
alter table express_ceps   enable row level security;
alter table tickets        enable row level security;
alter table webhooks       enable row level security;
alter table webhook_logs   enable row level security;
alter table freight_quotes enable row level security;
alter table system_logs    enable row level security;

-- Políticas abertas para service_role (backend)
create policy "service_role full access" on shipments      using (true) with check (true);
create policy "service_role full access" on labels         using (true) with check (true);
create policy "service_role full access" on express_queue  using (true) with check (true);
create policy "service_role full access" on express_ceps   using (true) with check (true);
create policy "service_role full access" on tickets        using (true) with check (true);
create policy "service_role full access" on webhooks       using (true) with check (true);
create policy "service_role full access" on webhook_logs   using (true) with check (true);
create policy "service_role full access" on freight_quotes using (true) with check (true);
create policy "service_role full access" on system_logs    using (true) with check (true);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_shipments_status        on shipments(status);
create index if not exists idx_shipments_order_id      on shipments(order_id);
create index if not exists idx_shipments_is_express    on shipments(is_express) where is_express = true;
create index if not exists idx_shipments_recipient_cep on shipments(recipient_cep);
create index if not exists idx_shipments_created_at    on shipments(created_at desc);
create index if not exists idx_express_queue_status    on express_queue(status);
create index if not exists idx_tickets_status          on tickets(status);
create index if not exists idx_webhook_logs_webhook_id on webhook_logs(webhook_id);
create index if not exists idx_system_logs_created_at  on system_logs(created_at desc);
create index if not exists idx_system_logs_level       on system_logs(level);
