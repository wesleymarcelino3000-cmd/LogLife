-- ============================================================
-- LogLife — MIGRATION (rode se o banco já existir)
-- Execute no SQL Editor do Supabase APENAS se já tiver rodado
-- o schema.sql antes. Se for banco novo, use só o schema.sql.
-- ============================================================

-- 1. Colunas faltando em shipments
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS product_name  text,
  ADD COLUMN IF NOT EXISTS ordered_at    timestamptz,
  ADD COLUMN IF NOT EXISTS nfe_chave     text,
  ADD COLUMN IF NOT EXISTS nfe_numero    text,
  ADD COLUMN IF NOT EXISTS nfe_serie     text,
  ADD COLUMN IF NOT EXISTS nfe_xml_url   text;

-- 2. Unique constraint em order_id (evita duplicatas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shipments_order_id_key'
  ) THEN
    ALTER TABLE shipments ADD CONSTRAINT shipments_order_id_key UNIQUE (order_id);
  END IF;
END $$;

-- 3. Tabela system_logs (estava faltando)
CREATE TABLE IF NOT EXISTS system_logs (
  id         uuid primary key default uuid_generate_v4(),
  level      text not null default 'info'
             check (level in ('info','warning','error','success')),
  message    text not null,
  source     text,
  details    jsonb,
  created_at timestamptz not null default now()
);
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_logs' AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON system_logs USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at desc);
CREATE INDEX IF NOT EXISTS idx_system_logs_level      ON system_logs(level);

-- 4. Corrigir trigger express (era AFTER, devia ser BEFORE)
DROP TRIGGER IF EXISTS trg_check_express_cep ON shipments;

CREATE OR REPLACE FUNCTION fn_check_express_cep()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cep_row express_ceps%rowtype;
BEGIN
  SELECT * INTO v_cep_row
  FROM express_ceps
  WHERE cep = new.recipient_cep AND active = true
  LIMIT 1;

  IF FOUND THEN
    new.is_express := true;
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER trg_check_express_cep
  BEFORE INSERT ON shipments
  FOR EACH ROW EXECUTE FUNCTION fn_check_express_cep();

-- Trigger separado para express_queue (precisa ser AFTER para ter o id)
DROP TRIGGER IF EXISTS trg_insert_express_queue ON shipments;

CREATE OR REPLACE FUNCTION fn_insert_express_queue()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_cep_row express_ceps%rowtype;
BEGIN
  IF new.is_express THEN
    SELECT * INTO v_cep_row
    FROM express_ceps
    WHERE cep = new.recipient_cep AND active = true
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO express_queue (shipment_id, cep, city)
      VALUES (new.id, v_cep_row.cep, v_cep_row.city)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END;
$$;

CREATE TRIGGER trg_insert_express_queue
  AFTER INSERT ON shipments
  FOR EACH ROW EXECUTE FUNCTION fn_insert_express_queue();

-- 5. Índice em order_id
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at desc);

-- 6. Tabela app_users (estava faltando no schema original)
CREATE TABLE IF NOT EXISTS app_users (
  id            uuid primary key default uuid_generate_v4(),
  username      text not null unique,
  name          text not null,
  password_hash text not null,
  salt          text not null,
  role          text not null default 'operator'
                check (role in ('admin','operator')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_users' AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON app_users USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Usuário admin padrão: login=admin / senha=admin123
-- TROQUE A SENHA após o primeiro acesso!
INSERT INTO app_users (username, name, password_hash, salt, role)
VALUES (
  'admin',
  'Administrador',
  '22fde93016c6819db5a1e39e7ae5566c7ef397f9a41c2019547b0addb85f3a8d',
  '179f5eb4abb7a434e8fad985bd3fcb54',
  'admin'
) ON CONFLICT (username) DO NOTHING;
