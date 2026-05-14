# ✅ Correções aplicadas — LogLife

## O que foi corrigido

### 1. `sql/schema.sql` — reescrito completo
- ✅ Adicionadas colunas faltando em `shipments`: `product_name`, `ordered_at`, `nfe_chave`, `nfe_numero`, `nfe_serie`, `nfe_xml_url`
- ✅ Adicionada `UNIQUE` constraint em `shipments.order_id` (evita pedidos duplicados)
- ✅ Criada tabela `system_logs` (estava faltando, causava erros silenciosos)
- ✅ Corrigido trigger `trg_check_express_cep`: era `AFTER INSERT` (não funcionava), agora é `BEFORE INSERT`
- ✅ Criado trigger separado `trg_insert_express_queue` (AFTER INSERT) para inserir na fila express

### 2. `sql/migration.sql` — novo arquivo
- Para quem **já tem o banco criado**: rode este arquivo no Supabase SQL Editor
- Usa `IF NOT EXISTS` e `IF NOT EXISTS` em tudo — seguro de rodar múltiplas vezes

### 3. `.env.example` — atualizado
- Instruções mais claras de onde encontrar cada chave
- URL do webhook documentada no arquivo

---

## Como aplicar

### Banco de dados novo:
1. Abra o Supabase → SQL Editor
2. Cole e execute `sql/schema.sql`

### Banco de dados já existente:
1. Abra o Supabase → SQL Editor
2. Cole e execute `sql/migration.sql`

### Variáveis de ambiente no Vercel:
1. Acesse seu projeto no Vercel → Settings → Environment Variables
2. Adicione todas as variáveis do `.env.example`
3. Salve e faça redeploy

### Webhook na Yampi:
1. Yampi → Configurações → Webhooks → + Novo Webhook
2. URL: `https://log-life-brown.vercel.app/api/yampi-webhook`
3. Método: POST
4. Ative o webhook

---

## Bugs corrigidos (resumo técnico)

| # | Bug | Impacto | Arquivo |
|---|-----|---------|---------|
| 1 | Colunas `product_name`, `ordered_at`, `nfe_*` não existiam | INSERTs falhavam → 0 pedidos sincronizados | schema.sql |
| 2 | Tabela `system_logs` não existia | Logs do sistema perdidos | schema.sql |
| 3 | Trigger `AFTER INSERT` não conseguia modificar `is_express` | CEP express não era detectado | schema.sql |
| 4 | `order_id` sem UNIQUE | Risco de pedidos duplicados em race condition | schema.sql |
| 5 | Variáveis YAMPI_* não documentadas claramente | Erro "Erro ao sincronizar com Yampi" | .env.example |
